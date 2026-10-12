import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { defineConfig } from 'prisma/config';
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/restaurant';
const connection = new URL(url);
connection.searchParams.set('schema', 'restaurant');
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node scripts/seed.js' },
  datasource: { url: connection.toString() },
});
