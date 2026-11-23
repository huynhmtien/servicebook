// Safe deploy. Usage: `npm run release` (build + migrate + deploy) or `npm run db:migrate` (migrate only).
// - Only deploys the Worker named "servicebook" (avoids overwriting another project in the same account).
// - The real database_id is NOT in the repo: set the SERVICEBOOK_D1_ID environment variable (the id printed by `wrangler d1 create servicebook`),
//   or edit wrangler.jsonc in place on your machine (don't commit).
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PLACEHOLDER = "REPLACE_WITH_YOUR_D1_ID";
const raw = readFileSync("wrangler.jsonc", "utf8");
const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
if (cfg.name !== "servicebook") { console.error(`Từ chối: wrangler.jsonc đang có name="${cfg.name}", phải là "servicebook".`); process.exit(1); }

const id = process.env.SERVICEBOOK_D1_ID;
const inFile = String(cfg.d1_databases?.[0]?.database_id);
if (!id && inFile === PLACEHOLDER) {
  console.error("Chưa có database_id: đặt SERVICEBOOK_D1_ID=<mã> (xem HUONG-DAN.md, bước 2) rồi chạy lại.");
  process.exit(1);
}
let config = "wrangler.jsonc";
if (id) { config = "wrangler.deploy.jsonc"; writeFileSync(config, raw.replace(PLACEHOLDER, id)); }

const sh = (args) => { const r = spawnSync("npx", args, { stdio: "inherit" }); if (r.status) { cleanup(); process.exit(r.status); } };
const cleanup = () => { if (id) rmSync(config, { force: true }); };

const migrate = () => sh(["wrangler", "d1", "migrations", "apply", "servicebook", "--remote", "--config", config]);
const extra = process.argv.slice(2); // e.g. --secrets-file secrets.env (forwarded to wrangler deploy)
if (extra[0] === "migrate") migrate();
else {
  sh(["opennextjs-cloudflare", "build"]);
  migrate();
  sh(["wrangler", "deploy", "--config", config, ...extra]);
}
cleanup();
