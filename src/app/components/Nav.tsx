"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const ITEMS = [
  { href: "/", label: "Tổng quan", icon: "home", match: (p: string) => p === "/" },
  { href: "/records", label: "Lịch sử", icon: "list", match: (p: string) => p === "/records" || /^\/records\/\d+/.test(p) },
  { href: "/records/new", label: "Thêm phiếu", icon: "plus", add: true, match: (p: string) => p.startsWith("/records/new") || p.startsWith("/scan") },
  { href: "/compare", label: "Chi phí", icon: "chart", match: (p: string) => p.startsWith("/compare") },
  { href: "/vehicles", label: "Xe", icon: "car", match: (p: string) => p.startsWith("/vehicles") || p.startsWith("/settings") },
] as const;

export function TabBar() {
  const p = usePathname();
  if (p === "/login") return null;
  return (
    <nav className="tabs" aria-label="Điều hướng chính">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={"add" in i ? "add" : undefined} aria-current={i.match(p) ? "page" : undefined}>
          <Icon n={i.icon} s={26} />
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
