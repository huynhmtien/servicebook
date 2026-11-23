# Changelog

## 1.3.0 — 2026-11-23
- **UI/UX and accessibility pass** (login to every screen, light and dark, phone and desktop): axe-core WCAG 2.2 AA violations went from dozens to zero on 36 page/theme/viewport combinations.
  - Contrast: separate button-fill and text/icon accent colors (≥ 4.5:1 in both themes); active tab label readable; native controls follow the theme (`color-scheme`).
  - Touch targets ≥ 44px for back links, interval rows, remove buttons and segmented controls; tab labels 11px; links inside running text are underlined.
  - Login: show/hide password toggle (paste and password managers stay enabled). Skip-to-content link; error notices are announced (`role="alert"`); completed checklist steps are readable by screen readers (no more strike-through).
  - Vehicle page: the repeated "generic default" badge on every part is gone (explained once; only AI / manual / user-set intervals are labeled). Consistent file-input styling. Wider column on desktop.
- **Custom domain support** in `npm run release` via `SERVICEBOOK_DOMAIN` (and optional `SERVICEBOOK_DISABLE_WORKERS_DEV=1`); nothing account-specific is stored in the repo. English messages in the release script.
- `npm run audit:ui` (e2e/ui-audit.mjs): screenshots + axe + touch-target and overflow checks for every screen.

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
