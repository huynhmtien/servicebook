# Security policy

## Reporting a vulnerability
Please **do not** post vulnerability details publicly. Use *Security → Report a vulnerability* (private reporting) on this repository's GitHub page. You'll get a reply within a few days.

## Scope
ServiceBook is self-hosted: everyone runs their own copy in their own Cloudflare account. Data, passwords and API keys live in the deployer's account — there is no central server.

## Recommendations for deployers
- Always set `APP_PASSWORD` and `SESSION_SECRET` (see [SETUP.md](SETUP.md)); without a password anyone who knows the URL can read and edit the data.
- Set secrets with `wrangler secret put` or `--secrets-file`, never in files you commit.
- Receipt photos are not stored, but they are sent to the AI provider you configure (Gemini, DeepSeek or Anthropic) to be read — pick one whose terms you accept.
- Keep dependencies up to date (Dependabot is enabled in this repository).
- Download backups regularly (Settings → Backup) and keep them somewhere private: they contain all your vehicle and spending data.
