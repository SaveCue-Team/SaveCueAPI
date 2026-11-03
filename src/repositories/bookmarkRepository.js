const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Một repository cho mỗi file, trong một tiến trình server.
function createBookmarkRepository(filePath) {
  let pendingWrite = Promise.resolve();

  async function read() {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const bookmarks = JSON.parse(content);
    if (!Array.isArray(bookmarks) || bookmarks.some((item) =>
      !item || typeof item.id !== 'string' || typeof item.url !== 'string' ||
      typeof item.createdAt !== 'string')) {
      throw new Error('Invalid bookmark data file');
    }
    return bookmarks;
  }

  return {
    async list() {
      await pendingWrite;
      return read();
    },
    create(url) {
      // Tuần tự hóa đọc/sửa/ghi để không mất dữ liệu khi POST đồng thời.
      const operation = pendingWrite.then(async () => {
        const bookmarks = await read();
        const bookmark = { id: randomUUID(), url, createdAt: new Date().toISOString() };
        bookmarks.push(bookmark);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
        try {
          await fs.writeFile(temporaryFile, `${JSON.stringify(bookmarks, null, 2)}\n`, { flag: 'wx' });
          await fs.rename(temporaryFile, filePath);
        } finally {
          await fs.rm(temporaryFile, { force: true });
        }
        return bookmark;
      });
      pendingWrite = operation.catch(() => {});
      return operation;
    },
  };
}

module.exports = { createBookmarkRepository };
