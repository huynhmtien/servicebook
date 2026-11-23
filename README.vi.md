# ServiceBook — Sổ bảo dưỡng xe

[![CI](https://github.com/huynhmtien/servicebook/actions/workflows/ci.yml/badge.svg)](https://github.com/huynhmtien/servicebook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Sổ bảo dưỡng ô tô tự host.** Báo hạng mục nào sắp/đã tới hạn (theo km **hoặc** thời gian, cái nào tới trước), đọc phiếu bảo dưỡng bằng AI để bạn khỏi gõ tay, theo dõi chi phí và so sánh giá giữa các garage. Chạy **miễn phí** trên Cloudflare Workers + D1 trong tài khoản của chính bạn — không cần máy chủ, dữ liệu là của bạn.

🇬🇧 [English](README.md) · 📖 [Hướng dẫn cài đặt](HUONG-DAN.md) · [Setup guide](SETUP.md)

## Tính năng

- **Bảng tổng quan cảnh báo**: đỏ (quá hạn) / vàng (sắp tới) / xanh (ổn), kèm ngày dự kiến tới hạn theo mức bạn thực sự chạy mỗi ngày.
- **Chu kỳ theo từng linh kiện** (khoảng 30 hạng mục có sẵn, chỉnh được theo từng xe). Mặc định là mức chung — thay bằng số của hãng bằng cách để AI tra cứu trên web (có nguồn, bạn duyệt từng dòng) hoặc chụp bảng bảo dưỡng trong sổ hướng dẫn.
- **Quét phiếu**: chụp/tải phiếu (bất kỳ ngôn ngữ); AI điền garage, ngày, km, các dòng và tiền; bạn kiểm tra rồi lưu. **Ảnh không bao giờ được lưu** — chỉ gửi cho nhà cung cấp AI bạn chọn để đọc rồi bỏ.
- **Chi phí & so sánh giá** theo linh kiện, theo garage, kèm xu hướng.
- **Nhắc qua Telegram**: tổng hợp hằng ngày vào giờ bạn chọn, báo ngay khi có mục tới hạn, nhắc khi ODO lâu chưa cập nhật — và bạn có thể **cập nhật ODO bằng cách nhắn cho bot** (`52000`).
- **Quốc tế**: giao diện tiếng Anh và tiếng Việt (thêm ngôn ngữ chỉ cần thêm một file), mọi loại tiền ISO (có số lẻ), km hoặc dặm, tên thuế (VAT/GST…) và múi giờ tùy chọn.
- **Dữ liệu của bạn**: sao lưu JSON **và khôi phục** một chạm, xuất CSV mọi phiếu.
- **Loại xe**: diesel / xăng / hybrid / điện tự tắt những linh kiện không áp dụng.
- Cài được lên điện thoại (PWA), có mật khẩu.

## Cách tính tới hạn

- Hạn theo km = km lần thay cuối + chu kỳ km; hạn theo thời gian = ngày thay cuối + chu kỳ tháng. **Cái nào tới trước thì tính.**
- **Sắp tới**: còn ≤ 15% chu kỳ km (tối thiểu 500) hoặc ≤ 30 ngày. **Quá hạn**: ≤ 0.
- Cảnh báo theo km chỉ đúng khi ODO được cập nhật: nhập trong app, qua mỗi phiếu, hoặc nhắn cho bot Telegram.

## Cài đặt nhanh

Cần Node 22+ và tài khoản Cloudflare miễn phí. Chi tiết ở **[HUONG-DAN.md](HUONG-DAN.md)**:

```bash
npm ci
npx wrangler login
npx wrangler d1 create servicebook            # in ra database_id
export SERVICEBOOK_D1_ID=<database_id>
# đặt APP_PASSWORD, SESSION_SECRET, CRON_SECRET (+ một khóa AI) vào secrets.env, rồi:
npm run release -- --secrets-file secrets.env
```

## Cấu hình

Bí mật (secret của Worker / `.dev.vars` khi chạy thử — xem [`.dev.vars.example`](.dev.vars.example)): `APP_PASSWORD` + `SESSION_SECRET` (đăng nhập), `CRON_SECRET`, một trong `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.

Tùy chọn (trong app, mục **Cài đặt**): ngôn ngữ, tiền tệ, đơn vị quãng đường, tên thuế, múi giờ, giờ nhắc hằng ngày.

## Quyền riêng tư & bảo mật

- Ảnh phiếu **không được lưu**; chỉ gửi cho nhà cung cấp AI bạn chọn (Google Gemini, DeepSeek hoặc Anthropic) để đọc. Hãy chọn nhà cung cấp có điều khoản bạn chấp nhận.
- Dữ liệu nằm trong database D1 **của bạn**. Tải sao lưu định kỳ (Cài đặt → Sao lưu).
- Luôn đặt `APP_PASSWORD` và `SESSION_SECRET`: không có thì ai biết địa chỉ cũng xem và sửa được dữ liệu.
- Báo lỗ hổng riêng tư: xem [SECURITY.md](SECURITY.md).

## Phát triển, đóng góp, giấy phép

Xem [README.md](README.md#development) (tiếng Anh) và [CONTRIBUTING.md](CONTRIBUTING.md). Giấy phép [MIT](LICENSE). Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md).
