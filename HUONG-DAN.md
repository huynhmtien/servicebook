# Hướng dẫn cài đặt ServiceBook (tiếng Việt)

ServiceBook chạy hoàn toàn trên Cloudflare — **Workers** (web), **D1** (dữ liệu), **Cron Trigger** (nhắc việc) — trong tài khoản của bạn, gói miễn phí. Không cần máy chủ, không cần Docker. (English: [SETUP.md](SETUP.md))

Cần: Node 22+, tài khoản Cloudflare, và (tùy chọn) khóa AI, bot Telegram.

## 1. Cài đặt và đăng nhập

```bash
npm ci
npx wrangler login
```

## 2. Tạo cơ sở dữ liệu

```bash
npx wrangler d1 create servicebook        # in ra database_id
export SERVICEBOOK_D1_ID=<database_id vừa in ra>
```

Mã này **không** nằm trong repo. `npm run release` lấy từ biến `SERVICEBOOK_D1_ID` (hoặc bạn sửa `wrangler.jsonc` trên máy mình và đừng commit).

## 3. Chuẩn bị bí mật

Tạo `secrets.env` (đừng commit — `*.env` đã được git bỏ qua):

```
APP_PASSWORD=mat-khau-manh-cua-ban
SESSION_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 24>
GEMINI_API_KEY=...          # hoặc ANTHROPIC_API_KEY / DEEPSEEK_API_KEY — để quét phiếu
TELEGRAM_BOT_TOKEN=...      # tùy chọn
TELEGRAM_CHAT_ID=...        # tùy chọn
```

Lấy giá trị tùy chọn ở đâu:
- **Khóa Gemini**: https://aistudio.google.com/apikey (có gói miễn phí). Anthropic: https://console.anthropic.com. DeepSeek: https://platform.deepseek.com.
- **Telegram**: chat với **@BotFather**, gõ `/newbot`, copy token. Nhắn một tin bất kỳ cho bot vừa tạo, rồi hỏi **@userinfobot** lấy Id số → `TELEGRAM_CHAT_ID`.

## 4. Triển khai

```bash
npm run release -- --secrets-file secrets.env
```

Lệnh này build, áp dụng migration database, rồi deploy Worker tên `servicebook`. Các lần sau chỉ cần `npm run release` (bí mật đã đặt vẫn được giữ).

App ở `https://servicebook.<tên-miền-phụ-của-bạn>.workers.dev`. Muốn tên miền riêng: Cloudflare → Workers → servicebook → Settings → Domains & Routes.

## 5. Những bước đầu trong app

1. Đăng nhập bằng `APP_PASSWORD`.
2. **Cài đặt** → chọn ngôn ngữ, tiền tệ, đơn vị quãng đường, tên thuế, múi giờ, giờ nhắc hằng ngày → **Lưu** (bước này được đánh dấu xong ở trang chủ).
3. **Xe** → thêm xe (chọn loại nhiên liệu), nhập lần thay gần nhất của các hạng mục bạn nhớ.
4. **Thêm phiếu** → chụp phiếu, kiểm tra, lưu.
5. **Telegram** (tùy chọn): Cài đặt → *Kiểm tra & gửi tin thử*; rồi *Bật trả lời qua Telegram* để nhắn cho bot một con số (vd `52000`) cập nhật ODO.

## Đưa chu kỳ về đúng số của xe bạn

Ở trang xe: *Tra cứu theo … (AI tìm trên web)* đề xuất lịch bảo dưỡng của hãng kèm nguồn, hoặc chụp bảng bảo dưỡng trong sổ hướng dẫn. Bạn duyệt từng dòng; không có gì tự áp dụng.

## Sao lưu và khôi phục

Cài đặt → **Tải bản sao lưu** (JSON) và **Xuất phiếu (CSV)**. Khôi phục trên bất kỳ bản ServiceBook nào: Cài đặt → *Khôi phục từ bản sao lưu* → chọn file. Khôi phục **thay thế** toàn bộ xe, phiếu, chu kỳ hiện có. File không phải bản sao lưu hợp lệ sẽ bị từ chối trước khi xóa bất cứ thứ gì.

## Chạy thử trên máy, kiểm thử

Xem [SETUP.md](SETUP.md#local-development) (lệnh giống hệt): `npm run preview`, `npx tsc --noEmit && npm test`, và e2e bằng Playwright (`e2e/run.mjs` tiếng Việt, `e2e/smoke-en.mjs` tiếng Anh).

## Đổi schema hoặc danh mục linh kiện

Không sửa migration cũ. Thêm `migrations/000N_ten.sql` rồi `npm run db:migrate`. Thêm linh kiện mặc định: sửa `src/lib/parts.ts` **và** thêm migration (`INSERT OR IGNORE INTO part_types …` + bổ sung `rules`); `npm test` báo lỗi nếu quên.

## Giới hạn gói miễn phí cần biết

100.000 yêu cầu/ngày và **10 ms CPU mỗi yêu cầu** (thời gian chờ database/AI không tính). Nếu có nhiều dữ liệu mà gặp lỗi 1102 của Cloudflare (vượt CPU), gói Workers Paid ($5/tháng) nâng giới hạn đáng kể. Cron chạy mỗi giờ (24 lần/ngày) để tôn trọng giờ nhắc và múi giờ của bạn.

## Khi gặp sự cố

- **Báo thiếu `SESSION_SECRET`** sau khi đăng nhập: đặt `SESSION_SECRET` (rồi deploy lại hoặc chạy lại với `--secrets-file`).
- Mở **`/api/health`** (đã đăng nhập) để xem cấu hình nào đã có và database có phản hồi không.
- **Quét phiếu báo chưa có khóa AI**: đặt một trong các secret khóa AI.
- **Thử Telegram lỗi**: thông báo nêu đúng vấn đề (token, chat id, chưa bấm Start với bot).
- **Deploy bị treo**: đừng đặt tên script npm là `deploy` trong repo này — Wrangler/OpenNext xử lý riêng tên đó (vì vậy script tên `release`).
