import { all } from "../../../lib/db.ts";

export const dynamic = "force-dynamic";

const TABLES = ["vehicles", "odometer_logs", "part_types", "rules", "garages", "service_records", "service_items", "part_aliases"];

/** Tải toàn bộ dữ liệu (JSON). ServiceBook không lưu ảnh phiếu. Đã được middleware bảo vệ bằng đăng nhập. */
export async function GET() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await all(`SELECT * FROM ${t}`);
  const name = `servicebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify({ app: "servicebook", version: 1, exported_at: new Date().toISOString(), data }, null, 1), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
