"use client";
import { useState } from "react";
import Icon from "./Icon";
import { useI18n } from "./I18nProvider";

/** Password input with a show/hide toggle. Paste and password managers stay enabled (accessible authentication). */
export default function PasswordField({ id, name, autoFocus, autoComplete = "current-password", minLength }: { id: string; name: string; autoFocus?: boolean; autoComplete?: "current-password" | "new-password"; minLength?: number }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} autoCapitalize="none" spellCheck={false}
        required autoFocus={autoFocus} style={{ width: "100%", paddingRight: 52 }} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t("login.hide") : t("login.show")}
        style={{ position: "absolute", right: 2, top: 2, width: 44, height: 40, padding: 0, border: 0, background: "transparent", color: "var(--link)", display: "grid", placeItems: "center" }}>
        <Icon n={show ? "eye-off" : "eye"} s={22} />
      </button>
    </div>
  );
}
