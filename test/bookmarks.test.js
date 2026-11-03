const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../src/app');

async function serve(t, dataFile) {
  const server = createApp({ dataFile, logger: { error() {} } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bookmarks-test-'));
  t.after(async () => {
    // Chỉ xóa thư mục tạm được tạo riêng cho kiểm thử này.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('bookmarks-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const dataFile = path.join(directory, 'bookmarks.json');
  return { dataFile, base: await serve(t, dataFile) };
}

function post(base, body) {
  return fetch(`${base}/bookmarks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('GET trả danh sách rỗng; POST lưu URL chuẩn hóa và tồn tại qua app mới', async (t) => {
  const { base, dataFile } = await setup(t);
  const empty = await fetch(`${base}/bookmarks`);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);
  const response = await post(base, { url: '  https://EXAMPLE.com  ' });
  assert.equal(response.status, 201);
  const bookmark = await response.json();
  assert.equal(bookmark.url, 'https://example.com/');
  assert.match(bookmark.id, /^[0-9a-f-]{36}$/);
  assert.equal(new Date(bookmark.createdAt).toISOString(), bookmark.createdAt);
  assert.deepEqual(JSON.parse(await fs.readFile(dataFile, 'utf8')), [bookmark]);
  const restarted = await serve(t, dataFile);
  assert.deepEqual(await (await fetch(`${restarted}/bookmarks`)).json(), [bookmark]);
});

test('POST từ chối body/URL không hợp lệ và không lưu dữ liệu', async (t) => {
  const { base } = await setup(t);
  for (const body of [
    {}, [], null, { url: 123 }, { url: '' }, { url: 'example.com' },
    { url: 'ftp://example.com' }, { url: 'javascript:alert(1)' },
    { url: 'https://user:password@example.com' }, { url: 'https://' },
    { url: 'https://example.com/a b' }, { url: 'https://example.com', name: 'extra' },
    { url: `https://example.com/${'a'.repeat(2048)}` },
  ]) {
    const response = await post(base, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(typeof (await response.json()).message, 'string');
  }
  assert.deepEqual(await (await fetch(`${base}/bookmarks`)).json(), []);
});

test('JSON lỗi, sai content type và body quá lớn có mã lỗi phù hợp', async (t) => {
  const { base } = await setup(t);
  for (const [contentType, body, status] of [
    ['application/json', '{"url":', 400],
    ['text/plain', 'https://example.com', 415],
    ['application/json', JSON.stringify({ url: 'a'.repeat(17000) }), 413],
  ]) {
    const response = await fetch(`${base}/bookmarks`, {
      method: 'POST', headers: { 'Content-Type': contentType }, body,
    });
    assert.equal(response.status, status);
    assert.equal(typeof (await response.json()).message, 'string');
  }
});

test('POST đồng thời không mất dữ liệu; cho phép URL trùng', async (t) => {
  const { base } = await setup(t);
  const responses = await Promise.all(Array.from({ length: 12 }, () =>
    post(base, { url: 'https://example.com' })));
  const created = [];
  for (const response of responses) {
    assert.equal(response.status, 201);
    created.push(await response.json());
  }
  const bookmarks = await (await fetch(`${base}/bookmarks`)).json();
  assert.equal(bookmarks.length, 12);
  assert.equal(new Set(bookmarks.map((item) => item.id)).size, 12);
  assert.deepEqual(new Set(bookmarks.map((item) => item.id)), new Set(created.map((item) => item.id)));
});

test('Swagger UI, assets và đặc tả phục vụ đúng hai API', async (t) => {
  const { base } = await setup(t);
  const docs = await fetch(`${base}/api-docs/`);
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /swagger-ui/);
  const asset = await fetch(`${base}/api-docs/swagger-ui-bundle.js`);
  assert.equal(asset.status, 200);
  assert.ok((await asset.text()).length > 1000);
  const init = await (await fetch(`${base}/api-docs/swagger-ui-init.js`)).text();
  assert.match(init, /\/bookmarks/);
  const response = await fetch(`${base}/api-docs.json`);
  assert.equal(response.status, 200);
  const spec = await response.json();
  assert.deepEqual(Object.keys(spec.paths), ['/bookmarks']);
  assert.deepEqual(Object.keys(spec.paths['/bookmarks']).sort(), ['get', 'post']);
  assert.deepEqual(spec.components.schemas.CreateBookmarkInput.required, ['url']);
  assert.equal(spec.servers[0].url, '/');
});

test('File hỏng trả 500, không ghi đè; hàng đợi phục hồi sau khi sửa file', async (t) => {
  const { base, dataFile } = await setup(t);
  await fs.writeFile(dataFile, 'broken-json');
  const list = await fetch(`${base}/bookmarks`);
  assert.equal(list.status, 500);
  assert.deepEqual(Object.keys(await list.json()), ['message']);
  const create = await post(base, { url: 'https://example.com' });
  assert.equal(create.status, 500);
  await create.json();
  assert.equal(await fs.readFile(dataFile, 'utf8'), 'broken-json');
  await fs.writeFile(dataFile, '[]');
  const recovered = await post(base, { url: 'http://example.com' });
  assert.equal(recovered.status, 201);
  await recovered.json();
});

test('Lỗi ghi file trả 500 mà không lộ thông tin nội bộ', async (t) => {
  const { base, dataFile } = await setup(t);
  await fs.mkdir(dataFile);
  const response = await post(base, { url: 'https://example.com' });
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['message']);
  assert.ok(!body.message.includes(dataFile));
});

test('Health check hoạt động khi dữ liệu lỗi và không thay đổi file', async (t) => {
  const { base, dataFile } = await setup(t);
  await fs.writeFile(dataFile, 'broken-json');
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(await fs.readFile(dataFile, 'utf8'), 'broken-json');
});

test('Endpoint không tồn tại trả JSON 404', async (t) => {
  const { base } = await setup(t);
  const response = await fetch(`${base}/missing`);
  assert.equal(response.status, 404);
  assert.equal(typeof (await response.json()).message, 'string');
});
