import { getI18n } from "../../lib/settings.ts";
import { LANGS, LANG_CODES } from "../../lib/i18n/index.ts";
import Icon from "../components/Icon";
import { Flash } from "../components/ui";
import { changePasswordAction, logout, restoreAction, saveKeysAction, saveSettingsAction } from "../actions";
import PasswordField from "../components/PasswordField";
import { MIN_PASSWORD_LENGTH } from "../../lib/password.ts";
import { canStoreKeys, keyStatuses } from "../../lib/secrets.ts";
import ConfirmButton from "../components/ConfirmButton";
import TelegramPanel from "../components/TelegramPanel";

const CURRENCIES = ["USD", "EUR", "GBP", "VND", "JPY", "KRW", "CNY", "INR", "AUD", "CAD", "NZD", "SGD", "THB", "MYR", "IDR", "PHP", "CHF", "SEK", "NOK", "DKK", "PLN", "BRL", "MXN"];

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { t, settings: s } = await getI18n();
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
          <div><span className="badge b-ok wrap"><Icon n="check" s={14} />{t("keys.s_env")}</span></div>
        ) : (
          <>
            <input id={`k_${name}`} name={name} type="password" autoComplete="off" spellCheck={false} placeholder={t("keys.paste")} disabled={!canKeys} />
            <div className="row" style={{ gap: 10 }}>
              <span className={`badge wrap ${st.source === "app" ? "b-ok" : "b-unknown"}`}>{st.source === "app" ? t("keys.s_app", { masked: st.masked ?? "" }) : t("keys.s_none")}</span>
              {st.source === "app" && <label className="check"><input type="checkbox" name={`clear_${name}`} /> {t("keys.remove")}</label>}
            </div>
          </>
        )}
        <div className="mute">{ui.hint}</div>
      </div>
    );
  };
  let zones: string[] = [];
  try { zones = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { zones = []; }
  return (
    <>
      <h1>{t("set.title")}</h1>
      <p className="sub">{t("set.sub")}</p>
      <Flash text={error} />
      <Flash text={ok} ok />
      {!process.env.APP_PASSWORD && <Flash text={t("warn.no_password")} />}

      <h2>{t("set.general")}</h2>
      <form action={saveSettingsAction} className="card form cols">
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
          <input id="reminder_hour" name="reminder_hour" inputMode="numeric" defaultValue={s.reminderHour} />
          <div className="mute">{t("set.reminder_note")}</div></div>
        <button className="btn primary" type="submit">{t("set.save")}</button>
      </form>

      <h2 id="keys">{t("keys.title")}</h2>
      <form action={saveKeysAction} className="card form">
        <p className="mute">{t("keys.intro")}</p>
        {!canKeys && <Flash text={t("keys.need_password")} />}
        <div className="group-title">{t("keys.group_ai")}</div>
        <KeyField name="GEMINI_API_KEY" /><KeyField name="ANTHROPIC_API_KEY" /><KeyField name="DEEPSEEK_API_KEY" />
        <div className="group-title">{t("keys.group_tg")}</div>
        <KeyField name="TELEGRAM_BOT_TOKEN" /><KeyField name="TELEGRAM_CHAT_ID" />
        <button className="btn primary" type="submit" disabled={!canKeys}>{t("keys.save")}</button>
      </form>

      <h2>{t("keys.group_tg")}</h2>
      <div className="card"><TelegramPanel /></div>

      {process.env.APP_PASSWORD && process.env.SESSION_SECRET && (
        <>
          <h2 id="password">{t("set.pw_title")}</h2>
          <form action={changePasswordAction} className="card form">
            <p className="mute">{t("set.pw_intro")}</p>
            <div className="field"><label htmlFor="pw_current">{t("set.pw_current")}</label><PasswordField id="pw_current" name="current" /></div>
            <div className="field"><label htmlFor="pw_new">{t("set.pw_new")}</label><PasswordField id="pw_new" name="new" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
              <div className="mute">{t("set.pw_hint", { min: MIN_PASSWORD_LENGTH })}</div></div>
            <div className="field"><label htmlFor="pw_confirm">{t("set.pw_confirm")}</label><PasswordField id="pw_confirm" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} /></div>
            <label className="check"><input type="checkbox" name="signout_all" defaultChecked /> {t("set.pw_signout_all")}</label>
            <button className="btn primary" type="submit">{t("set.pw_save")}</button>
          </form>
        </>
      )}

      <h2>{t("set.backup_title")}</h2>
      <div className="card">
        <p className="mute" style={{ marginTop: 0 }}>{t("set.backup_body")}</p>
        <div className="actions">
          <a className="btn primary" href="/api/backup" download>{t("set.backup_btn")}</a>
          <a className="btn ghost" href="/api/export" download>{t("set.export_btn")}</a>
        </div>
        <div className="divider">
          <b>{t("set.restore_title")}</b>
          <p className="mute" style={{ margin: "6px 0 10px" }}>{t("set.restore_warn")}</p>
          <form action={restoreAction} className="stack">
            <input type="file" name="file" accept="application/json,.json" required aria-label={t("set.restore_title")} />
            <ConfirmButton label={t("set.restore_btn")} message={t("set.restore_confirm")} />
          </form>
        </div>
      </div>

      {process.env.APP_PASSWORD && <form action={logout} style={{ marginTop: 24 }}><button className="danger block">{t("set.logout")}</button></form>}
    </>
  );
}
