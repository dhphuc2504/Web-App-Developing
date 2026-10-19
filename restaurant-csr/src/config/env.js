import dotenv from "dotenv";
import { z } from "zod";
dotenv.config({ quiet: true });
const parsed = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    APP_ORIGIN: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(
    "Configure DATABASE_URL and SESSION_SECRET locally before starting the API.",
  );
export const env = parsed.data;
