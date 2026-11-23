import "./globals.css";
import type { ReactNode } from "react";
import { TabBar } from "./components/Nav";
import { I18nProvider } from "./components/I18nProvider";
import { LANGS } from "../lib/i18n/index.ts";
import { getI18n } from "../lib/settings.ts";

// Metadata tĩnh (không truy vấn DB): generateMetadata bất đồng bộ làm Next stream metadata và gây lỗi hydrate (React #418).
// Tiêu đề/mô tả theo ngôn ngữ được render bằng thẻ <title>/<meta> gốc ở layout bên dưới (React 19 tự đưa vào <head>).
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
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
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
        <I18nProvider lang={lang} messages={LANGS[lang].dict} fmtOptions={{ locale: fmt.locale, currency: fmt.currency, distance: fmt.unit, taxLabel: fmt.taxLabel }}>
          <div className="app">
            <main>{children}</main>
            <TabBar />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
