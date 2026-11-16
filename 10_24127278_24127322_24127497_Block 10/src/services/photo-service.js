import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { AppError } from "../lib/errors.js";
export const PHOTO_LIMIT = 5 * 1024 * 1024;
export function createPhotoService(config, storageClient) {
  const bucket = config.SUPABASE_STORAGE_BUCKET || "dish-photos";
  const secret = config.SUPABASE_SECRET_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
  let origin = null;
  try {
    const url = new URL(config.SUPABASE_URL);
    if (url.protocol === "https:" && !url.username && !url.password)
      origin = url.origin;
  } catch {}
  const configured =
    !!origin && !!secret && /^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket);
  let client = storageClient;
  let ready;
  const publicPrefix = origin
    ? `${origin}/storage/v1/object/public/${bucket}/dishes/`
    : null;
  function acceptsPath(path) {
    if (!path) return true;
    if (/^\/images\/[a-zA-Z0-9_./-]+$/.test(path) && !path.includes(".."))
      return true;
    return (
      !!publicPrefix &&
      path.startsWith(publicPrefix) &&
      /^[0-9a-f-]{36}\.webp$/.test(path.slice(publicPrefix.length))
    );
  }
  async function ensureBucket() {
    if (!configured)
      throw new AppError(
        422,
        "Photo uploads are not set up yet. Ask the administrator to configure Storage. You can still save without a new photo.",
        "STORAGE_NOT_CONFIGURED",
      );
    client ||= createClient(origin, secret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    if (!ready)
      ready = (async () => {
        const existing = await client.storage.getBucket(bucket);
        if (existing.error) {
          if (
            !["404", "400"].includes(
              String(existing.error.status || existing.error.statusCode),
            ) ||
            !/not found|does not exist/i.test(existing.error.message || "")
          )
            throw new Error("Storage lookup failed");
          const created = await client.storage.createBucket(bucket, {
            public: true,
            fileSizeLimit: PHOTO_LIMIT,
            allowedMimeTypes: ["image/webp"],
          });
          if (created.error) {
            const retry = await client.storage.getBucket(bucket);
            if (retry.error || !retry.data.public)
              throw new Error("Storage bucket unavailable");
          }
        } else if (!existing.data.public)
          throw new AppError(
            422,
            "The dish photo bucket must be configured for public menu photos. Ask the administrator to check Storage.",
            "STORAGE_BUCKET_PRIVATE",
          );
      })().catch((error) => {
        ready = null;
        throw error;
      });
    await ready;
  }
  return {
    origin,
    acceptsPath,
    async upload(file) {
      if (!file || !file.buffer?.length)
        throw new AppError(422, "Choose a photo to upload.", "PHOTO_REQUIRED", {
          photo: "Choose a JPEG, PNG or WebP photo.",
        });
      if (file.size > PHOTO_LIMIT)
        throw new AppError(
          422,
          "Choose a photo smaller than 5 MB.",
          "PHOTO_TOO_LARGE",
          { photo: "Maximum size is 5 MB." },
        );
      let bytes;
      try {
        const source = sharp(file.buffer, {
          limitInputPixels: 40000000,
          failOn: "warning",
        });
        const metadata = await source.metadata();
        if (
          !["jpeg", "png", "webp"].includes(metadata.format) ||
          (metadata.pages || 1) > 1
        )
          throw new Error("Unsupported photo");
        bytes = await source
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        throw new AppError(
          422,
          "This file is not a supported photo. Choose a valid JPEG, PNG or WebP image.",
          "INVALID_PHOTO",
          {
            photo:
              "Use a non-animated JPEG, PNG or WebP photo up to 40 megapixels.",
          },
        );
      }
      await ensureBucket();
      const path = `dishes/${randomUUID()}.webp`;
      const result = await client.storage
        .from(bucket)
        .upload(path, bytes, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (result.error) throw new Error("Photo storage upload failed");
      return { imagePath: publicPrefix + path.slice("dishes/".length) };
    },
  };
}
