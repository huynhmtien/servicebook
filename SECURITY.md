# Security policy

## Reporting a vulnerability
Please **do not** post vulnerability details publicly. Use *Security → Report a vulnerability* (private reporting) on this repository's GitHub page. You'll get a reply within a few days.

## Scope
ServiceBook is self-hosted: everyone runs their own copy in their own Cloudflare account. Data, passwords and API keys live in the deployer's account — there is no central server.

## Recommendations for deployers
- Always set `APP_PASSWORD` and `SESSION_SECRET` (see [SETUP.md](SETUP.md)); without a password anyone who knows the URL can read and edit the data.
- Set `APP_PASSWORD`, `SESSION_SECRET` and `CRON_SECRET` with `wrangler secret put` or `--secrets-file`, never in files you commit. API keys can be pasted into Settings → Integrations & API keys: they are stored AES-GCM-encrypted (key derived from `SESSION_SECRET`), shown only as a masked tail, and cannot be saved unless the app is password-protected. Rotating `SESSION_SECRET` makes saved keys unreadable — paste them again.
- Receipt photos are not stored, but they are sent to the AI provider you configure (Gemini, DeepSeek or Anthropic) to be read — pick one whose terms you accept.
- Keep dependencies up to date (Dependabot is enabled in this repository).
- Download backups regularly (Settings → Backup) and keep them somewhere private: they contain all your vehicle and spending data.
