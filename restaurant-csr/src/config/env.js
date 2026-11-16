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
    JWT_SECRET: z.string().min(32),
    MFA_ENCRYPTION_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    RECAPTCHA_SITE_KEY: z.string().optional(),
    RECAPTCHA_SECRET_KEY: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SECRET_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("dish-photos"),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(
    "Configure DATABASE_URL and JWT_SECRET locally before starting the API.",
  );
export const env = parsed.data;
