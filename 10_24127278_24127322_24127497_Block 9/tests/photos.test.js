import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  createPhotoService,
  PHOTO_LIMIT,
} from "../src/services/photo-service.js";
const config = {
  SUPABASE_URL: "https://storage.example.test",
  SUPABASE_SECRET_KEY: "test-only",
};
test("photo storage creates public bucket, transforms images and never overwrites originals", async () => {
  let created = 0,
    stored;
  const mock = {
    storage: {
      getBucket: async () => ({
        error: { status: 404, message: "Bucket not found" },
      }),
      createBucket: async (name, options) => {
        created++;
        assert.equal(options.public, true);
        return {};
      },
      from: () => ({
        upload: async (path, bytes, options) => {
          stored = { path, bytes, options };
          return {};
        },
      }),
    },
  };
  const photos = createPhotoService(config, mock);
  const buffer = await sharp({
    create: { width: 1800, height: 100, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const uploaded = await photos.upload({ buffer, size: buffer.length });
  assert.equal(photos.acceptsPath(uploaded.imagePath), true);
  assert.equal(photos.acceptsPath("https://evil.test/a.webp"), false);
  const meta = await sharp(stored.bytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
  assert.equal(stored.options.upsert, false);
  await photos.upload({ buffer, size: buffer.length });
  assert.equal(created, 1);
  await assert.rejects(() => photos.upload({ buffer, size: PHOTO_LIMIT + 1 }), {
    code: "PHOTO_TOO_LARGE",
  });
  await assert.rejects(
    () => photos.upload({ buffer: Buffer.from("<svg/>"), size: 6 }),
    { code: "INVALID_PHOTO" },
  );
});
test("existing private buckets are not made public automatically", async () => {
  const photos = createPhotoService(config, {
    storage: { getBucket: async () => ({ data: { public: false } }) },
  });
  const buffer = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() => photos.upload({ buffer, size: buffer.length }), {
    code: "STORAGE_BUCKET_PRIVATE",
  });
});
