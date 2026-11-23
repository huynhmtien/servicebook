# ServiceBook

[![CI](https://github.com/huynhmtien/servicebook/actions/workflows/ci.yml/badge.svg)](https://github.com/huynhmtien/servicebook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A self-hosted maintenance log for your cars.** It tells you what is due (by distance **or** time, whichever comes first), reads service receipts with AI so you don't type them, tracks what you spend, and compares prices between garages. It runs **for free** on Cloudflare Workers + D1, in your own account — no server to manage, and your data stays yours.

🇻🇳 [Tiếng Việt](README.vi.md) · 📖 [Setup guide](SETUP.md) · [Hướng dẫn cài đặt](HUONG-DAN.md)

## Features

- **Due-date dashboard** — red (overdue), yellow (due soon), green (ok), with a predicted due date based on how much you actually drive.
- **Per-part intervals** (about 30 built-in parts, editable per vehicle). Defaults are generic: replace them with your manufacturer's numbers by letting AI search the web (with sources, you approve each line) or by photographing the table in the owner's manual.
- **Receipt scanning** — photograph or upload a service invoice (any language); the AI fills in garage, date, odometer, line items and amounts; you review and save. **The photo is never stored** — it is sent to the AI provider you configured and then discarded.
- **Costs & price comparison** — per part, per garage, with trends.
- **Reminders via Telegram** — daily summary at the hour you choose, instant alerts when something becomes due, a nudge when the odometer is stale — and you can **update the odometer just by texting the bot** (`52000`).
- **International** — English and Vietnamese UI (add a language by adding one file), any ISO currency (with cents), kilometers or miles, your own tax label (VAT / GST / sales tax) and time zone.
- **Your data, your control** — one-click JSON backup **and restore**, CSV export of all slips.
- **Vehicle types** — diesel / petrol / hybrid / electric presets switch off parts that don't apply.
- **Installable on your phone** (PWA) and password-protected.

## How due dates work

- Due by distance = odometer at last replacement + interval; due by time = date of last replacement + interval in months. **Whichever comes first applies.**
- **Due soon**: within 15% of the distance interval (at least 500) or within 30 days. **Overdue**: ≤ 0.
- Distance alerts are only accurate if the odometer is kept up to date — update it in the app, with each slip, or by texting the Telegram bot.

## Quick start

Requires Node 22+ and a free Cloudflare account. Full steps in **[SETUP.md](SETUP.md)**; the short version:

```bash
npm ci
npx wrangler login
npx wrangler d1 create servicebook            # prints database_id
export SERVICEBOOK_D1_ID=<database_id>
# put APP_PASSWORD, SESSION_SECRET, CRON_SECRET (+ an AI key) in secrets.env, then:
npm run release -- --secrets-file secrets.env
```

Open `https://servicebook.<your-subdomain>.workers.dev` (or [your own domain](SETUP.md#use-your-own-domain)), sign in, and follow the quick-start checklist on the home screen.

## Configuration

Secrets (Worker secrets / `.dev.vars` locally — see [`.dev.vars.example`](.dev.vars.example)). The AI and Telegram keys can instead be **pasted into Settings → Integrations & API keys** (stored encrypted in your database, never shown again); a Worker secret always wins over a key saved in the app.

| Variable | Purpose |
|---|---|
| `APP_PASSWORD` + `SESSION_SECRET` | Turn on login. Set both; strongly recommended since the app has a public URL. |
| `CRON_SECRET` | Protects `/api/cron`, called every hour by the Cron Trigger. |
| `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` | Enable receipt scanning — one is enough. `AI_PROVIDER` picks one when several are set. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Enable Telegram reminders and odometer replies. |

Preferences (in the app, **Settings**): language, currency, distance unit, tax label, time zone, daily reminder hour.

## Privacy & security

- Receipt photos are **not stored**. They are sent to the AI provider you chose (Google Gemini, DeepSeek or Anthropic) only to be read. Choose a provider whose terms you accept.
- API keys pasted into the app are stored **encrypted** (AES-GCM, key derived from `SESSION_SECRET`) and only shown as a masked tail; they can only be saved when the app is password-protected.
- Data lives in **your** Cloudflare D1 database. Download backups regularly (Settings → Backup).
- Always set `APP_PASSWORD` and `SESSION_SECRET`: without them anyone who knows the URL can read and edit your data. Sessions are signed (HMAC), logins are rate-limited, comparisons are constant-time.
- Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## Development

```bash
npm ci && npm run types            # generate Cloudflare binding types
npm run dev                        # Next.js dev server with local D1
npm run preview                    # build and run exactly like production (wrangler dev)
npx tsc --noEmit && npm test       # typecheck + unit tests
```

End-to-end tests drive a real browser (Playwright) against a local worker with mocked Telegram/Gemini: `e2e/run.mjs` (Vietnamese flows) and `e2e/smoke-en.mjs` (English / international flows). See [SETUP.md](SETUP.md#running-the-end-to-end-tests).

```
src/lib/rules.ts        due-date logic (pure, unit-tested)
src/lib/i18n/           messages (en.ts is the source of truth), translator with plurals
src/lib/format.ts       money / number / date / distance formatting and parsing
src/lib/settings.ts     app-wide settings (language, currency, units, time zone)
src/lib/db.ts           D1 access layer (all / get / run / insert / batch)
src/lib/extract.ts      receipt reading (Gemini / DeepSeek / Claude via fetch)
src/lib/intervals.ts    interval lookup (AI web search / manual table)
src/lib/backup.ts       backup, restore and CSV export
src/lib/notify.ts       Telegram reminders; src/lib/telegram-bot.ts handles replies
src/lib/parts.ts        part catalog (stable keys, bilingual names and keywords)
src/app/                UI and server actions
migrations/             D1 schema (never edit old migrations — add new ones)
worker.ts               Worker entry (web + cron)
```

## Adding a language

1. Copy `src/lib/i18n/en.ts` to `src/lib/i18n/<code>.ts` and translate every value (keep `{placeholders}`; plurals use `_one` / `_other` keys).
2. Register it in `src/lib/i18n/index.ts` (`LANGS`).
3. Add names and keywords for the part catalog in `src/lib/parts.ts` (`names` and `kw`).
4. Add the new code to the `Record<Lang, …>` tables (TypeScript points out each one: part names/keywords, tax rates for AI).
5. `npm test` checks that every key and placeholder exists.

## License

[MIT](LICENSE) © 2026 TIEN HUYNH. Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Changes: [CHANGELOG.md](CHANGELOG.md).
