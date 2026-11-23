import Icon from "../components/Icon";
import { login } from "../actions";
import { getI18n } from "../../lib/settings.ts";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { t } = await getI18n();
  return (
    <div style={{ minHeight: "70vh", display: "grid", alignContent: "center", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, margin: "0 auto 14px", display: "grid", placeItems: "center", color: "#fff", background: "linear-gradient(160deg,#3b9bff,#0a63e0)" }}>
          <Icon n="car" s={40} />
        </div>
        <h1 style={{ margin: 0 }}>{t("app.name")}</h1>
        <p className="sub">{t("app.tagline")}</p>
      </div>
      {error && <div className="flash" role="alert">{error === "locked" ? t("login.locked") : error === "config" ? t("login.config") : t("login.bad")}</div>}
      <form action={login} className="card">
        <input type="hidden" name="next" value={next ?? "/"} />
        <label htmlFor="password">{t("login.password")}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus style={{ width: "100%" }} />
        <button className="btn primary block" type="submit" style={{ marginTop: 14 }}>{t("login.submit")}</button>
      </form>
    </div>
  );
}
