"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { enableTelegramReplies, sendDigestNow, testTelegram, type TgState } from "../actions";
import Icon from "./Icon";
import { useI18n } from "./I18nProvider";

function Btn({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return <button type="submit" disabled={pending || disabled} aria-busy={pending}>{pending ? t("common.sending") : children}</button>;
}

function Result({ s }: { s: TgState }) {
  const { t } = useI18n();
  if (!s.steps && !s.message) return null;
  return (
    <div className="card" role="status" style={{ marginTop: 12 }}>
      {s.steps?.map((st, i) => (
        <div key={i} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", marginBottom: 6 }}>
          <span className={`badge ${st.ok ? "b-ok" : "b-overdue"}`} style={{ flex: "none" }}><Icon n={st.ok ? "check" : "alert"} s={14} />{st.ok ? t("tg.ok") : t("tg.err")}</span>
          <span>{st.text}</span>
        </div>
      ))}
      {s.message && <div className={`flash${s.ok ? " ok" : ""}`} style={{ margin: 0 }}>{s.message}</div>}
    </div>
  );
}

export default function TelegramPanel() {
  const { t } = useI18n();
  const [tr, testAction] = useActionState<TgState, FormData>(testTelegram, {});
  const [d, digestAction] = useActionState<TgState, FormData>(sendDigestNow, {});
  const [w, webhookAction] = useActionState<TgState, FormData>(enableTelegramReplies, {});
  return (
    <>
      <div className="actions">
        <form action={testAction}><Btn>{t("tg.test")}</Btn></form>
        <form action={digestAction}><Btn>{t("tg.digest")}</Btn></form>
        <form action={webhookAction}><Btn>{t("tg.webhook_enable")}</Btn></form>
      </div>
      <p className="mute" style={{ margin: "12px 0 0" }}>{t("tg.webhook_hint")}</p>
      <Result s={tr} />
      <Result s={d} />
      <Result s={w} />
    </>
  );
}
