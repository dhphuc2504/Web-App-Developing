// Credentials are loaded privately by server configuration. Raw CLI/DB errors are never printed.
import { spawn } from "node:child_process";
import { createDatabase } from "../src/config/database.js";
let db;
let stage = "configuration";
async function snapshot() {
  const result = {};
  for (const table of [
    "dishes",
    "categories",
    "ingredients",
    "recipes",
    "recipe_items",
    "stock_operations",
    "stock_movements",
    "staff_users",
  ]) {
    const expression =
      table === "dishes"
        ? "to_jsonb(t) - 'preparation_summary'"
        : "to_jsonb(t)";
    const [row] = await db.$queryRawUnsafe(
      `SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(${expression} ORDER BY (${expression})::text)::text,'[]')) AS fingerprint FROM restaurant.${table} t`,
    );
    result[table] = row;
  }
  return result;
}
try {
  const { env } = await import("../src/config/env.js");
  db = createDatabase(env.DATABASE_URL);
  if (process.argv.includes("--check")) {
    const history =
      await db.$queryRaw`SELECT table_schema FROM information_schema.tables WHERE table_name = '_prisma_migrations'`;
    const columns =
      await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema='restaurant' AND table_name='dishes' AND column_name='preparation_summary'`;
    console.log(
      JSON.stringify({
        migrationHistorySchemas: history.map((x) => x.table_schema),
        summaryColumnPresent: columns.length === 1,
        dishes: await db.dish.count(),
      }),
    );
  } else {
    stage = "preservation snapshot";
    const before = await snapshot();
    stage = "Prisma deploy";
    const migrationUrl = new URL(
      process.env.MIGRATION_DATABASE_URL || env.DATABASE_URL,
    );
    migrationUrl.searchParams.set("schema", "restaurant");
    let cliOutput = "";
    const status = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["node_modules/prisma/build/index.js", "migrate", "deploy"],
        {
          env: {
            ...process.env,
            DATABASE_URL: env.DATABASE_URL,
            MIGRATION_DATABASE_URL: migrationUrl.href,
            DOTENV_CONFIG_QUIET: "true",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk) => {
        cliOutput += chunk;
      });
      child.stderr.on("data", (chunk) => {
        cliOutput += chunk;
      });
      child.on("error", reject);
      child.on("close", resolve);
    });
    if (status !== 0) {
      console.error(
        "Prisma deployment status: " +
          (cliOutput.match(/\bP\d{4}\b/)?.[0] || "unclassified failure"),
      );
      throw new Error("Migration failed");
    }
    stage = "post-migration verification";
    const after = await snapshot();
    const preserved = Object.keys(before).every(
      (key) => JSON.stringify(before[key]) === JSON.stringify(after[key]),
    );
    const populated = await db.dish.count({
      where: { preparationSummary: { not: null } },
    });
    console.log(
      JSON.stringify(
        {
          migration: "202610190001_public_preparation_summary",
          completed: true,
          existingDataUnchanged: preserved,
          dishesWithSummary: populated,
          counts: Object.fromEntries(
            Object.entries(after).map(([key, value]) => [key, value.count]),
          ),
        },
        null,
        2,
      ),
    );
    if (!preserved) {
      console.error(
        "Existing data changed during the migration window; review concurrent application activity.",
      );
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(
    "Failed stage: " +
      stage +
      (/^P\d{4}$/.test(error.code || "") ? " (" + error.code + ")" : ""),
  );
  console.error(
    "Migration check/deployment failed. Detailed errors are suppressed to protect credentials. No reset or destructive recovery was attempted.",
  );
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
}
