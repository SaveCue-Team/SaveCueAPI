const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const error = (description) => ({ description, content: json(ref('Error')) });

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Bookmarks API',
    version: '1.0.0',
    description: 'Lưu bookmark từ URL. Mỗi POST tạo bản ghi mới, cho phép URL trùng.',
  },
  servers: [{ url: '/', description: 'Server đang phục vụ tài liệu' }],
  tags: [{ name: 'Bookmarks', description: 'Quản lý bookmark' }],
  paths: {
    '/bookmarks': {
      get: {
        tags: ['Bookmarks'],
        operationId: 'getBookmarks',
        summary: 'Lấy tất cả bookmark theo thứ tự tạo',
        responses: {
          '200': {
            description: 'Danh sách bookmark, hoặc [] nếu chưa có dữ liệu',
            content: json({ type: 'array', items: ref('Bookmark') }),
          },
          '500': error('Lỗi đọc dữ liệu'),
        },
      },
      post: {
        tags: ['Bookmarks'],
        operationId: 'createBookmark',
        summary: 'Lưu bookmark từ URL',
        description: 'Chỉ nhận URL HTTP/HTTPS tuyệt đối, không chứa thông tin đăng nhập. Server chuẩn hóa và lưu URL, không tải nội dung trang.',
        requestBody: { required: true, content: json(ref('CreateBookmarkInput')) },
        responses: {
          '201': { description: 'Đã lưu bookmark', content: json(ref('Bookmark')) },
          '400': error('JSON/URL không hợp lệ, thiếu url hoặc có trường không được hỗ trợ'),
          '413': error('Request body vượt quá 16 KB'),
          '415': error('Yêu cầu application/json, không hỗ trợ body nén'),
          '500': error('Lỗi lưu dữ liệu'),
        },
      },
    },
  },
  components: {
    schemas: {
      Bookmark: {
        type: 'object',
        required: ['id', 'url', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid', example: 'cae2e944-807a-40e0-b187-45a0cbe73ef6' },
          url: { type: 'string', format: 'uri', example: 'https://example.com/' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-11-03T09:00:00.000Z' },
        },
      },
      CreateBookmarkInput: {
        type: 'object',
        additionalProperties: false,
        required: ['url'],
        properties: {
          url: {
            type: 'string', format: 'uri', maxLength: 2048,
            description: 'URL HTTP/HTTPS không chứa thông tin đăng nhập hoặc khoảng trắng bên trong. Loại bỏ khoảng trắng đầu/cuối.',
            example: 'https://example.com',
          },
        },
      },
      Error: {
        type: 'object', required: ['message'],
        properties: { message: { type: 'string', example: 'URL không hợp lệ.' } },
      },
    },
  },
};
