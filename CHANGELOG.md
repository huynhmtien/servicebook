# Changelog

## 1.2.0 — 2026-11-23
- **API keys entered in the app**: Settings → *Integrations & API keys* (Gemini / Anthropic / DeepSeek, Telegram token + chat id). Stored AES-GCM-encrypted in D1 (key derived from `SESSION_SECRET`), shown only as a masked tail, validated before saving, and only allowed when the app is password-protected. A Worker secret still takes priority (migration 0006).
- Quick-start checklist now includes adding an AI key.
- Fix: notices now work with redirects that carry a `#fragment`.
- React / react-dom 19.3.1, GitHub Actions bumps.

## 1.1.0 — 2026-11-23
- **International**: English and Vietnamese UI (typed dictionaries, plurals; add a language with one file); currency in minor units (any ISO currency); kilometers or miles; configurable tax label and time zone; locale-aware numbers and dates. Settings page; first-run defaults come from the browser.
- **Part catalog** with stable keys and bilingual names/keywords (English + Vietnamese); categories stored as keys (migration 0004).
- **Vehicle fuel type** (diesel / petrol / hybrid / electric) switches off parts that don't apply; default intervals are converted when using miles (migration 0005).
- **Backup restore** (with integrity checks before anything is deleted) and **CSV export**.
- **Telegram**: update the odometer by texting the bot (signed webhook), odometer nudge after 14 days, reminders honor your hour and time zone (cron now hourly).
- AI prompts are language-neutral (receipts in any language); amounts support decimals.
- Docs in English first (README, SETUP) with Vietnamese versions; comments translated to English.
- Fixes: number input accepts both `48,500` and `48.500`; a language-independent marker for initial-data slips.

## 1.0.0 — 2026-11-23
- Chạy trên Cloudflare Workers + D1 (OpenNext), cron nhắc việc bằng Cron Trigger; không còn Vercel/Postgres/Docker.
- Không lưu ảnh phiếu: ảnh chỉ gửi cho AI đọc rồi bỏ; bản nháp quét dở tự xóa sau 7 ngày.
- Đăng nhập HMAC + `SESSION_SECRET`, khóa tạm sau 8 lần sai, so sánh an toàn thời gian.
- Gộp truy vấn N+1 khi tính hạn bảo dưỡng; thêm index; nút sao lưu JSON.
- Quét phiếu bằng Gemini / DeepSeek / Claude (gọi qua `fetch`); phân loại nhiều lớp, VAT/giảm giá, tra cứu chu kỳ bằng AI.
