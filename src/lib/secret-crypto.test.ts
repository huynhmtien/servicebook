import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanKeyValue, decryptSecret, encryptSecret, isKeyName, maskKey, validateKey } from "./secret-crypto.ts";

const S = "a-long-session-secret-for-tests";

test("mã hóa rồi giải mã ra đúng giá trị", async () => {
  const enc = await encryptSecret(S, "GEMINI_API_KEY", "AIzaSyExampleExampleExample12345");
  assert.ok(enc.startsWith("v1.") && !enc.includes("AIza"), enc);
  assert.equal(await decryptSecret(S, "GEMINI_API_KEY", enc), "AIzaSyExampleExampleExample12345");
});
test("mỗi lần mã hóa cho kết quả khác nhau (IV ngẫu nhiên)", async () => {
  const a = await encryptSecret(S, "TELEGRAM_CHAT_ID", "123456789"), b = await encryptSecret(S, "TELEGRAM_CHAT_ID", "123456789");
  assert.notEqual(a, b);
});
test("sai khóa bí mật / sai tên / bị sửa → null (không giải mã được)", async () => {
  const enc = await encryptSecret(S, "GEMINI_API_KEY", "AIzaSyExampleExampleExample12345");
  assert.equal(await decryptSecret("another-secret", "GEMINI_API_KEY", enc), null);
  assert.equal(await decryptSecret(S, "DEEPSEEK_API_KEY", enc), null); // không hoán đổi giá trị giữa các dòng
  const [v, iv, ct] = enc.split(".");
  assert.equal(await decryptSecret(S, "GEMINI_API_KEY", `${v}.${iv}.${ct.slice(0, -4)}AAAA`), null);
  assert.equal(await decryptSecret(S, "GEMINI_API_KEY", "garbage"), null);
  assert.equal(await decryptSecret(S, "GEMINI_API_KEY", ""), null);
});
test("làm sạch giá trị dán: bỏ khoảng trắng, xuống dòng, dấu ngoặc", () => {
  assert.equal(cleanKeyValue('  "sk-abc 123"\n'), "sk-abc123");
  assert.equal(cleanKeyValue("`token`"), "token");
});
test("kiểm tra định dạng từng loại khóa", () => {
  assert.equal(validateKey("TELEGRAM_BOT_TOKEN", "123456789:AAH-abcdefghijklmnopqrstuvwxyz_12"), "123456789:AAH-abcdefghijklmnopqrstuvwxyz_12");
  assert.equal(validateKey("TELEGRAM_BOT_TOKEN", "not a token"), null);
  assert.equal(validateKey("TELEGRAM_CHAT_ID", "987654321"), "987654321");
  assert.equal(validateKey("TELEGRAM_CHAT_ID", "-1001234567890"), "-1001234567890");
  assert.equal(validateKey("TELEGRAM_CHAT_ID", "@mychannel"), "@mychannel");
  assert.equal(validateKey("TELEGRAM_CHAT_ID", "abc"), null);
  assert.equal(validateKey("GEMINI_API_KEY", "AIzaSyExampleExampleExample12345"), "AIzaSyExampleExampleExample12345");
  assert.equal(validateKey("GEMINI_API_KEY", "short"), null);
  assert.equal(validateKey("ANTHROPIC_API_KEY", "sk-ant-api03-abcdefghijklmnop"), "sk-ant-api03-abcdefghijklmnop");
  assert.equal(validateKey("ANTHROPIC_API_KEY", "AIzaSyExampleExampleExample12345"), null);
});
test("che khóa: chỉ lộ 4 ký tự cuối; chỉ nhận tên khóa trong danh sách", () => {
  assert.equal(maskKey("AIzaSyExampleExampleExample12345"), "••••2345");
  assert.ok(isKeyName("GEMINI_API_KEY") && !isKeyName("APP_PASSWORD") && !isKeyName("SESSION_SECRET") && !isKeyName("__proto__"));
});
