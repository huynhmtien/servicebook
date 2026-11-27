"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type T } from "../../lib/i18n/make.ts";
import type { Messages } from "../../lib/i18n/en.ts";
import { makeFmt, type Fmt, type FmtOptions } from "../../lib/format.ts";

interface Ctx { t: T; fmt: Fmt; lang: string }
const C = createContext<Ctx | null>(null);

/** Lets client components use the same translations/formatting as the server (the dictionary is passed down from the layout). */
export function I18nProvider({ lang, messages, fmtOptions, children }: { lang: string; messages: Messages; fmtOptions: FmtOptions; children: ReactNode }) {
  const value = useMemo(() => ({ t: makeT(messages, fmtOptions.locale), fmt: makeFmt(fmtOptions), lang }), [lang, messages, fmtOptions]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useI18n(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("I18nProvider missing");
  return v;
}
