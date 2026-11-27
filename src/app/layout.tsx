import "./globals.css";
import type { ReactNode } from "react";
import { TabBar } from "./components/Nav";
import { I18nProvider } from "./components/I18nProvider";
import { LANGS } from "../lib/i18n/index.ts";
import type { Messages } from "../lib/i18n/en.ts";

/** Only the key groups that client components use are sent to the browser (keeps every page light). Add a prefix here when a client component starts using a new group. */
const CLIENT_PREFIXES = ["login.", "scan.", "nav.", "defects.", "items.", "pay.", "cat.", "hint.", "common.", "tg."];
const clientMessages = (d: Messages): Messages =>
  Object.fromEntries(Object.entries(d).filter(([k]) => CLIENT_PREFIXES.some((p) => k.startsWith(p)))) as Messages;
import { getI18n } from "../lib/settings.ts";

// Static metadata (no DB query): async generateMetadata makes Next stream the metadata and causes a hydration error (React #418).
// The language-specific title/description is rendered with native <title>/<meta> tags in the layout below (React 19 hoists them into <head>).
export const metadata = {
  applicationName: "ServiceBook",
  appleWebApp: { capable: true, title: "ServiceBook", statusBarStyle: "default" as const },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f6" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { lang, fmt, t } = await getI18n();
  return (
    <html lang={lang}>
      <head>
        <title>{`${t("app.name")} — ${t("app.tagline")}`}</title>
        <meta name="description" content={t("app.description")} />
      </head>
      <body>
        <I18nProvider lang={lang} messages={clientMessages(LANGS[lang].dict)} fmtOptions={{ locale: fmt.locale, currency: fmt.currency, distance: fmt.unit, taxLabel: fmt.taxLabel }}>
          <a className="skip" href="#main">{t("a11y.skip")}</a>
          <div className="app">
            <main id="main" tabIndex={-1}>{children}</main>
            <TabBar />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
