import { telegramConfigured } from "../../lib/telegram.ts";
import { activeProvider, providerOrder } from "../../lib/extract.ts";
import { getI18n } from "../../lib/settings.ts";
import { LANGS, LANG_CODES } from "../../lib/i18n/index.ts";
import Icon from "../components/Icon";
import { Flash } from "../components/ui";
import { logout, restoreAction, saveKeysAction, saveSettingsAction } from "../actions";
import { canStoreKeys, keyStatuses } from "../../lib/secrets.ts";
import ConfirmButton from "../components/ConfirmButton";
import TelegramPanel from "../components/TelegramPanel";

const CURRENCIES = ["USD", "EUR", "GBP", "VND", "JPY", "KRW", "CNY", "INR", "AUD", "CAD", "NZD", "SGD", "THB", "MYR", "IDR", "PHP", "CHF", "SEK", "NOK", "DKK", "PLN", "BRL", "MXN"];

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { t, settings: s } = await getI18n();
  const tg = telegramConfigured();
  const statuses = keyStatuses();
  const canKeys = canStoreKeys();
  const FIELD_UI = {
    GEMINI_API_KEY: { label: t("keys.f_gemini"), hint: t("keys.h_gemini") },
    ANTHROPIC_API_KEY: { label: t("keys.f_anthropic"), hint: t("keys.h_anthropic") },
    DEEPSEEK_API_KEY: { label: t("keys.f_deepseek"), hint: t("keys.h_deepseek") },
    TELEGRAM_BOT_TOKEN: { label: t("keys.f_tg_token"), hint: t("keys.h_tg_token") },
    TELEGRAM_CHAT_ID: { label: t("keys.f_tg_chat"), hint: t("keys.h_tg_chat") },
  } as const;
  const KeyField = ({ name }: { name: keyof typeof FIELD_UI }) => {
    const st = statuses.find((x) => x.name === name)!;
    const ui = FIELD_UI[name];
    return (
      <div className="field">
        <label htmlFor={`k_${name}`}>{ui.label}</label>
        {st.source === "env" ? (
          <div className="mute"><span className="badge b-ok wrap"><Icon n="check" s={14} />{t("keys.s_env")}</span></div>
        ) : (
          <>
            <input id={`k_${name}`} name={name} type="password" autoComplete="off" spellCheck={false} placeholder={t("keys.paste")} disabled={!canKeys} />
            <div className="row" style={{ gap: 10, marginTop: 4 }}>
              <span className={`badge wrap ${st.source === "app" ? "b-ok" : "b-unknown"}`}>{st.source === "app" ? t("keys.s_app", { masked: st.masked ?? "" }) : t("keys.s_none")}</span>
              {st.source === "app" && <label style={{ margin: 0, display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name={`clear_${name}`} /> {t("keys.remove")}</label>}
            </div>
          </>
        )}
        <div className="mute">{ui.hint}</div>
      </div>
    );
  };
  const ai = providerOrder();
  let zones: string[] = [];
  try { zones = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { zones = []; }
  const Row = ({ on, label, hint }: { on: boolean; label: string; hint: string }) => (
    <div className="li">
      <span className={`badge ${on ? "b-ok" : "b-soon"}`}><Icon n={on ? "check" : "alert"} s={14} />{on ? t("common.enabled") : t("common.disabled")}</span>
      <div className="grow"><div className="t">{label}</div>{!on && <div className="mute">{hint}</div>}</div>
    </div>
  );
  return (
    <>
      <h1>{t("set.title")}</h1>
      <p className="sub">{t("set.sub")}</p>
      <Flash text={error} />
      <Flash text={ok} ok />

      <h2>{t("set.general")}</h2>
      <form action={saveSettingsAction} className="card form">
        <div className="field"><label htmlFor="lang">{t("set.language")}</label>
          <select id="lang" name="lang" defaultValue={s.langSetting}>
            <option value="auto">{t("set.lang_auto")}</option>
            {LANG_CODES.map((c) => <option key={c} value={c}>{LANGS[c].label}</option>)}
          </select></div>
        <div className="field"><label htmlFor="currency">{t("set.currency")}</label>
          <input id="currency" name="currency" list="currencies" defaultValue={s.currency} maxLength={3} style={{ textTransform: "uppercase" }} />
          <datalist id="currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="mute">{t("set.currency_hint")}</div></div>
        <div className="field"><label htmlFor="distance">{t("set.distance")}</label>
          <select id="distance" name="distance" defaultValue={s.distance}>
            <option value="km">{t("set.dist_km")}</option><option value="mi">{t("set.dist_mi")}</option>
          </select>
          <div className="mute">{t("set.dist_hint")}</div></div>
        <div className="field"><label htmlFor="tax_label">{t("set.tax_label")}</label>
          <input id="tax_label" name="tax_label" defaultValue={s.taxLabel} maxLength={20} />
          <div className="mute">{t("set.tax_hint")}</div></div>
        <div className="field"><label htmlFor="timezone">{t("set.timezone")}</label>
          <input id="timezone" name="timezone" list="zones" defaultValue={s.timezone} />
          <datalist id="zones">{zones.map((z) => <option key={z} value={z} />)}</datalist></div>
        <div className="field"><label htmlFor="reminder_hour">{t("set.reminder_hour")}</label>
          <input id="reminder_hour" name="reminder_hour" inputMode="numeric" defaultValue={s.reminderHour} /></div>
        <button className="btn primary" type="submit">{t("set.save")}</button>
      </form>

      <h2 id="keys">{t("keys.title")}</h2>
      <form action={saveKeysAction} className="card form">
        <p className="mute" style={{ margin: 0 }}>{t("keys.intro")}</p>
        {!canKeys && <Flash text={t("keys.need_password")} />}
        <b>{t("keys.group_ai")}</b>
        <KeyField name="GEMINI_API_KEY" /><KeyField name="ANTHROPIC_API_KEY" /><KeyField name="DEEPSEEK_API_KEY" />
        <b>{t("keys.group_tg")}</b>
        <KeyField name="TELEGRAM_BOT_TOKEN" /><KeyField name="TELEGRAM_CHAT_ID" />
        <button className="btn primary" type="submit" disabled={!canKeys}>{t("keys.save")}</button>
      </form>

      <div className="list" style={{ marginTop: 16 }}>
        <Row on={tg} label={t("set.row_telegram")} hint={t("set.row_telegram_hint")} />
        <Row on={!!activeProvider()} label={`${t("set.row_ai")}${ai.length ? ` (${ai.join(" → ")})` : ""}`} hint={t("set.row_ai_hint")} />
        <Row on={!!process.env.APP_PASSWORD} label={t("set.row_password")} hint={t("set.row_password_hint")} />
      </div>
      <TelegramPanel />

      <h2>{t("set.backup_title")}</h2>
      <div className="card">
        <p className="mute" style={{ margin: "0 0 12px" }}>{t("set.backup_body")}</p>
        <div className="row">
          <a className="btn primary" href="/api/backup" download>{t("set.backup_btn")}</a>
          <a className="btn ghost" href="/api/export" download>{t("set.export_btn")}</a>
        </div>
        <div style={{ borderTop: ".5px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
          <b>{t("set.restore_title")}</b>
          <p className="mute" style={{ margin: "6px 0 10px" }}>{t("set.restore_warn")}</p>
          <form action={restoreAction}>
            <input type="file" name="file" accept="application/json,.json" required style={{ width: "100%", marginBottom: 8 }} aria-label={t("set.restore_title")} />
            <ConfirmButton label={t("set.restore_btn")} message={t("set.restore_confirm")} />
          </form>
        </div>
      </div>

      {process.env.APP_PASSWORD && <form action={logout} style={{ marginTop: 16 }}><button className="danger">{t("set.logout")}</button></form>}
      <p className="mute">{t("set.reminder_note")}</p>
    </>
  );
}
