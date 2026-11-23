# Setup guide

ServiceBook runs entirely on Cloudflare — **Workers** (web), **D1** (data), **Cron Triggers** (reminders) — in your own account, on the free plan. No server, no Docker.

You need: Node 22+, a Cloudflare account, and (optional) an AI key and a Telegram bot.

## 1. Install and sign in

```bash
npm ci
npx wrangler login
```

## 2. Create the database

```bash
npx wrangler d1 create servicebook        # prints a database_id
export SERVICEBOOK_D1_ID=<the database_id>
```

The id is **not** stored in the repository. `npm run release` substitutes it from `SERVICEBOOK_D1_ID` (or you can edit `wrangler.jsonc` locally and not commit it).

## 3. Prepare secrets

Create `secrets.env` (never commit it — `*.env` is git-ignored). Only three values are needed here:

```
APP_PASSWORD=choose-a-strong-password
SESSION_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 24>
```

**AI and Telegram keys are entered later in the app** (Settings → *Integrations & API keys*): paste them in, no command line. They are stored encrypted in your database (AES-GCM, key derived from `SESSION_SECRET`) and are never shown again — only a masked tail like `••••2345`. This works only when `APP_PASSWORD` and `SESSION_SECRET` are set. If you prefer, you can still set them as Worker secrets (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`); a Worker secret always wins over a key saved in the app.

Where to get the keys:
- **Gemini key**: https://aistudio.google.com/apikey (free tier available). Anthropic: https://console.anthropic.com. DeepSeek: https://platform.deepseek.com.
- **Telegram**: talk to **@BotFather**, `/newbot`, copy the token. Send any message to your new bot, then ask **@userinfobot** for your numeric id → `TELEGRAM_CHAT_ID`.

## 4. Deploy

```bash
npm run release -- --secrets-file secrets.env
```

This builds, applies the database migrations, and deploys the Worker named `servicebook`. Later deployments only need `npm run release` (existing secrets are kept).

Your app is at `https://servicebook.<your-subdomain>.workers.dev`. To use your own domain, see [Use your own domain](#use-your-own-domain).

## Use your own domain

A Worker can only be attached to a domain whose DNS is hosted **in your Cloudflare account** (free plan is fine). A subdomain such as `cars.example.com` cannot be attached if `example.com`'s DNS lives at another provider. Two ways to get a suitable domain:

- **Register a new domain with Cloudflare Registrar** (sold at cost; DNS is already on Cloudflare), or
- **Add an existing domain to Cloudflare** (Cloudflare dashboard → Add a domain, then change the nameservers at your registrar). Before switching, make sure Cloudflare imported *every* existing record (website, mail/MX, other subdomains) — changing nameservers moves all of them.

Then, on your machine:

```bash
export SERVICEBOOK_DOMAIN=cars.example.com      # host name only, no https://
npm run release
```

Cloudflare creates the DNS record and the HTTPS certificate automatically (a few minutes). Afterwards:
1. Sign in at the new address (cookies are per-domain, so you sign in again).
2. If you use Telegram replies: Settings → *Enable Telegram replies* again (the webhook address changed).
3. Optional: `export SERVICEBOOK_DISABLE_WORKERS_DEV=1` and release once more to switch the `*.workers.dev` address off.

## 5. First steps in the app

1. Sign in with `APP_PASSWORD`.
2. **Settings** → choose language, currency, distance unit, tax label, time zone and the daily reminder hour, then **Save** (the home checklist marks this step done).
3. **Vehicles** → add your car (pick the fuel type), then enter the last replacement of each part you remember.
4. **Add slip** → photograph an invoice, review, save.
5. **Keys**: Settings → *Integrations & API keys* → paste a Gemini (or Anthropic/DeepSeek) key to read receipts, and the Telegram bot token + chat id for reminders.
6. **Telegram** (optional): Settings → *Check & send test message*; then *Enable Telegram replies* so you can text the bot a number (e.g. `52000`) to update the odometer.

## Updating the intervals to your car's real values

On the vehicle page: *Look up … (AI web search)* proposes the manufacturer's schedule with sources, or photograph the maintenance table in the owner's manual. You approve each line; nothing is applied automatically.

## Backup and restore

Settings → **Download backup** (JSON) and **Export slips (CSV)**. To restore on any ServiceBook instance: Settings → *Restore from backup* → choose the file. Restore **replaces** all current vehicles, slips and intervals. A file that isn't a valid backup is rejected before anything is deleted.

## Local development

```bash
cp .dev.vars.example .dev.vars          # fill in values
npx wrangler d1 migrations apply servicebook --local
npm run preview                         # http://localhost:8787 (same runtime as production)
npm run dev                             # Next dev server (faster reloads; secrets in .env.local)
npx tsc --noEmit && npm test
```

### Running the end-to-end tests

They need Playwright and Chromium (`npm i -D playwright && npx playwright install chromium`, or set `PW_MODULE` / `CHROMIUM` to an existing install).

```bash
node e2e/mock-services.mjs &            # fake Telegram + Gemini on :5599
# .dev.vars: APP_PASSWORD, SESSION_SECRET, CRON_SECRET, GEMINI_API_KEY=fake, TELEGRAM_BOT_TOKEN=123:abc, TELEGRAM_CHAT_ID=42,
#            TELEGRAM_API_BASE=http://localhost:5599, GEMINI_API_BASE=http://localhost:5599
npx wrangler d1 migrations apply servicebook --local   # EMPTY database each run (rm -rf .wrangler/state first)
npm run preview &
BASE=http://localhost:8787 MOCK=http://localhost:5599 APP_PASSWORD=<same> node e2e/smoke-en.mjs   # English / international
E2E_LOCALE=vi-VN BASE=... APP_PASSWORD=... node e2e/run.mjs                                       # Vietnamese (use a fresh DB)
```

## Changing the schema or the part catalog

Never edit an old migration. Add `migrations/000N_name.sql` and run `npm run db:migrate`. To add a default part: edit `src/lib/parts.ts` **and** add a migration (`INSERT OR IGNORE INTO part_types …` + backfill `rules`); `npm test` fails if you forget.

## Free-plan limits worth knowing

100,000 requests/day and **10 ms CPU per request** (time spent waiting for the database or AI does not count). If you ever see Cloudflare error 1102 (CPU limit) with a lot of data, the Workers Paid plan ($5/month) raises it substantially. The cron runs hourly (24 invocations/day) to honor your reminder hour and time zone.

## Troubleshooting

- **"Missing SESSION_SECRET"** after login: set `SESSION_SECRET` (and redeploy, or re-run with `--secrets-file`).
- **Open `/api/health`** (signed in) to see which settings are present and whether the database responds.
- **Scanning says no AI key**: paste one in Settings → Integrations & API keys.
- **Telegram test fails**: the message names the exact problem (token, chat id, bot not started).
- **Deploy hangs**: don't name an npm script `deploy` in this repo — Wrangler/OpenNext treat it specially (that is why the script is `release`).
