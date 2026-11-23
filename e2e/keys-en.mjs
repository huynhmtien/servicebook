// E2E: enter API keys through the Settings page (nothing in env): validation, encrypted storage, effect on scanning and Telegram.
// Run with an EMPTY database and a worker whose env has NO key secrets (only APP_PASSWORD, SESSION_SECRET, CRON_SECRET and the
// *_API_BASE overrides pointing at e2e/mock-services.mjs).
import { createRequire } from "node:module";
const require = createRequire(process.env.PW_MODULE || "/node-tools/node_modules/");
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:8787", MOCK = process.env.MOCK || "http://localhost:5599";
const results = []; let page;
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  → " + String(detail).slice(0, 300)}`); };
const txt = async (sel = "body") => (await page.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ");
const go = (u) => page.goto(BASE + u, { waitUntil: "networkidle" });
const GEMINI = "AIzaSyFakeFakeFakeFakeFakeFake12345", TOKEN = "123456789:AAFakeFakeFakeFakeFakeFakeFake_12", CHAT = "424242";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
await go("/");
await page.fill("#password", process.env.APP_PASSWORD); await page.click("button.primary");
await page.waitForURL((u) => !u.pathname.startsWith("/login"));

// 1. Trước khi nhập: chưa có AI, chưa có Telegram
await go("/vehicles");
await page.fill("#name", "Test car"); await page.fill("#odo", "1000");
await page.click("button.primary"); await page.waitForURL(/\/vehicles\/\d+\/setup/);
await go("/records/new");
check("Without a key, scanning is unavailable (message shown)", (await txt()).includes("No AI key"));
await go("/settings");
check("Settings shows AI and Telegram as not enabled", (await page.locator(".li .badge.b-soon").count()) >= 2);

// 2. Giá trị sai bị từ chối và KHÔNG lưu gì (kể cả ô đúng)
await page.fill('input[name="GEMINI_API_KEY"]', GEMINI);
await page.fill('input[name="TELEGRAM_BOT_TOKEN"]', "not a real token");
await page.click("button:has-text('Save keys')"); await page.waitForURL(/\/settings\?error=/);
check("A malformed token is rejected with a clear message", (await txt(".flash")).includes("Telegram bot token") && (await txt(".flash")).includes("doesn't look right"), await txt(".flash"));
check("Nothing was saved when one field was wrong", (await txt("#keys + form")).includes("Not set") && !(await txt("#keys + form")).includes("Saved ••••"));

// 3. Nhập khóa đúng
await go("/settings");
await page.fill('input[name="GEMINI_API_KEY"]', `  "${GEMINI}"  `);   // dán kèm khoảng trắng/ngoặc: phải được làm sạch
await page.fill('input[name="TELEGRAM_BOT_TOKEN"]', TOKEN);
await page.fill('input[name="TELEGRAM_CHAT_ID"]', CHAT);
await page.click("button:has-text('Save keys')"); await page.waitForURL(/\/settings\?ok=/);
let card = await txt("#keys + form");
check("Saved: keys shown only as masked tails", card.includes("Saved ••••2345") && card.includes("Saved ••••e_12") && card.includes("Saved ••••4242") && !card.includes(GEMINI) && !card.includes(TOKEN), card);
const html = await page.content();
check("The raw keys are never present in the page HTML", !html.includes(GEMINI) && !html.includes(TOKEN));
check("AI and Telegram rows are now enabled", (await page.locator(".li .badge.b-ok").count()) >= 2);

// 4. Có tác dụng: quét phiếu và Telegram dùng khóa vừa nhập
await go("/records/new");
check("With the saved key, the scan form is available", (await page.locator("button:has-text('Read slip')").count()) === 1);
const shot = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.setInputFiles("#file", { name: "slip.png", mimeType: "image/png", buffer: shot });
await page.click("button:has-text('Read slip')"); await page.waitForURL(/\/scan\/\d+/, { timeout: 60000 });
check("Scanning works using the key saved in the app", (await txt()).includes("Check before saving"), await txt());
await go("/settings");
await page.click("button:has-text('Check & send test message')");
await page.waitForFunction(() => document.body.innerText.includes("Test message sent"), null, { timeout: 15000 });
check("Telegram test works using the token saved in the app", true);
const bodies = await (await fetch(MOCK + "/__bodies")).json();
const sm = bodies.filter((b) => b.url.includes("/sendMessage")).map((b) => JSON.parse(b.body));
check("The message went to the saved chat id", sm.some((m) => String(m.chat_id) === CHAT), JSON.stringify(sm));

// 5. Quên khóa: checkbox Remove xóa hẳn; trang chủ phản ánh
await go("/settings");
await page.check('input[name="clear_GEMINI_API_KEY"]');
await page.click("button:has-text('Save keys')"); await page.waitForURL(/\/settings\?ok=/);
check("Removed key shows as Not set again", (await txt("#keys + form")).includes("Not set"));
await go("/records/new");
check("After removing the only AI key, scanning is unavailable again", (await txt()).includes("No AI key"));

// 6. Cron/trang chủ dùng khóa đã lưu (Telegram còn)
const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const h = await (await fetch(BASE + "/api/health", { headers: { cookie } })).json();
check("/api/health reflects keys saved in the app", h.flags.TELEGRAM === true && h.flags.AI_KEY === false, JSON.stringify(h.flags));

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
