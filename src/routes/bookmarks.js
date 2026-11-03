const express = require('express');

function validateUrl(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
      Object.keys(body).some((key) => key !== 'url') || typeof body.url !== 'string') {
    return null;
  }
  const value = body.url.trim();
  if (!value || body.url.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(value) ||
      !/^https?:\/\//i.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function createBookmarkRouter(repository) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.json(await repository.list());
  });
  router.post('/', (req, res, next) => {
    if (!req.is('application/json')) {
      return res.status(415).json({ message: 'Content-Type phải là application/json.' });
    }
    next();
  }, express.json({ limit: '16kb', inflate: false }), async (req, res) => {
    const url = validateUrl(req.body);
    if (!url) {
      return res.status(400).json({
        message: 'Body chỉ gồm url: URL HTTP/HTTPS hợp lệ, tối đa 2048 ký tự, không chứa thông tin đăng nhập.',
      });
    }
    res.status(201).json(await repository.create(url));
  });
  return router;
}

module.exports = { createBookmarkRouter };
