import type { Messages } from "./en.ts";

// Dictionary-free core of the translator: client components import THIS file so the language dictionaries are not bundled into the browser JS.
type Plural<K> = K extends `${infer B}_${"one" | "other"}` ? B : K;
/** Valid translation keys (plural keys are written without the _one/_other suffix). */
export type TKey = Plural<keyof Messages>;
export type Vars = Record<string, string | number>;
export type T = (key: TKey, vars?: Vars) => string;

/** Create a translation function for a dictionary. `vars.count` (a number) selects the singular/plural form per the language's rules. */
export function makeT(dict: Messages, locale: string, fallback?: Messages): T {
  const rules = new Intl.PluralRules(locale);
  const d = dict as Record<string, string>;
  return (key, vars = {}) => {
    let k: string = key;
    if (typeof vars.count === "number") {
      const pk = `${key}_${rules.select(vars.count)}`;
      if (pk in d) k = pk;
      else if (`${key}_other` in d) k = `${key}_other`;
    }
    const s = d[k] ?? (fallback as Record<string, string> | undefined)?.[k] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, n) => (n in vars ? String(vars[n]) : `{${n}}`));
  };
}


