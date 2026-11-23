import { buildBackup } from "../../../lib/backup.ts";

export const dynamic = "force-dynamic";

/** Tải toàn bộ dữ liệu (JSON). ServiceBook không lưu ảnh phiếu. Đã được middleware bảo vệ bằng đăng nhập. */
export async function GET() {
  const name = `servicebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(await buildBackup(), null, 1), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
