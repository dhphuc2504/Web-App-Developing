// Normal runtime configuration loads credentials privately. Never display raw errors.
import { createHash } from "node:crypto";
import { createDatabase } from "../src/config/database.js";
import {
  seedPaginationDishes,
  PAGINATION_PREFIX,
} from "./demo/seed-pagination.js";
const fingerprint = (rows) =>
  createHash("sha256")
    .update(
      JSON.stringify(rows, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    )
    .digest("hex");
let db;
try {
  const { env } = await import("../src/config/env.js");
  db = createDatabase(env.DATABASE_URL);
  const original = await db.dish.findMany({
    where: { slug: { not: { startsWith: PAGINATION_PREFIX } } },
    orderBy: { id: "asc" },
  });
  const before = fingerprint(original);
  const result = await seedPaginationDishes(db);
  const after = fingerprint(
    await db.dish.findMany({
      where: { id: { in: original.map((d) => d.id) } },
      orderBy: { id: "asc" },
    }),
  );
  if (before !== after)
    throw new Error("Existing data changed during verification");
  console.log(
    JSON.stringify({ ...result, existingDishesUnchanged: true }, null, 2),
  );
} catch {
  console.error(
    "Dish import could not complete or verify. Check connectivity and active source dishes. Provider details and credentials are suppressed.",
  );
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
}
