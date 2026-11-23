import { buildBackup } from "../../../lib/backup.ts";

export const dynamic = "force-dynamic";

/** Download all data (JSON). ServiceBook doesn't store record images. Protected by login via the middleware. */
export async function GET() {
  const name = `servicebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(await buildBackup(), null, 1), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
