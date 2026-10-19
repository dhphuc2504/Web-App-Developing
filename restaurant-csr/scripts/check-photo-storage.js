// Loads credentials privately through normal runtime configuration. Never logs them.
import { env } from "../src/config/env.js";
import { createPhotoService } from "../src/services/photo-service.js";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
let client, path;
try {
  const service = createPhotoService(env);
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#ae6849" },
  })
    .png()
    .toBuffer();
  const result = await service.upload({ buffer, size: buffer.length });
  path = "dishes/" + result.imagePath.split("/").at(-1);
  client = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const fetched = await fetch(result.imagePath);
  if (
    !fetched.ok ||
    !fetched.headers.get("content-type")?.includes("image/webp")
  )
    throw new Error("verification");
  console.log("Storage upload and public image delivery verified.");
} catch {
  console.error(
    "Storage verification failed; no credentials or provider errors displayed.",
  );
  process.exitCode = 1;
} finally {
  if (client && path) {
    const removed = await client.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .remove([path]);
    if (removed.error) {
      console.error("Temporary photo cleanup failed.");
      process.exitCode = 1;
    } else
      console.log(
        "Temporary verification photo removed. Existing photos and database records unchanged.",
      );
  }
}
