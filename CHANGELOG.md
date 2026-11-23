# Changelog

## 1.0.0 — 2026-11-23
- Chạy trên Cloudflare Workers + D1 (OpenNext), cron nhắc việc bằng Cron Trigger; không còn Vercel/Postgres/Docker.
- Không lưu ảnh phiếu: ảnh chỉ gửi cho AI đọc rồi bỏ; bản nháp quét dở tự xóa sau 7 ngày.
- Đăng nhập HMAC + `SESSION_SECRET`, khóa tạm sau 8 lần sai, so sánh an toàn thời gian.
- Gộp truy vấn N+1 khi tính hạn bảo dưỡng; thêm index; nút sao lưu JSON.
- Quét phiếu bằng Gemini / DeepSeek / Claude (gọi qua `fetch`); phân loại nhiều lớp, VAT/giảm giá, tra cứu chu kỳ bằng AI.
