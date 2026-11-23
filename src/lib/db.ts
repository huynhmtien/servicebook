import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Tham số SQL. Tiền/ngày/ID đều là số hoặc chuỗi; null = NULL. */
export type Param = string | number | null;
/** Một lệnh trong batch: [câu SQL, ...tham số]. */
export type Stmt = [sql: string, ...params: Param[]];

/** D1 (SQLite) gắn qua binding `DB` trong wrangler.jsonc. Schema nằm ở migrations/ (npm run db:migrate). */
const db = (): D1Database => getCloudflareContext().env.DB;

export async function all<T = Record<string, unknown>>(sql: string, ...p: Param[]): Promise<T[]> {
  return (await db().prepare(sql).bind(...p).all<T>()).results;
}
export async function get<T = Record<string, unknown>>(sql: string, ...p: Param[]): Promise<T | undefined> {
  return (await db().prepare(sql).bind(...p).first<T>()) ?? undefined;
}
export async function run(sql: string, ...p: Param[]): Promise<void> {
  await db().prepare(sql).bind(...p).run();
}
/** INSERT và trả về id của dòng mới. */
export async function insert(sql: string, ...p: Param[]): Promise<number> {
  const r = await get<{ id: number }>(`${sql} RETURNING id`, ...p);
  return r!.id;
}

/**
 * Chạy nhiều lệnh trong MỘT transaction (D1 batch: hoặc tất cả thành công, hoặc không lệnh nào).
 * D1 không có transaction tương tác, nên các luồng cần id vừa tạo thì insert() lấy id trước rồi gom phần còn lại vào batch.
 */
export async function batch(stmts: Stmt[]): Promise<void> {
  if (!stmts.length) return;
  const d = db();
  await d.batch(stmts.map(([sql, ...p]) => d.prepare(sql).bind(...p)));
}

export async function ping(): Promise<void> {
  await get("SELECT 1");
}
