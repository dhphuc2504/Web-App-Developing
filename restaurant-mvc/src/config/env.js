import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config({ quiet: true });
const settings = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
}).safeParse(process.env);
if (!settings.success) throw new Error('Required runtime settings are missing or invalid. Check .env locally.');
export const env = settings.data;
