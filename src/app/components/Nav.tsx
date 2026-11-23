"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { useI18n } from "./I18nProvider";

const ITEMS = [
  { href: "/", label: "nav.home", icon: "home", match: (p: string) => p === "/" },
  { href: "/records", label: "nav.history", icon: "list", match: (p: string) => p === "/records" || /^\/records\/\d+/.test(p) },
  { href: "/records/new", label: "nav.add", icon: "plus", add: true, match: (p: string) => p.startsWith("/records/new") || p.startsWith("/scan") },
  { href: "/compare", label: "nav.costs", icon: "chart", match: (p: string) => p.startsWith("/compare") },
  { href: "/vehicles", label: "nav.vehicles", icon: "car", match: (p: string) => p.startsWith("/vehicles") || p.startsWith("/settings") },
] as const;

export function TabBar() {
  const p = usePathname();
  const { t } = useI18n();
  if (p === "/login") return null;
  return (
    <nav className="tabs" aria-label={t("nav.aria")}>
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={"add" in i ? "add" : undefined} aria-current={i.match(p) ? "page" : undefined}>
          <Icon n={i.icon} s={26} />
          <span>{t(i.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
