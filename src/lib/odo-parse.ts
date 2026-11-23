// Phân tích tin nhắn cập nhật ODO (thuần, không phụ thuộc framework nên test được bằng node --test).

export interface V { id: number; name: string; plate: string | null; odo: number }
export type OdoParse =
  | { kind: "ok"; vehicle: V; km: number }
  | { kind: "which" }          // nhiều xe mà chưa nói rõ xe nào
  | { kind: "none" };          // không phải tin cập nhật ODO

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Hiểu tin nhắn kiểu "52000", "52,000 km", "truck 52000", "51K-123.45 52000".
 * Một xe thì chỉ cần số; nhiều xe thì phải kèm tên/biển số (khớp một phần, không phân biệt dấu/hoa thường).
 */
export function parseOdoMessage(text: string, vehicles: V[]): OdoParse {
  const m = text.trim().match(/^(.*?)(\d[\d.,\s]*)\s*(?:km|mi|miles|dặm)?\s*$/i);
  if (!m || /[-−]$/.test(m[1])) return { kind: "none" }; // "-5" không phải ODO
  const km = Number(m[2].replace(/[^\d]/g, ""));
  if (!Number.isFinite(km) || km <= 0 || km > 5_000_000) return { kind: "none" };
  const hint = norm(m[1]);
  if (!vehicles.length) return { kind: "none" };
  if (!hint) return vehicles.length === 1 ? { kind: "ok", vehicle: vehicles[0], km } : { kind: "which" };
  const hits = vehicles.filter((v) => norm(v.name).includes(hint) || (v.plate && norm(v.plate).includes(hint)) || hint.includes(norm(v.name)));
  return hits.length === 1 ? { kind: "ok", vehicle: hits[0], km } : { kind: "which" };
}
