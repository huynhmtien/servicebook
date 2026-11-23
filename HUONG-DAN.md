# Hướng dẫn cài ServiceBook lên Cloudflare (miễn phí)

ServiceBook chạy hoàn toàn trên Cloudflare: **Workers** (web) + **D1** (dữ liệu) + **Cron Trigger** (nhắc việc). Không cần máy chủ, không cần Vercel.

## Cài lần đầu (khoảng 10 phút)
Cần: Node 22+, tài khoản Cloudflare (miễn phí), đã `npx wrangler login`.

1. `npm ci`
2. Tạo cơ sở dữ liệu rồi đặt mã của nó vào biến môi trường (mã **không** ghi vào repo):
   ```
   npx wrangler d1 create servicebook          # in ra database_id
   export SERVICEBOOK_D1_ID=<database_id vừa in ra>
   ```
3. Tạo file bí mật (đừng đưa vào git), ví dụ `secrets.env`:
   ```
   APP_PASSWORD=mật-khẩu-của-anh
   SESSION_SECRET=<openssl rand -hex 32>
   CRON_SECRET=<openssl rand -hex 24>
   GEMINI_API_KEY=...        # hoặc ANTHROPIC_API_KEY / DEEPSEEK_API_KEY (để quét phiếu bằng AI)
   TELEGRAM_BOT_TOKEN=...    # tùy chọn
   TELEGRAM_CHAT_ID=...
   ```
4. Triển khai:
   ```
   npm run release -- --secrets-file secrets.env
   ```
   `npm run release` build, chạy migration rồi deploy. Lần đầu nhớ truyền `--secrets-file` (đặt các bí mật ở bước 3); các lần sau bí mật cũ vẫn giữ nên chỉ cần `npm run release`.

Địa chỉ: `https://servicebook.<tên-tài-khoản>.workers.dev`. Muốn tên miền riêng: Cloudflare → Workers → servicebook → Settings → Domains & Routes.

## Dùng hằng ngày
- **Thêm xe** → nhập lần thay gần nhất → chụp phiếu để AI đọc, soát lại rồi lưu. **Ảnh không được lưu**: chỉ gửi cho AI đọc rồi bỏ; bản nháp quét dở tự xóa sau 7 ngày.
- **Nhắc việc:** mỗi sáng 8:00 (giờ VN) Cloudflare gọi `/api/cron` để gửi tổng hợp Telegram; khi lưu phiếu/ODO mà có mục mới tới hạn, bot báo ngay.
- **Sao lưu:** Cài đặt → "Tải bản sao lưu" (file JSON). Nên tải mỗi tháng.

## Thay đổi cấu hình / bí mật
- Đổi/đặt bí mật: `npx wrangler secret put TÊN` (hoặc Cloudflare → Workers → servicebook → Settings → Variables and Secrets).
- Đổi mật khẩu: đặt lại `APP_PASSWORD` **và** `SESSION_SECRET` (đăng xuất mọi thiết bị).
- Kiểm tra cấu hình: mở `/api/health` sau khi đăng nhập.

## Chạy thử trên máy
```
cp .dev.vars.example .dev.vars   # điền giá trị
npx wrangler d1 migrations apply servicebook --local
npm run preview                  # http://localhost:8787
npm test                         # kiểm thử đơn vị
```
Kiểm thử e2e (cần Playwright): chạy `node e2e/mock-services.mjs`, đặt `TELEGRAM_API_BASE`/`GEMINI_API_BASE=http://localhost:5599` trong `.dev.vars`, rồi `node e2e/run.mjs` (xem đầu file để biết biến môi trường).

## Thêm linh kiện / đổi schema
Không sửa migration cũ. Tạo file mới `migrations/000N_ten.sql` rồi `npm run db:migrate`. Thêm linh kiện mặc định: sửa `src/lib/parts.ts`, thêm migration `INSERT OR IGNORE` (xem `0002_seed_parts.sql`); `npm test` sẽ báo nếu quên.

## Giới hạn gói miễn phí cần biết
100.000 yêu cầu/ngày, **10 ms CPU mỗi yêu cầu** (thời gian chờ database/AI không tính). Nếu thấy lỗi 1102 (vượt CPU) khi dữ liệu lớn, nâng gói Workers Paid ($5/tháng).
