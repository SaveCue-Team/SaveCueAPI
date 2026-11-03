const { createApp } = require('./app');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
}
const server = createApp().listen(port, host, () => {
  console.log(`Bookmarks API: http://${host}:${port}`);
  console.log(`Swagger UI: http://${host}:${port}/api-docs`);
});
server.on('error', (error) => {
  console.error('Không thể khởi động server:', error.message);
  process.exitCode = 1;
});
function shutdown() {
  console.log('Đang dừng server...');
  server.close((error) => {
    if (error) console.error(error);
    process.exit(error ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
