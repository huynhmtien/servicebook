// Deploy an toàn. Dùng: `npm run release` (build + migrate + deploy) hoặc `npm run db:migrate` (chỉ migrate).
// - Chỉ deploy Worker tên "servicebook" (tránh ghi nhầm sang project khác trong cùng tài khoản).
// - database_id thật KHÔNG nằm trong repo: đặt biến môi trường SERVICEBOOK_D1_ID (mã in ra bởi `wrangler d1 create servicebook`),
//   hoặc sửa tại chỗ wrangler.jsonc trên máy bạn (đừng commit).
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
const extra = process.argv.slice(2); // vd: --secrets-file secrets.env (chuyển tiếp cho wrangler deploy)
if (extra[0] === "migrate") migrate();
else {
  sh(["opennextjs-cloudflare", "build"]);
  migrate();
  sh(["wrangler", "deploy", "--config", config, ...extra]);
}
cleanup();
