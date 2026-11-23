import { getCloudflareContext } from "@opennextjs/cloudflare";

/** SQL parameters. Money/dates/IDs are all numbers or strings; null = NULL. */
export type Param = string | number | null;
/** One statement in a batch: [SQL, ...params]. */
export type Stmt = [sql: string, ...params: Param[]];

/** D1 (SQLite) attached via the `DB` binding in wrangler.jsonc. The schema lives in migrations/ (npm run db:migrate). */
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
/** INSERT and return the new row's id. */
export async function insert(sql: string, ...p: Param[]): Promise<number> {
  const r = await get<{ id: number }>(`${sql} RETURNING id`, ...p);
  return r!.id;
}

/**
 * Run several statements in ONE transaction (D1 batch: either all succeed or none do).
 * D1 has no interactive transactions, so flows that need a just-created id call insert() first and then batch the rest.
 */
export async function batch(stmts: Stmt[]): Promise<void> {
  if (!stmts.length) return;
  const d = db();
  await d.batch(stmts.map(([sql, ...p]) => d.prepare(sql).bind(...p)));
}

export async function ping(): Promise<void> {
  await get("SELECT 1");
}
