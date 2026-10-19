// Isolated PostgreSQL engine: never loads .env or touches Supabase.
import pg from "pg";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export async function testDatabase() {
  const engine = new PGlite();
  for (const name of [
    "202610120001_initial",
    "202610120002_integrity",
    "202610120003_recipe_allocation_check",
    "202610190001_public_preparation_summary",
  ])
    await engine.exec(
      await readFile(
        new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
        "utf8",
      ),
    );
  class EmbeddedPool extends pg.Pool {
    constructor() {
      super({ max: 1 });
      this.tail = Promise.resolve();
    }
    async acquire() {
      let release;
      const previous = this.tail;
      this.tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      return release;
    }
    async execute(config) {
      const q = typeof config === "string" ? { text: config } : config;
      const parsers = Object.fromEntries(
        Object.values(pg.types.builtins).map((oid) => [
          oid,
          q.types?.getTypeParser(oid, "text") ||
            pg.types.getTypeParser(oid, "text"),
        ]),
      );
      const result = await engine.query(q.text, q.values || [], {
        rowMode: q.rowMode || "object",
        parsers,
      });
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    }
    async query(config) {
      const release = await this.acquire();
      try {
        return await this.execute(config);
      } finally {
        release();
      }
    }
    async connect() {
      const release = await this.acquire(),
        client = new EventEmitter();
      client.query = (config) => this.execute(config);
      client.release = release;
      return client;
    }
    async end() {
      await engine.close();
    }
  }
  const pool = new EmbeddedPool();
  const db = new PrismaClient({
    adapter: new PrismaPg(pool, { schema: "restaurant" }),
    errorFormat: "minimal",
  });
  return {
    db,
    engine,
    close: async () => {
      await db.$disconnect();
      await pool.end();
    },
  };
}
