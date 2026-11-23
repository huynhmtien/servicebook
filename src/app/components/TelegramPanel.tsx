"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendDigestNow, testTelegram, type TgState } from "../actions";
import Icon from "./Icon";

function Btn({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} aria-busy={pending}>{pending ? "Đang gửi…" : children}</button>;
}

function Result({ s }: { s: TgState }) {
  if (!s.steps && !s.message) return null;
  return (
    <div className="card" role="status" style={{ marginTop: 12 }}>
      {s.steps?.map((st, i) => (
        <div key={i} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", marginBottom: 6 }}>
          <span className={`badge ${st.ok ? "b-ok" : "b-overdue"}`} style={{ flex: "none" }}><Icon n={st.ok ? "check" : "alert"} s={14} />{st.ok ? "OK" : "Lỗi"}</span>
          <span>{st.text}</span>
        </div>
      ))}
      {s.message && <div className={`flash${s.ok ? " ok" : ""}`} style={{ margin: 0 }}>{s.message}</div>}
    </div>
  );
}

export default function TelegramPanel() {
  const [t, testAction] = useActionState<TgState, FormData>(testTelegram, {});
  const [d, digestAction] = useActionState<TgState, FormData>(sendDigestNow, {});
  return (
    <>
      <div className="row">
        <form action={testAction}><Btn>Kiểm tra &amp; gửi tin thử</Btn></form>
        <form action={digestAction}><Btn>Gửi tổng hợp cảnh báo ngay</Btn></form>
      </div>
      <Result s={t} />
      <Result s={d} />
    </>
  );
}
