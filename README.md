# Bookmarks API

Backend Node.js + Express với hai API và Swagger UI. Yêu cầu Node.js 22.9 trở lên.

## Khởi động

```sh
npm install
npm start
```

Mở http://localhost:3000/api-docs để xem tài liệu và dùng **Try it out** gọi API.
Đặc tả JSON: http://localhost:3000/api-docs.json.
Chạy `npm run dev` để tự khởi động lại khi sửa code; `npm test` để kiểm thử.

Có thể sao chép `.env.example` thành `.env` rồi đổi `PORT`, `HOST`, `BOOKMARKS_FILE`.
Đường dẫn dữ liệu tương đối được tính từ thư mục chạy lệnh.

## API

`GET /bookmarks`: trả `200` và mảng bookmark theo thứ tự tạo, hoặc `[]` khi chưa có dữ liệu.

`POST /bookmarks`: header `Content-Type: application/json`, body:

```json
{ "url": "https://example.com/articles/hello" }
```

Phản hồi `201`:

```json
{
  "id": "cae2e944-807a-40e0-b187-45a0cbe73ef6",
  "url": "https://example.com/articles/hello",
  "createdAt": "2026-11-03T09:00:00.000Z"
}
```

Body chỉ gồm `url`: URL HTTP/HTTPS tuyệt đối, tối đa 2048 ký tự đầu vào, không chứa khoảng trắng bên trong hoặc thông tin đăng nhập. Khoảng trắng đầu/cuối được loại bỏ; URL được chuẩn hóa (ví dụ `https://example.com` thành `https://example.com/`). Server chỉ lưu URL, không tải nội dung trang. Mỗi POST tạo bản ghi mới, cho phép URL trùng.

Lỗi có dạng `{ "message": "..." }`: `400` khi JSON/URL không hợp lệ, `413` khi body vượt 16 KB, `415` khi Content-Type/encoding không được hỗ trợ, `404` khi endpoint không tồn tại, `500` khi đọc/ghi thất bại.

Ví dụ PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/bookmarks -Method Post -ContentType 'application/json' -Body '{"url":"https://example.com"}'
Invoke-RestMethod -Uri http://localhost:3000/bookmarks
```

## Cấu trúc

```text
Swagger.js                              # Đặc tả OpenAPI
src/server.js                           # Khởi động và dừng server
src/app.js                              # Middleware, Swagger UI, xử lý lỗi
src/routes/bookmarks.js                 # Endpoint và kiểm tra đầu vào
src/repositories/bookmarkRepository.js  # Đọc/ghi dữ liệu
test/bookmarks.test.js                   # Kiểm thử tích hợp HTTP
data/bookmarks.json                     # Tự tạo khi lưu bookmark đầu tiên
```

Dữ liệu được ghi vào file tạm rồi đổi tên; các lần ghi được xếp hàng để tránh mất bookmark khi có nhiều request đồng thời. Trên máy local có ổ đĩa bền vững, dữ liệu còn sau khi khởi động lại server. Trên Render Free, dữ liệu là tạm thời và mất khi restart, redeploy hoặc service ngủ. File dữ liệu lỗi không bị tự động ghi đè.

Bộ khung dành cho một tiến trình server, chưa có đăng nhập; mọi người gọi API dùng chung danh sách. Khi cần nhiều tiến trình hoặc nhiều người dùng, thay repository bằng cơ sở dữ liệu và thêm xác thực/phân quyền.

## Deploy Render Free

Dự án đã có `render.yaml` để tạo Web Service Free tại Singapore và `.node-version` để chọn Node.js 24. Cấu hình dùng file JSON tạm thời theo lựa chọn của dự án, không tạo database hoặc persistent disk.

### 1. Đưa code lên GitHub

Tạo repository GitHub trống, rồi chạy trong thư mục dự án (thay URL ví dụ bằng repository của bạn):

```sh
git init
git add .
git commit -m "Configure SaveCue for Render"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/savecue-api.git
git push -u origin main
```

Các lệnh trên dành cho thư mục chưa có Git. Nếu đã có repository, chỉ commit và push lên nhánh dùng để deploy. `.gitignore` loại trừ `.env`, `node_modules/` và `data/`; hãy giữ `.node-version`, `render.yaml` và `package-lock.json` trong repository.

### 2. Tạo Blueprint trên Render

1. Đăng nhập [Render Dashboard](https://dashboard.render.com/).
2. Chọn **New → Blueprint**, kết nối GitHub và chọn repository vừa push.
3. Chọn nhánh chứa code; Blueprint Path là `render.yaml` ở gốc repository.
4. Đặt tên Blueprint, kiểm tra service `savecue-api` dùng **Free**, rồi bấm nút triển khai Blueprint.
5. Đợi service chuyển sang **Live**. Lấy URL `https://TEN-SERVICE.onrender.com` từ Dashboard; tên thực tế có thể có hậu tố.

Blueprint tự cấu hình:

| Thiết lập | Giá trị |
| --- | --- |
| Runtime / Region / Plan | Node / Singapore / Free |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| NODE_ENV | `production` |
| HOST | `0.0.0.0` |
| BOOKMARKS_FILE | `./data/bookmarks.json` |
| Custom domain | `savecue.id.vn` |
| Auto deploy | Khi push commit lên nhánh đã kết nối |

Không đặt `PORT`: server đọc cổng Render cung cấp. Không upload `.env` local vì thường chứa `HOST=127.0.0.1`. `.node-version` chọn Node 24; nếu Dashboard có `NODE_VERSION` cũ thì xóa hoặc đổi về Node 24 vì biến đó được ưu tiên hơn file.

Nếu bạn đã tạo **Web Service** thủ công, không tạo thêm Blueprint/service thứ hai: áp dụng bảng trên trong Settings/Environment của service hiện có. Chỉ push `render.yaml` vào repo không tự áp dụng cấu hình cho service chưa được quản lý bằng Blueprint.

### 3. Kiểm tra service

Mở các URL sau, thay `TEN-SERVICE` bằng hostname thực tế:

- `https://TEN-SERVICE.onrender.com/health` → HTTP 200, `{"status":"ok"}`.
- `https://TEN-SERVICE.onrender.com/api-docs` → Swagger UI, dùng Try it out để thử POST và GET.
- `https://TEN-SERVICE.onrender.com/bookmarks` → danh sách bookmark.

`/health` chỉ kiểm tra tiến trình HTTP đang phản hồi; không đọc/ghi dữ liệu và không kiểm tra tình trạng file bookmark. Đây là endpoint vận hành nên không thêm vào Swagger của hai API nghiệp vụ.

Nếu deploy lỗi, xem Logs: lỗi không tìm thấy port thường do `HOST` sai; lỗi `npm ci` cần kiểm tra `package-lock.json` đã được commit và khớp `package.json`.

### 4. Trỏ savecue.id.vn

Trong service → **Settings → Custom Domains**, Blueprint đã khai báo `savecue.id.vn`. Làm theo giá trị DNS Render hiển thị tại nhà cung cấp tên miền.

- Với tên miền gốc `@`, dùng ALIAS/ANAME nếu nhà cung cấp hỗ trợ; nếu không, dùng bản ghi A theo IP Render hướng dẫn.
- Nếu dùng `www`, đặt CNAME `www` trỏ tới hostname `TEN-SERVICE.onrender.com` (không có `https://` hay đường dẫn).
- Xóa bản ghi web A/CNAME bị xung đột và AAAA cho hostname trỏ Render; giữ nguyên bản ghi MX/TXT phục vụ email.
- Quay lại Render bấm **Verify**, đợi xác minh DNS và cấp HTTPS.

Sau đó dùng `https://savecue.id.vn/api-docs`. Swagger dùng server URL `/` nên tự gọi đúng tên miền hiện tại. Render quản lý HTTPS; không cần Nginx, PM2 hoặc Certbot.

### 5. Cron ping mỗi 5 phút

Tại [cron-job.org](https://cron-job.org/), tạo job:

| Thiết lập | Giá trị |
| --- | --- |
| Title | SaveCue health ping |
| URL | `https://savecue.id.vn/health` |
| Method | GET |
| Lịch | Mỗi 5 phút, tất cả ngày/giờ (`*/5 * * * *` nếu dùng biểu thức cron) |
| Body | Để trống |
| Thông báo lỗi/phục hồi | Bật |

Nếu DNS chưa xong, dùng `https://TEN-SERVICE.onrender.com/health` trước. Chạy thử và kiểm tra Execution History trả HTTP 200. Job này phải được tạo riêng ở cron-job.org; `render.yaml` không tạo nó. Không dùng POST `/bookmarks` để ping.

Ping giúp giảm ngủ do không có lưu lượng, không bảo đảm uptime. Cron có thể timeout khi Render đang khởi động lại; kiểm tra lần chạy tiếp theo. Health check nội bộ của Render không thay thế cron ping từ bên ngoài. Dữ liệu JSON vẫn có thể mất dù cron đang chạy.

Tham khảo: [Render Blueprint](https://render.com/docs/blueprint-spec), [Node version](https://render.com/docs/node-version), [Render Free](https://render.com/docs/free), [DNS](https://render.com/docs/configure-other-dns), [custom domains](https://render.com/docs/custom-domains), [cron-job.org FAQ](https://cron-job.org/en/faq/), [Express error handling](https://expressjs.com/en/guide/error-handling/) và [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express).
