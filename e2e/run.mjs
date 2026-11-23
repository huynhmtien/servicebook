// Tự kiểm thử như người dùng thật (điện thoại). Chạy: node e2e/run.mjs
// Cần: app đang chạy ở BASE (mặc định http://localhost:3111) với DB trống,
//      mock-services đang chạy ở MOCK (http://localhost:5599) và app trỏ TELEGRAM_API_BASE/GEMINI_API_BASE vào đó.
//      Biến: APP_PASSWORD (nếu app bật mật khẩu), PW_MODULE (thư mục node_modules chứa playwright), SHOTS (thư mục lưu ảnh).
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(process.env.PW_MODULE || "/node-tools/node_modules/");
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3111", MOCK = process.env.MOCK || "http://localhost:5599";
const SHOT = process.env.SHOTS || ".";
const results = []; let browser, page;
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  → " + detail}`); };
const txt = async (sel) => (await page.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ");
const flashes = async () => (await page.locator(".flash").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
const go = (u) => page.goto(BASE + u, { waitUntil: "networkidle" });
const mock = async (p) => (await fetch(MOCK + p)).json();
// Bấm rồi chờ đúng nội dung thông báo xuất hiện (không dựa vào URL vì có thể đã trùng từ trước)
const clickWait = async (selector, text) => {
  await page.click(selector);
  await page.waitForFunction((t) => [...document.querySelectorAll(".flash")].some((e) => e.textContent.includes(t)), text, { timeout: 20000 }).catch(() => {});
};
// Tìm dòng linh kiện theo TÊN CHÍNH XÁC (tránh nhầm "Dầu động cơ" với "Lọc dầu động cơ")
const rule = (name) => page.locator(".rule").filter({ has: page.getByText(name, { exact: true }) }).first();
const ruleTxt = async (name) => (await rule(name).innerText().catch(() => "")).replace(/\s+/g, " ");
const overflow = async (label) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`Không tràn ngang màn hình điện thoại: ${label}`, o <= 1, `tràn ${o}px`);
};

browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page = await ctx.newPage();
const jsErrors = []; page.on("pageerror", (e) => jsErrors.push(String(e)));
page.on("dialog", (d) => d.accept());

// 0. Đăng nhập (nếu bật mật khẩu)
if (process.env.APP_PASSWORD) {
  await go("/");
  check("Chưa đăng nhập → chuyển sang trang đăng nhập", page.url().includes("/login"), page.url());
  await page.fill("#password", "sai-mat-khau"); await clickWait("button.primary", "Sai mật khẩu");
  check("Sai mật khẩu → báo lỗi", (await flashes()).includes("Sai mật khẩu"));
  await page.fill("#password", process.env.APP_PASSWORD); await page.click("button.primary"); await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  check("Đúng mật khẩu → vào được app", !page.url().includes("/login"), page.url());
}

// A. Người dùng mới
await go("/");
check("Người dùng mới thấy checklist 'Bắt đầu nhanh'", (await txt("body")).includes("Bắt đầu nhanh"));
await overflow("Tổng quan (trống)");

// B. Thêm xe + dữ liệu ban đầu
await go("/vehicles");
await page.fill("#name", "Fortuner"); await page.fill("#plate", "51K-123.45"); await page.fill("#model", "Toyota Fortuner"); await page.fill("#odo", "48000");
await page.click("button.primary"); await page.waitForURL(/\/vehicles\/\d+\/setup/);
check("Thêm xe → sang trang nhập lần thay ban đầu kèm thông báo", (await flashes()).includes("Đã thêm xe"), await flashes());
const vid = page.url().match(/vehicles\/(\d+)/)[1];
const oilField = await page.$eval('input[aria-label="Ngày thay Dầu động cơ"]', (e) => e.name.split("_")[1]);
const cabField = await page.$eval('input[aria-label="Ngày thay Lọc gió điều hòa"]', (e) => e.name.split("_")[1]);
await page.fill(`input[name=date_${oilField}]`, "2026-04-01"); await page.fill(`input[name=km_${oilField}]`, "41000");
await page.fill(`input[name=date_${cabField}]`, "2025-08-01"); await page.fill(`input[name=km_${cabField}]`, "30000");
await page.click("button.primary"); await page.waitForURL(new RegExp(`/vehicles/${vid}(\\?|$)`));
check("Lưu dữ liệu ban đầu → có thông báo", (await flashes()).includes("Đã lưu lần thay ban đầu"), await flashes());
await overflow("Trang xe");

// C. Sửa thông tin xe & ODO
await page.click("summary:has-text('Sửa thông tin xe')");
await page.fill("#e_name", "Fortuner nhà"); await page.fill("#e_plate", "51K-999.99"); await page.fill("#e_year", "2022");
await clickWait("button:has-text('Lưu thông tin')", "Đã lưu thông tin xe");
check("Sửa thông tin xe: lưu được + có thông báo", (await flashes()).includes("Đã lưu thông tin xe"), await flashes());
check("Sửa thông tin xe: dữ liệu mới hiển thị", (await txt("h1")).includes("Fortuner nhà") && (await txt("body")).includes("51K-999.99"));
await page.fill("input[name=km]", "47500"); await clickWait("button:has-text('Cập nhật')", "Đã chỉnh ODO");
check("Nhập ODO thấp hơn (sửa nhầm) → được chấp nhận + báo rõ", (await txt(".stat")).includes("47.500") && (await flashes()).includes("Đã chỉnh ODO"), `${await txt(".stat")} / ${await flashes()}`);
await page.fill("input[name=km]", "48200"); await clickWait("button:has-text('Cập nhật')", "Đã cập nhật ODO");
check("Nhập ODO cao hơn → cập nhật + báo", (await txt(".stat")).includes("48.200") && (await flashes()).includes("Đã cập nhật ODO"), `${await txt(".stat")} / ${await flashes()}`);
await page.fill("input[name=km]", "abc"); await clickWait("button:has-text('Cập nhật')", "không hợp lệ");
check("Nhập ODO sai (chữ) → báo lỗi, không im lặng", (await flashes()).includes("không hợp lệ"), await flashes());

// D. Chu kỳ
await rule("Lọc nhiên liệu").locator("summary").click();
await rule("Lọc nhiên liệu").locator("input[name^=km_]").fill("35000");
await clickWait("button:has-text('Lưu chu kỳ')", "Đã lưu chu kỳ");
check("Lưu chu kỳ → có thông báo", (await flashes()).includes("Đã lưu chu kỳ"), await flashes());
check("Chu kỳ mới hiển thị (35.000 km)", (await ruleTxt("Lọc nhiên liệu")).includes("35.000 km"), await ruleTxt("Lọc nhiên liệu"));

// E. Telegram (chẩn đoán từng bước)
await mock("/__mode/ok");
await go("/settings");
await page.click("button:has-text('Kiểm tra & gửi tin thử')"); await page.waitForSelector("[role=status]");
let st = await txt("[role=status]");
check("Telegram OK: hiện từng bước và 'Đã gửi tin thử'", st.includes("Bot hợp lệ") && st.includes("Đã gửi tin thử"), st);
await mock("/__mode/badtoken");
await page.click("button:has-text('Kiểm tra & gửi tin thử')"); await page.waitForFunction(() => document.querySelector("[role=status]")?.textContent?.includes("Token bot sai"));
check("Telegram sai token: báo lời khuyên cụ thể", (await txt("[role=status]")).includes("@BotFather"), await txt("[role=status]"));
await mock("/__mode/nochat");
await page.click("button:has-text('Kiểm tra & gửi tin thử')"); await page.waitForFunction(() => document.querySelector("[role=status]")?.textContent?.includes("Start"));
check("Telegram sai chat id/chưa Start: báo lời khuyên cụ thể", (await txt("[role=status]")).includes("Chat ID"), await txt("[role=status]"));
await mock("/__mode/ok");
await page.click("button:has-text('Gửi tổng hợp cảnh báo ngay')"); await page.waitForFunction(() => /Đã gửi tổng hợp|Không có cảnh báo/.test(document.body.textContent));
check("Gửi tổng hợp cảnh báo → có phản hồi", true);
const sent = (await mock("/__log")).filter((l) => l.includes("sendMessage")).length;
check("Telegram giả thực sự nhận được tin nhắn", sent >= 2, `nhận ${sent}`);
await overflow("Cài đặt");

// F. Thêm phiếu bằng ảnh (Gemini giả) → duyệt → phân loại tự động, VAT, xóa dòng → lưu
await mock("/__draft/junk");
await go("/records/new");
check("Trang Thêm phiếu có ô chọn ảnh", (await page.locator("#file").count()) > 0);
await page.setInputFiles("#file", path.resolve("public/icon-192.png"));
await page.click("button:has-text('Đọc phiếu')"); await page.waitForURL(/\/scan\/\d+/, { timeout: 60000 });
check("Đọc phiếu → sang màn hình kiểm tra với 5 dòng", (await page.locator(".item").count()) === 5, `${await page.locator(".item").count()} dòng`);
check("Dòng Dầu động cơ đã gán linh kiện", (await page.inputValue("#part_0")) === "2");
const cabinPart = await page.inputValue("#part_3");
check("Tự động phân loại 'Lọc gió cabin' → Lọc gió điều hòa (AI không chắc, từ khóa nhận ra)", cabinPart === "9", `part=${cabinPart}`);
check("Dòng tự gợi ý có nhãn 'Gợi ý theo từ khóa'", (await txt(".item:has(#name_3)")).includes("Gợi ý theo từ khóa"), await txt(".item:has(#name_3)"));
check("Dòng không phân loại được có nhãn 'Chưa phân loại'", (await txt(".item:has(#name_4)")).includes("Chưa phân loại"));
let moneyTxt = await txt("#money");
check("Tổng trên phiếu lệch được cảnh báo rõ (AI bỏ sót VAT + dòng thừa)", moneyTxt.includes("Lệch"), moneyTxt);
const delButtons = await page.locator("button[aria-label^='Xóa hạng mục']").count();
check("Mỗi hạng mục có nút Xóa", delButtons === 5, `${delButtons} nút`);
await page.locator("button[aria-label='Xóa hạng mục 5']").click();
check("Xóa dòng thừa → còn 4 dòng", (await page.locator(".item").count()) === 4);
await page.selectOption("#vat_mode", "out"); await page.fill("#vat_rate", "8");
moneyTxt = await txt("#money");
check("Chọn 'VAT cộng thêm' + 8% → VAT tự tính 93.600 và tổng thanh toán 1.263.600", (await page.inputValue("#vat")) === "93600" && moneyTxt.includes("1.263.600"), `vat=${await page.inputValue("#vat")} ${moneyTxt}`);
check("Sau khi sửa: tổng khớp tổng trên phiếu", (await txt("#money")).includes("Khớp"), await txt("#money"));
await page.click("button:has-text('Thêm hạng mục')");
check("Thêm hạng mục mới → có dòng trống", (await page.locator(".item").count()) === 5);
await page.locator("button[aria-label='Xóa hạng mục 5']").click();
await overflow("Màn hình kiểm tra phiếu");
await page.screenshot({ path: `${SHOT}/shot_review.png`, fullPage: true });
await page.click("button:has-text('Lưu phiếu')"); await page.waitForURL(/\/records\/\d+/);
check("Lưu phiếu → trang chi tiết + thông báo", (await flashes()).includes("Đã lưu phiếu"), await flashes());
const detail = await txt("body");
check("Chi tiết: tổng thanh toán 1.263.600 ₫ kèm VAT 8% 'cộng thêm'", detail.includes("1.263.600") && detail.includes("VAT 8%") && detail.includes("cộng thêm"), detail.slice(0, 300));
check("Chi tiết: đủ 4 dòng, không còn dòng thừa", detail.includes("Công thay dầu") && !detail.includes("Dòng đọc nhầm"));
check("Không lưu ảnh phiếu gốc (không có ảnh trên trang chi tiết)", (await page.locator("img.slip").count()) === 0);

// F2. Phiếu AI bỏ sót VAT nhưng tổng khớp đúng 8% → app tự suy ra
await mock("/__draft/vat");
await go("/records/new"); await page.setInputFiles("#file", path.resolve("public/icon-192.png"));
await page.click("button:has-text('Đọc phiếu')"); await page.waitForURL(/\/scan\/\d+/, { timeout: 60000 });
moneyTxt = await txt("#money");
check("AI bỏ sót VAT → app tự suy ra VAT 8% (93.600) và báo 'Khớp'", (await page.inputValue("#vat")) === "93600" && (await page.inputValue("#vat_rate")) === "8" && moneyTxt.includes("Khớp") && moneyTxt.includes("tự suy ra"), `vat=${await page.inputValue("#vat")} ${moneyTxt}`);
await page.click("button:has-text('Lưu phiếu')"); await page.waitForURL(/\/records\/\d+/);
await page.click("button:has-text('Xóa phiếu này')"); await page.waitForURL(/\/records\?ok=/);
await mock("/__draft/junk");

// F3. Nhập tay: gõ tên → tự gợi ý linh kiện
await go("/records/new?manual=1");
await page.fill("#name_0", "Thay lọc dầu máy"); await page.locator("#qty_0").focus();
check("Nhập tay: gõ 'Thay lọc dầu máy' → tự gợi ý 'Lọc dầu động cơ'", (await page.inputValue("#part_0")) === "3", `part=${await page.inputValue("#part_0")}`);
check("Nhập tay: có nhãn gợi ý để người dùng soát", (await txt(".item")).includes("Gợi ý theo từ khóa"));
await page.locator("button[aria-label^='Xóa hạng mục']").first().click();

// G. Hệ quả: ODO, hạn, lịch sử, so sánh
await go(`/vehicles/${vid}`);
check("ODO xe cập nhật theo phiếu (49.500 km)", (await txt(".stat")).includes("49.500"), await txt(".stat"));
check("Dầu động cơ tính lại từ phiếu mới (thay 20/09/2026)", (await ruleTxt("Dầu động cơ")).includes("20/09/2026"), await ruleTxt("Dầu động cơ"));
await go("/records"); check("Lịch sử có phiếu mới", (await txt("body")).includes("Toyota Tân Cảng"));
await overflow("Lịch sử");
await go("/compare"); check("Trang chi phí liệt kê 'Dầu động cơ'", (await txt("body")).includes("Dầu động cơ"));
await page.click("a:has-text('Dầu động cơ')"); check("Chi tiết so sánh hiện garage", (await txt("body")).includes("Toyota Tân Cảng"));
await overflow("So sánh chi phí");

// G2. Chu kỳ: nguồn gốc con số + tra cứu AI + quét sổ hướng dẫn
await go(`/vehicles/${vid}`);
check("Chu kỳ mặc định ghi rõ 'chưa xác thực'", (await txt("#intervals")).includes("chưa xác thực") || (await txt("body")).includes("Mặc định chung · chưa xác thực"));
await page.click("button:has-text('Tra cứu theo')"); await page.waitForURL(/\/intervals\/\d+/, { timeout: 60000 });
check("Tra cứu chu kỳ → màn hình duyệt với 3 đề xuất + cảnh báo 'ĐỀ XUẤT'", (await page.locator(".item").count()) === 3 && (await txt("body")).includes("ĐỀ XUẤT"), `${await page.locator(".item").count()} dòng`);
check("Đề xuất có nguồn tham khảo (grounding)", (await txt("body")).includes("Lịch bảo dưỡng Fortuner"));
check("Dòng độ tin cậy thấp (Bugi) mặc định KHÔNG tích", (await page.locator(".item").filter({ has: page.getByText("Bugi", { exact: true }) }).locator("input[type=checkbox]").isChecked()) === false);
check("Dòng tin cậy cao mặc định được tích", await page.locator(".item").filter({ has: page.getByText("Dầu động cơ", { exact: true }) }).locator("input[type=checkbox]").isChecked());
const cbw = (await page.locator(".item input[type=checkbox]").first().boundingBox())?.width ?? 0;
check("Ô tích chọn hiển thị đúng cỡ (không bị kéo giãn)", cbw > 0 && cbw <= 30, `rộng ${cbw}px`);
await clickWait("button:has-text('Áp dụng các dòng đã chọn')", "Đã áp dụng chu kỳ cho 2");
check("Áp dụng → báo số linh kiện đã cập nhật", (await flashes()).includes("cho 2 linh kiện"), await flashes());
check("Dầu động cơ nay hiện nhãn 'AI tra cứu' + chu kỳ 10.000 km", (await ruleTxt("Dầu động cơ")).includes("AI tra cứu") && (await ruleTxt("Dầu động cơ")).includes("10.000 km"), await ruleTxt("Dầu động cơ"));
check("Bugi (không tích) vẫn là mặc định chung", (await ruleTxt("Bugi")).includes("Mặc định chung"));
await page.setInputFiles("#doc_file", path.resolve("public/icon-192.png"));
await page.click("button:has-text('Đọc bảng bảo dưỡng')"); await page.waitForURL(/\/intervals\/\d+/, { timeout: 60000 });
check("Quét bảng trong sổ hướng dẫn → màn hình duyệt (2 dòng)", (await page.locator(".item").count()) === 2 && (await txt("body")).includes("Đọc từ bảng bảo dưỡng"));
await clickWait("button:has-text('Áp dụng các dòng đã chọn')", "Đã áp dụng");
check("Sau khi áp dụng từ sổ: nhãn 'Theo sổ hướng dẫn'", (await ruleTxt("Dầu động cơ")).includes("Theo sổ hướng dẫn"), await ruleTxt("Dầu động cơ"));
await rule("Dây curoa").locator("summary").click();
await rule("Dây curoa").locator("input[name^=km_]").fill("90000");
await clickWait("button:has-text('Lưu chu kỳ')", "Đã lưu chu kỳ");
check("Tự sửa chu kỳ → nhãn 'Anh tự đặt'", (await ruleTxt("Dây curoa")).includes("Anh tự đặt"), await ruleTxt("Dây curoa"));
await overflow("Trang xe (đã có nguồn chu kỳ)");

// H. Nhập tay + kiểm tra lỗi
await go("/records/new?manual=1");
await page.locator("button[aria-label^='Xóa hạng mục']").first().click();
while ((await page.locator(".item").count()) > 0) await page.locator("button[aria-label^='Xóa hạng mục']").first().click();
await clickWait("button:has-text('Lưu phiếu')", "ít nhất một hạng mục");
check("Lưu phiếu không có hạng mục → báo lỗi rõ ràng", (await flashes()).includes("ít nhất một hạng mục"), await flashes());
await page.fill("#garage", "Garage Nhập Tay"); await page.fill("#date", "2026-10-01"); await page.fill("#odo", "49800");
await page.fill("#name_0", "Thay má phanh trước"); await page.selectOption("#part_0", { label: "Má phanh trước" }); await page.fill("#amount_0", "1500000");
await page.click("button:has-text('Lưu phiếu')"); await page.waitForURL(/\/records\/\d+/);
check("Nhập tay một phiếu → lưu được", (await flashes()).includes("Đã lưu phiếu"), await flashes());

// I. Xóa phiếu (có hỏi xác nhận)
await page.click("button:has-text('Xóa phiếu này')"); await page.waitForURL(/\/records\?ok=/);
check("Xóa phiếu → về lịch sử kèm thông báo", (await flashes()).includes("Đã xóa phiếu"), await flashes());

// J. Tổng quan sau khi dùng + điều hướng
await go("/");
check("Tổng quan hiện xe vừa sửa tên", (await txt("body")).includes("Fortuner nhà"));
for (const [label, href] of [["Lịch sử", "/records"], ["Thêm phiếu", "/records/new"], ["Chi phí", "/compare"], ["Xe", "/vehicles"], ["Tổng quan", "/"]]) {
  await page.click(`nav.tabs a:has-text("${label}")`); await page.waitForURL((u) => u.pathname === href);
}
check("Thanh điều hướng dưới: cả 5 tab hoạt động", true);
const small = await page.$$eval("nav.tabs a, .btn", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 40; }).length);
check("Nút bấm chính không quá nhỏ (≥ 40px cao)", small === 0, `${small} nút nhỏ`);
await overflow("Tổng quan");
check("Không có lỗi JavaScript trong suốt phiên", jsErrors.length === 0, jsErrors.join("; "));

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} đạt`);
if (bad.length) { console.log("KHÔNG ĐẠT:\n" + bad.map((b) => ` - ${b.name}: ${b.detail}`).join("\n")); process.exit(1); }
