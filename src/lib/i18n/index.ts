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

type Plural<K> = K extends `${infer B}_${"one" | "other"}` ? B : K;
/** Valid translation keys (plural keys are written without the _one/_other suffix). */
export type TKey = Plural<keyof Messages>;
export type Vars = Record<string, string | number>;
export type T = (key: TKey, vars?: Vars) => string;

/** Create a translation function for a dictionary. `vars.count` (a number) selects the singular/plural form per the language's rules. */
export function makeT(dict: Messages, locale: string): T {
  const rules = new Intl.PluralRules(locale);
  const d = dict as Record<string, string>;
  return (key, vars = {}) => {
    let k: string = key;
    if (typeof vars.count === "number") {
      const pk = `${key}_${rules.select(vars.count)}`;
      if (pk in d) k = pk;
      else if (`${key}_other` in d) k = `${key}_other`;
    }
    const s = d[k] ?? (en as Record<string, string>)[k] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, n) => (n in vars ? String(vars[n]) : `{${n}}`));
  };
}

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
