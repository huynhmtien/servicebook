import { buildCsv } from "../../../lib/backup.ts";
import { getI18n } from "../../../lib/settings.ts";

export const dynamic = "force-dynamic";

/** Xuất toàn bộ phiếu dạng CSV. Đã được middleware bảo vệ bằng đăng nhập. */
export async function GET() {
  const { fmt } = await getI18n();
  const name = `servicebook-slips-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(await buildCsv(fmt.digits, fmt.currency), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
