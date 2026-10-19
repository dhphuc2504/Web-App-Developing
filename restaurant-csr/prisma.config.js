import { defineConfig } from "prisma/config";
// Generation/validation require no credentials and never load .env.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.MIGRATION_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgresql://localhost:5432/restaurant",
  },
});
