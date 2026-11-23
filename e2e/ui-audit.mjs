// UI audit: screenshots of every screen (phone light/dark + desktop) + axe-core (WCAG 2.2 AA + best practices) + touch-target and overflow checks.
// Needs a running app with an EMPTY database. Usage:
//   BASE=http://localhost:8787 APP_PASSWORD=... OUT=./ui-audit [LANG_TAG=en-US] [CHROMIUM=/path] node e2e/ui-audit.mjs
// It creates sample data through the UI, so run it against a local/disposable database only.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(process.env.PW_MODULE || process.cwd() + "/node_modules/");
const { chromium } = require("playwright");
const axeSrc = fs.readFileSync(process.env.AXE || process.cwd() + "/node_modules/axe-core/axe.min.js", "utf8");
const BASE = process.env.BASE || "http://localhost:8787", OUT = process.env.OUT || "./ui-audit";
const PASSWORD = process.env.APP_PASSWORD;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const LANG = process.env.LANG_TAG || "en-US";

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  if (PASSWORD) { await page.fill("#password", PASSWORD); await page.click("button.primary"); }
  if (PASSWORD) await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}
// dữ liệu mẫu
{
  const ctx = await browser.newContext({ locale: LANG, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); await login(page);
  await page.goto(BASE + "/vehicles", { waitUntil: "networkidle" });
  await page.fill("#name", "Family SUV"); await page.fill("#plate", "51K-123.45"); await page.fill("#model", "Toyota Fortuner"); await page.fill("#year", "2021"); await page.fill("#odo", "48500"); await page.selectOption("#fuel", "diesel");
  await page.click("button.primary"); await page.waitForURL(/setup/);
  const oil = await page.$eval('input[aria-label^="Replacement date for Engine oil"], input[aria-label^="Ngày thay Dầu động cơ"]', (e) => e.name.split("_")[1]);
  await page.fill(`input[name=date_${oil}]`, "2026-01-10"); await page.fill(`input[name=km_${oil}]`, "41000");
  await page.click("button.primary"); await page.waitForURL(/\/vehicles\/1(\?|$)/);
  await page.goto(BASE + "/records/new?manual=1", { waitUntil: "networkidle" });
  await page.fill("#garage", "Main Street Auto"); await page.fill("#date", "2026-09-20"); await page.fill("#odo", "49500");
  await page.fill("#name_0", "Engine oil 0W20"); await page.fill("#amount_0", "800000"); await page.fill("#name_1", "Labor"); await page.fill("#amount_1", "150000");
  await page.click("button.primary:has-text('Save slip'), button.primary:has-text('Lưu phiếu')"); await page.waitForURL(/\/records\/\d+/);
  await ctx.close();
}
const PAGES = [["login", "/login", false], ["home", "/", true], ["vehicles", "/vehicles", true], ["vehicle", "/vehicles/1", true], ["setup", "/vehicles/1/setup", true], ["new-record", "/records/new", true], ["manual", "/records/new?manual=1", true], ["history", "/records", true], ["record", "/records/1", true], ["costs", "/compare", true], ["costs-part", "/compare?part=2", true], ["settings", "/settings", true]];
const CTX = [["m-light", { width: 390, height: 844 }, "light"], ["m-dark", { width: 390, height: 844 }, "dark"], ["d-light", { width: 1280, height: 800 }, "light"]];
const summary = {};
for (const [cn, vp, scheme] of CTX) {
  const ctx = await browser.newContext({ locale: LANG, viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await login(page);
  for (const [name, url, auth] of PAGES) {
    if (name === "login") { const c2 = await browser.newContext({ locale: LANG, viewport: vp, colorScheme: scheme }); const p2 = await c2.newPage(); await p2.goto(BASE + "/login", { waitUntil: "networkidle" }); await audit(p2, name, cn); await c2.close(); continue; }
    await page.goto(BASE + url, { waitUntil: "networkidle" }); await page.waitForTimeout(300);
    await audit(page, name, cn);
  }
  await ctx.close();
}
async function audit(page, name, cn) {
  await page.screenshot({ path: `${OUT}/${name}-${cn}.png`, fullPage: true });
  await page.evaluate(axeSrc);
  const res = await page.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((x) => x.target.join(" ")) })));
  const extra = await page.evaluate(() => {
    const small = [...document.querySelectorAll("a,button,select,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),summary")].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && (r.height < 40 || r.width < 24); }).map((e) => `${e.tagName.toLowerCase()}${e.className ? "." + String(e.className).split(" ")[0] : ""}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}:${(e.innerText || e.getAttribute("aria-label") || e.name || "").slice(0, 20)}`);
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, small: small.slice(0, 8), h1: document.querySelectorAll("h1").length, main: !!document.querySelector("main"), lang: document.documentElement.lang };
  });
  summary[`${name}@${cn}`] = { axe: res, ...extra };
}
fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 1));
for (const [k, v] of Object.entries(summary)) {
  const bits = [];
  if (v.axe.length) bits.push("AXE " + v.axe.map((a) => `${a.id}(${a.impact},${a.n}):${a.t[0]}`).join(" | "));
  if (v.overflow > 1) bits.push(`OVERFLOW ${v.overflow}px`);
  if (v.small.length) bits.push("SMALL " + v.small.join(", "));
  if (v.h1 !== 1) bits.push(`H1×${v.h1}`);
  if (!v.main) bits.push("NO <main>");
  console.log(`${k}: ${bits.length ? bits.join("  ‖  ") : "ok"}`);
}
await browser.close();

const bad = Object.values(summary).filter((v) => v.axe.length || v.overflow > 1).length;
console.log(bad ? `\n${bad} page/theme combination(s) with problems` : "\nNo accessibility violations or horizontal overflow found");
process.exit(bad ? 1 : 0);
