import "./globals.css";
import type { ReactNode } from "react";
import { TabBar } from "./components/Nav";

export const metadata = {
  title: "ServiceBook — Sổ bảo dưỡng xe",
  description: "Quản lý bảo dưỡng ô tô: nhắc lịch, tuổi thọ linh kiện, chi phí",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="app">
          <main>{children}</main>
          <TabBar />
        </div>
      </body>
    </html>
  );
}
