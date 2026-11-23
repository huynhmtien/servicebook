# ServiceBook — Sổ bảo dưỡng ô tô

Web app chạy miễn phí trên Cloudflare để quản lý bảo dưỡng xe: nhắc lịch, báo tới hạn linh kiện (theo km **hoặc** thời gian, cái nào tới trước),
quét phiếu bảo dưỡng bằng AI để tự nhập liệu, lưu lịch sử chi phí và so sánh giá giữa các garage.

## Tính năng

- **Dashboard cảnh báo**: đỏ (quá hạn) / vàng (sắp tới) / xanh (ổn), dự kiến ngày tới hạn dựa trên km/ngày thực tế của xe.
- **Chu kỳ theo từng linh kiện** (23 hạng mục ô tô có sẵn, chỉnh được theo từng xe): tính từ lần thay gần nhất.
- **Nhập dữ liệu ban đầu**: khai báo lần thay gần nhất của từng hạng mục khi mới thêm xe.
- **Quét phiếu**: chụp/tải ảnh hoặc PDF phiếu → AI điền sẵn garage, ngày, km, các dòng + tiền → bạn kiểm tra rồi lưu.
  Ảnh chỉ gửi cho AI đọc rồi bỏ — **không lưu ảnh** ở đâu cả, server chỉ giữ số liệu đã trích. Tên hạng mục đã xác nhận được nhớ cho lần sau.
- **So sánh chi phí**: theo linh kiện, giữa các garage (TB/thấp/cao/gần nhất), xu hướng tăng/giảm, cờ “đắt hơn mặt bằng”.
- **Telegram**: tổng hợp cảnh báo hằng ngày + báo ngay khi một hạng mục chuyển sang sắp tới/quá hạn.

> Không rành code? Xem **[HUONG-DAN.md](HUONG-DAN.md)** (hướng dẫn từng bước).

## Cách app xử lý phân loại, VAT và chu kỳ

- **Phân loại linh kiện (4 lớp, lớp trên thắng):** (1) bộ nhớ những gì anh từng xác nhận → (2) AI đọc phiếu, bắt buộc chọn một mục trong danh mục (có cả nhóm “Chi phí khác”: công thợ, rửa xe, phụ phí…) → (3) bộ từ khóa tiếng Việt (`src/lib/parts.ts`) khi AI không chắc → (4) gõ tên ở form nhập tay thì tự gợi ý. Dòng nào gợi ý/AI chưa chắc đều có nhãn vàng để soát.
- **VAT & giảm giá:** mỗi phiếu lưu cộng hạng mục, giảm giá, VAT (cộng thêm hoặc đã gồm trong giá), thuế suất; tổng thanh toán tính đúng và đối chiếu với tổng in trên phiếu. AI bỏ sót VAT mà tổng trên phiếu hơn đúng 5/8/10% thì app tự suy ra. Giá từng dòng để so sánh giữa garage được quy về **trước thuế**.
- **Chu kỳ bảo dưỡng — nguồn gốc con số:** mặc định chỉ là mức tham khảo chung (nhãn “Mặc định chung · chưa xác thực”). Muốn đúng theo xe: (a) **quét bảng bảo dưỡng trong sổ hướng dẫn** (chính xác nhất), hoặc (b) **AI tra cứu web** theo hãng/dòng/năm (Claude `web_search` hoặc Gemini Google Search; DeepSeek không có tìm web), có nguồn, luôn qua bước anh duyệt từng dòng. Mỗi dòng ghi rõ nguồn: Mặc định chung / AI tra cứu / Theo sổ hướng dẫn / Anh tự đặt.

## Giao diện & lên iOS

- Thiết kế mobile-first theo chuẩn iOS (tiêu đề lớn, danh sách nhóm bo góc, thanh tab mờ, vùng chạm ≥ 44pt, chế độ tối, safe-area). Trên màn hình rộng, app hiển thị thành một cột giữa màn hình.
- **PWA**: có manifest + biểu tượng, cài lên Màn hình chính iPhone (Safari → Chia sẻ → Thêm vào Màn hình chính) chạy toàn màn hình.
- **Lên App Store (sau này)**: cần tài khoản Apple Developer (99 USD/năm) và máy Mac. Hướng khả thi là bọc bằng Capacitor trỏ tới địa chỉ web này; lưu ý Apple có thể từ chối app chỉ là "web bọc lại" (guideline 4.2), nên cần thêm tính năng gốc (thông báo đẩy, camera/quét tài liệu, widget). Cho dùng cá nhân thì PWA là đủ.

## Triển khai

Chạy hoàn toàn trên **Cloudflare** (Workers + D1 + Cron Trigger), gói miễn phí, không cần máy chủ. Xem **[HUONG-DAN.md](HUONG-DAN.md)**.

Phát triển: `npm run dev` (D1 giả lập cục bộ) hoặc `npm run preview` (chạy đúng như trên Cloudflare). Test: `npm test`.

**Tự kiểm thử như người dùng thật (E2E):** `e2e/run.mjs` mở trình duyệt khổ điện thoại và bấm qua toàn bộ luồng chính
(đăng nhập, thêm/sửa xe, ODO, chu kỳ, Telegram, quét phiếu → kiểm tra → xóa/thêm dòng → lưu, nhập tay, xóa phiếu, so sánh,
điều hướng, tràn ngang màn hình, lỗi JS). Dùng `e2e/mock-services.mjs` giả lập Telegram và Gemini nên không cần khóa thật:
chạy mock, chạy app với `TELEGRAM_API_BASE`/`GEMINI_API_BASE` trỏ vào mock và DB trống, rồi `npm run e2e`
(cần Playwright; đặt `PW_MODULE` nếu cài ở nơi khác). Mỗi lần sửa lỗi nên thêm một mục kiểm tra vào đây.

## Cấu hình (secret của Worker; chạy thử trên máy thì ghi vào `.dev.vars`, xem `.dev.vars.example`)

| Biến | Ý nghĩa |
|---|---|
| `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` | Bật quét phiếu — chỉ cần một loại. `AI_PROVIDER` để chọn khi có nhiều khóa; đổi model bằng `GEMINI_MODEL`, `DEEPSEEK_MODEL`, `CLAUDE_MODEL` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bật nhắc qua Telegram (thử ở trang Cài đặt) |
| `APP_PASSWORD` + `SESSION_SECRET` | Bật đăng nhập (đặt cả hai; thiếu `SESSION_SECRET` thì app từ chối mọi truy cập). Nên đặt vì app có địa chỉ công khai |
| `CRON_SECRET` | Bảo vệ endpoint nhắc hằng ngày `/api/cron` (Cron Trigger tự gọi lúc 8:00 giờ VN) |
| `APP_TZ` | Múi giờ (mặc định `Asia/Ho_Chi_Minh`) |

## Quy tắc tính tới hạn

- Hạn theo km = km lần thay cuối + chu kỳ km; hạn theo ngày = ngày thay cuối + chu kỳ tháng. **Cái nào tới trước thì tính.**
- **Sắp tới**: còn ≤ 15% chu kỳ km (tối thiểu 500 km) hoặc ≤ 30 ngày. **Quá hạn**: ≤ 0.
- Cảnh báo theo km chỉ đúng khi ODO được cập nhật: nhập ODO mới ở Tổng quan (một chạm) hoặc qua mỗi phiếu.

## Cấu trúc

```
src/lib/rules.ts       tính tới hạn (thuần, có test)
src/lib/db.ts          lớp truy cập D1 (all/get/run/insert/batch)
src/lib/queries.ts     truy vấn nghiệp vụ
src/lib/extract.ts     đọc phiếu bằng AI (Gemini/DeepSeek/Claude, gọi qua fetch)
src/lib/auth.ts        phiên đăng nhập HMAC, so sánh an toàn thời gian
src/lib/notify.ts      logic nhắc Telegram; Cron Trigger gọi api/cron qua worker.ts
src/lib/parts.ts       danh mục linh kiện + chu kỳ mặc định
src/app/               giao diện + server actions
migrations/            schema D1 (npm run db:migrate)
worker.ts              điểm vào Worker (web + cron)
```

## Giấy phép

MIT — xem [LICENSE](LICENSE). Đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md). Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md).

## Bảo mật (repo này công khai)

- **Không bao giờ commit bí mật.** `APP_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET` và các khóa AI/Telegram chỉ đặt bằng `wrangler secret put` hoặc file `.dev.vars` / `secrets.env` (đã nằm trong `.gitignore`). Repo chỉ có `.dev.vars.example` với ô trống.
- **Luôn đặt `APP_PASSWORD` + `SESSION_SECRET`** trước khi mở app ra internet: không có mật khẩu thì ai biết địa chỉ cũng xem và sửa được dữ liệu.
- `database_id` trong `wrangler.jsonc` chỉ là mã định danh, không phải khóa truy cập; muốn dùng cho tài khoản của bạn thì thay bằng ID của database bạn tự tạo (xem [HUONG-DAN.md](HUONG-DAN.md)).
- Ảnh phiếu không được lưu; dữ liệu nằm trong D1 của tài khoản Cloudflare của chủ app. Nên tải sao lưu định kỳ ở trang Cài đặt.
- Phát hiện lỗ hổng: xem [SECURITY.md](SECURITY.md).
