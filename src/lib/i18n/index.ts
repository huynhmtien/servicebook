import en, { type Messages } from "./en.ts";
import vi from "./vi.ts";

/** Supported languages. To add a language: create `<code>.ts` (Messages type) and register it here. */
export const LANGS = {
  en: { label: "English", locale: "en-US", dict: en as Messages },
  vi: { label: "Tiếng Việt", locale: "vi-VN", dict: vi as Messages },
} as const;
export type Lang = keyof typeof LANGS;
export const LANG_CODES = Object.keys(LANGS) as Lang[];
export const isLang = (s: string | null | undefined): s is Lang => !!s && s in LANGS;

import { makeT as makeCoreT, type TKey, type Vars, type T } from "./make.ts";
export type { TKey, Vars, T };

/** Server-side translator: falls back to English for a missing key. (Client components use ./make.ts and get a trimmed dictionary.) */
export const makeT = (dict: Messages, locale: string): T => makeCoreT(dict, locale, en as Messages);
export const translator = (lang: Lang): T => makeT(LANGS[lang].dict, LANGS[lang].locale);

/** Pick a language from the Accept-Language header (defaults to English). */
export function detectLang(acceptLanguage: string | null | undefined): Lang {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().split(";")[0].toLowerCase().split("-")[0];
    if (isLang(code)) return code;
  }
  return "en";
}

/** Region (US, GB, VN…) from Accept-Language, used to guess the default currency/units on first run. */
export function detectRegion(acceptLanguage: string | null | undefined): string | null {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const m = part.trim().split(";")[0].match(/^[a-z]{2,3}-([A-Za-z]{2})$/);
    if (m) return m[1].toUpperCase();
  }
  return null;
}
