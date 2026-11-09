# Dish photos and publication

Chefs and administrators can select a photo from their device, preview or remove it, and choose **Save draft** or **Publish dish**. Existing published dishes offer **Save & keep published**. Saving a published dish as a draft hides it from customers. A draft may have no photo.

Slugs are generated from dish names. Duplicate names receive numbered suffixes. Renaming an existing dish keeps its URL stable. The form no longer asks staff to enter a slug or file path.

## Storage setup

Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the server's private environment. The legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported. Never put a server secret in React code or a `VITE_` variable. Restart the server after configuration changes.

The optional `SUPABASE_STORAGE_BUCKET` defaults to `dish-photos`. The server creates a missing public bucket on first upload, with a 5 MB limit and WebP content restriction. An existing private bucket is rejected rather than automatically made public. Public bucket images are publicly readable; do not upload confidential photos. Upload authorization stays on the Express server; no anonymous write policy is required.

See the [Supabase upload guide](https://supabase.com/docs/guides/storage/uploads/standard-uploads) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## API and file handling

`POST /api/dish-photos` requires a chef/admin session, a CSRF header and `multipart/form-data` with one `photo` field. The browser supplies the multipart boundary; do not manually set Content-Type. Other write endpoints continue to use JSON.

JPEG, PNG and WebP input files up to 5 MB and 40 megapixels are accepted. The server validates actual image contents, rejects animation, corrects orientation, removes metadata and resizes to at most 1600 pixels per side. It stores WebP with a unique filename and returns `{ "ok": true, "data": { "imagePath": "public photo URL" } }`. Authentication errors use 401/403, business errors use the normal HTTP 200 error envelope, and unexpected Storage failures use HTTP 500 without provider details or credentials.

The editor uploads on save, then creates or updates the dish. A failed dish save retains the upload reference for retry while the editor remains open. Uploads and database writes are separate operations: cancelling after an upload succeeds but a dish save fails can leave an unused image. Replacing or removing a dish photo does not delete existing Storage objects. Storage cleanup should be a separate reviewed operation to avoid deleting referenced images.

Existing local image paths continue to work. Uploaded URLs use the existing `imagePath` column; no database migration is needed. Public dish APIs never include private recipe instructions or credentials.

## Verification

`npm test` uses a disposable local database and mocked Storage. `npm run preview:fixture` uses disposable accounts, dishes and in-memory uploads, without loading private environment files.

`node scripts/check-photo-storage.js` privately loads normal runtime settings, uploads a temporary image, checks public delivery and removes that temporary image. It may create the configured bucket if missing, but does not modify dish records.
