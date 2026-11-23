import Icon from "../components/Icon";
import { login } from "../actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div style={{ minHeight: "70vh", display: "grid", alignContent: "center", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, margin: "0 auto 14px", display: "grid", placeItems: "center", color: "#fff", background: "linear-gradient(160deg,#3b9bff,#0a63e0)" }}>
          <Icon n="car" s={40} />
        </div>
        <h1 style={{ margin: 0 }}>ServiceBook</h1>
        <p className="sub">Sổ bảo dưỡng xe của anh</p>
      </div>
      {error && <div className="flash" role="alert">{error === "locked" ? "Nhập sai quá nhiều lần — thử lại sau 15 phút." : error === "config" ? "Máy chủ thiếu SESSION_SECRET, xem HUONG-DAN.md." : "Sai mật khẩu, anh thử lại."}</div>}
      <form action={login} className="card">
        <input type="hidden" name="next" value={next ?? "/"} />
        <label htmlFor="password">Mật khẩu</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus style={{ width: "100%" }} />
        <button className="btn primary block" type="submit" style={{ marginTop: 14 }}>Đăng nhập</button>
      </form>
    </div>
  );
}
