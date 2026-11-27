"use client";
import Icon from "./Icon";
export default function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn ghost" onClick={() => window.print()}><Icon n="printer" s={20} />{label}</button>;
}
