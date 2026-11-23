import { telegramConfigured } from "../../lib/telegram.ts";
import { activeProvider, providerOrder } from "../../lib/extract.ts";
import Icon from "../components/Icon";
import { logout } from "../actions";
import TelegramPanel from "../components/TelegramPanel";

const Row = ({ ok, label, hint }: { ok: boolean; label: string; hint: string }) => (
  <div className="li">
    <span className={`badge ${ok ? "b-ok" : "b-soon"}`}><Icon n={ok ? "check" : "alert"} s={14} />{ok ? "Đã bật" : "Chưa bật"}</span>
    <div className="grow"><div className="t">{label}</div>{!ok && <div className="mute">{hint}</div>}</div>
  </div>
);

export default async function Settings() {
  const tg = telegramConfigured();
  const ai = providerOrder();
  return (
    <>
      <h1>Cài đặt</h1>
      <p className="sub">Các mục cấu hình được đặt ở biến môi trường (Cloudflare → Workers → servicebook → Settings → Variables and Secrets, hoặc `wrangler secret put`).</p>
            <div className="list">
        <Row ok={tg} label="Nhắc việc qua Telegram" hint="Đặt TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID (secret)" />
        <Row ok={!!activeProvider()} label={`Đọc phiếu bằng AI${ai.length ? ` (${ai.join(" → ")})` : ""}`} hint="Đặt GEMINI_API_KEY, DEEPSEEK_API_KEY hoặc ANTHROPIC_API_KEY" />
        <Row ok={!!process.env.APP_PASSWORD} label="Mật khẩu truy cập" hint="Đặt APP_PASSWORD và SESSION_SECRET (nên bật nếu app mở ra internet)" />
      </div>
      <TelegramPanel />
      <div className="card" style={{ marginTop: 16 }}>
        <b>Sao lưu dữ liệu</b>
        <p className="mute" style={{ margin: "6px 0 12px" }}>Tải toàn bộ xe, phiếu, chu kỳ về máy (file JSON). Nên tải định kỳ, ví dụ mỗi tháng.</p>
        <a className="btn primary block" href="/api/backup" download>Tải bản sao lưu</a>
      </div>
      {process.env.APP_PASSWORD && <form action={logout} style={{ marginTop: 16 }}><button className="danger">Đăng xuất</button></form>}
      <p className="mute">Tổng hợp tự gửi mỗi sáng khoảng 8:00 (giờ Việt Nam). Khi lưu phiếu hoặc cập nhật ODO mà có hạng mục mới tới hạn, bot báo ngay.</p>
    </>
  );
}
