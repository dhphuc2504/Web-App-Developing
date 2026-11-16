// Loads credentials only inside the runtime; never prints configuration or raw database errors.
import dotenv from "dotenv";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
dotenv.config({ quiet: true });
const migration = "202611090001_jwt_accounts";
let client;
try {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing connection");
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  await client.connect();
  const sql = await readFile(
    new URL(
      "../prisma/migrations/" + migration + "/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const checksum = createHash("sha256").update(sql).digest("hex");
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query("SELECT pg_advisory_xact_lock(72183019)");
  const history = await client.query(
    "SELECT table_schema FROM information_schema.tables WHERE table_name='_prisma_migrations'",
  );
  if (!history.rows.some((r) => r.table_schema === "restaurant"))
    throw new Error("Expected migration history not found");
  const previous = await client.query(
    "SELECT checksum,finished_at,rolled_back_at FROM restaurant._prisma_migrations WHERE migration_name=$1",
    [migration],
  );
  if (
    previous.rows.length &&
    !previous.rows.some(
      (r) => r.checksum === checksum && r.finished_at && !r.rolled_back_at,
    )
  )
    throw new Error("Migration history conflict");
  const tables = [
    "staff_users",
    "dishes",
    "categories",
    "ingredients",
    "recipes",
    "recipe_items",
    "stock_operations",
    "stock_movements",
  ];
  await client.query(
    "LOCK TABLE " +
      tables.map((t) => "restaurant." + t).join(",") +
      " IN SHARE ROW EXCLUSIVE MODE",
  );
  const columns = {};
  for (const table of tables) {
    const result = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='restaurant' AND table_name=$1 ORDER BY ordinal_position",
      [table],
    );
    columns[table] = result.rows.map((r) => r.column_name);
  }
  async function snapshot() {
    const result = {};
    for (const table of tables) {
      const names = columns[table]
        .map((c) => '"' + c.replaceAll('"', '""') + '"')
        .join(",");
      const row = (
        await client.query(
          `SELECT count(*)::int AS count,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS fingerprint FROM (SELECT ${names} FROM restaurant.${table}) t`,
        )
      ).rows[0];
      result[table] = row;
    }
    return result;
  }
  const before = await snapshot();
  if (!previous.rows.length) {
    await client.query(sql);
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Preservation verification failed");
    await client.query(
      "INSERT INTO restaurant._prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,NOW(),$3,NOW(),1)",
      [randomUUID(), checksum, migration],
    );
  }
  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      migration,
      completed: true,
      alreadyApplied: previous.rows.length > 0,
      existingDataUnchanged: true,
      counts: Object.fromEntries(
        Object.entries(before).map(([k, v]) => [k, v.count]),
      ),
    }),
  );
} catch {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Authentication migration did not complete. Check connectivity, migration history and privileges. No reset was attempted; transaction changes were rolled back. Details are suppressed to protect credentials.",
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
