# Contributing

Thanks for helping! The app is small on purpose: single owner, self-hosted, runs on Cloudflare's free tier.

1. `npm ci`, then `npm run types` (generates Cloudflare binding types).
2. Before opening a PR, `npx tsc --noEmit` and `npm test` must be clean (CI also runs a production build).
3. **Schema changes**: add a new `migrations/000N_name.sql`; never edit an old migration. **Default parts**: edit `src/lib/parts.ts` *and* add an `INSERT OR IGNORE` migration — `npm test` fails if you forget.
4. **Texts**: every user-visible string goes through `t("key")`. Add the key to `src/lib/i18n/en.ts` (source of truth) **and** `vi.ts`; `npm test` verifies all languages have every key and the same `{placeholders}`. Never hard-code UI text, money or date formats — use `fmt.money()`, `fmt.date()`, `fmt.dist()`.
5. **Bug fixes** should come with a check in `e2e/smoke-en.mjs` (or `e2e/run.mjs` for Vietnamese flows). See [SETUP.md](SETUP.md#running-the-end-to-end-tests) for how to run them.
6. Never commit secrets, real receipt photos, or personal data. Report security issues privately — see [SECURITY.md](SECURITY.md).

Commit messages: short imperative subject; explain *why* in the body when it isn't obvious.
