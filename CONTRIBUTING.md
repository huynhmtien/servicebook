# Đóng góp

1. `npm ci` rồi `npm run types` (sinh kiểu Cloudflare).
2. Trước khi gửi PR: `npx tsc --noEmit` và `npm test` phải sạch (CI chạy cùng các lệnh này kèm build).
3. Đổi schema: thêm file mới `migrations/000N_ten.sql`, **không sửa migration cũ**. Thêm linh kiện mặc định: sửa `src/lib/parts.ts` và viết migration `INSERT OR IGNORE`; `npm test` sẽ báo nếu quên.
4. Sửa lỗi nên kèm một bước kiểm tra trong `e2e/run.mjs` (cần Playwright, xem HUONG-DAN.md).
5. Không commit bí mật, ảnh phiếu thật hay dữ liệu cá nhân.
