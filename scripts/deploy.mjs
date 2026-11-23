// Safe deploy. Usage: `npm run release` (build + migrate + deploy) or `npm run db:migrate` (migrate only).
// - Only deploys the Worker named "servicebook" (avoids overwriting another project in the same account).
// - Nothing account-specific is stored in the repo. Set these on YOUR machine (shell profile / CI secret):
//     SERVICEBOOK_D1_ID    required  the id printed by `wrangler d1 create servicebook`
//     SERVICEBOOK_DOMAIN   optional  custom domain to serve the app on, e.g. cars.example.com
//                                    (the domain's DNS must already be in your Cloudflare account)
//     SERVICEBOOK_DISABLE_WORKERS_DEV=1  optional  turn off the *.workers.dev address once your domain works
//   (or edit wrangler.jsonc in place on your machine and don't commit it).
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const cfg = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
if (cfg.name !== "servicebook") { console.error(`Refusing to deploy: wrangler.jsonc has name="${cfg.name}", it must be "servicebook".`); process.exit(1); }

const id = process.env.SERVICEBOOK_D1_ID;
if (!id && !cfg.d1_databases?.[0]?.database_id) {
  console.error("No database id: set SERVICEBOOK_D1_ID=<id> (see SETUP.md, step 2) and run again.");
  process.exit(1);
}
const domain = (process.env.SERVICEBOOK_DOMAIN ?? "").trim().toLowerCase();
if (domain && !/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
  console.error(`SERVICEBOOK_DOMAIN="${domain}" is not a valid host name (use e.g. cars.example.com, without https:// or a path).`);
  process.exit(1);
}

// Build the effective config in a temporary file (never committed): real D1 id, optional custom domain.
let config = "wrangler.jsonc";
const effective = structuredClone(cfg);
if (id) effective.d1_databases[0].database_id = id;
if (domain) effective.routes = [{ pattern: domain, custom_domain: true }];
if (process.env.SERVICEBOOK_DISABLE_WORKERS_DEV === "1") effective.workers_dev = false;
if (id || domain || effective.workers_dev === false) { config = "wrangler.deploy.jsonc"; writeFileSync(config, JSON.stringify(effective, null, 2)); }

const cleanup = () => { if (config !== "wrangler.jsonc") rmSync(config, { force: true }); };
const sh = (args) => { const r = spawnSync("npx", args, { stdio: "inherit" }); if (r.status) { cleanup(); process.exit(r.status); } };

const migrate = () => sh(["wrangler", "d1", "migrations", "apply", "servicebook", "--remote", "--config", config]);
const extra = process.argv.slice(2); // e.g. --secrets-file secrets.env (forwarded to wrangler deploy); or: migrate | dry-run
if (extra[0] === "migrate") migrate();
else if (extra[0] === "print-config") console.log(JSON.stringify(effective, null, 2));
else {
  sh(["opennextjs-cloudflare", "build"]);
  migrate();
  sh(["wrangler", "deploy", "--config", config, ...extra]);
}
cleanup();
