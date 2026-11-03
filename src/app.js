const path = require('node:path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../Swagger');
const { createBookmarkRepository } = require('./repositories/bookmarkRepository');
const { createBookmarkRouter } = require('./routes/bookmarks');

function createApp({
  dataFile = path.resolve(process.env.BOOKMARKS_FILE || 'data/bookmarks.json'),
  logger = console,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Health check nhẹ cho Render và cron ping; không đọc/ghi bookmark.
  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok' });
  });
  app.use('/bookmarks', createBookmarkRouter(createBookmarkRepository(dataFile)));
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Bookmarks API Docs',
  }));
  app.get('/', (req, res) => res.redirect('/api-docs'));
  app.use((req, res) => res.status(404).json({ message: 'Không tìm thấy endpoint.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Request body phải là JSON hợp lệ.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request body vượt quá 16 KB.' });
    }
    if (error.status === 415) {
      return res.status(415).json({ message: 'Encoding hoặc charset không được hỗ trợ.' });
    }
    logger.error(error);
    res.status(500).json({ message: 'Lỗi server, vui lòng thử lại sau.' });
  });
  return app;
}

module.exports = { createApp };
