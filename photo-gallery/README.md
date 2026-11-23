# Stillroom

A shared React photo gallery with an Express API, PostgreSQL and a private MinIO bucket.

## Run locally

Install and start Docker Desktop on macOS or Windows, or start Docker Engine with the Compose plugin on Linux. Docker supplies Node.js 24, PostgreSQL 17, and MinIO. You can browse the public gallery with the default settings. Configure the SMTP sender below to register or verify accounts.

From the repository root, run

```sh
cd photo-gallery
docker compose up --build
```

The first build downloads and compiles the pinned MinIO server and client releases from their upstream GitHub repositories. Allow extra time for this step. Docker caches the binaries for subsequent builds.

When the `gallery` service prints **Stillroom is ready.**, open [Stillroom](http://localhost:3000). By default, Discover starts with nine sample photographs across three fictional photographers.

### Configure the verification email

If you already have `.env` beside `compose.yaml`, edit that file. For a fresh extraction, copy `.env.example` to `.env`. Use the six SMTP settings from the restaurant app’s server-side configuration.

| Setting | Value |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Copy the restaurant SMTP host, port and TLS mode. For its Gmail setup, use `smtp.gmail.com`, `587` and `false` (STARTTLS). |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Copy the sender login, SMTP app password and approved From address. Keep these values in the local `.env`. |
| `APP_ORIGIN` | Defaults to `http://localhost:3000`. For a shared deployment, use the public HTTPS address that recipients can open. A localhost link opens on the device where you click it. |

Run `docker compose up -d --build gallery` to apply the configuration. Existing database and image volumes are reused.

1. Choose **Sign in → New here? Create an account** and register with an inbox you can open.
2. Open the **Verify your Stillroom email** message, follow the link, and enter the password you registered with. **Verify email** signs you in. You can now open **Your gallery → Upload photos**.
3. On subsequent visits, sign in with your username or email and password. Accounts created before this update go through verification once at their next sign-in. Their photos stay attached to the same account.

Each link works once and expires after 24 hours. If you need a new link, use **Resend verification email** after one minute, or sign in again. Only the latest link works. If sending fails, check the SMTP configuration, apply it with Compose, and sign in again to retry.

### What Compose starts

| Service | Role | Persistent data |
| --- | --- | --- |
| `gallery` | Runs `node server/index.js` and serves the built React app and API on port 3000 | Uses the two services below |
| `db` | Runs PostgreSQL 17. Registered accounts are in the `gallery` database, in `stillroom.accounts`. | The `database` volume holds accounts, sessions, and photo metadata |
| `objects` | Runs MinIO for the original images and generated variants | The `photographs` volume holds image files |

### Optional configuration

To override a default, create `.env` beside `compose.yaml` in `photo-gallery/`. For example, put `SEED_DEMO=false` on its own line before the first start to skip the sample photos.

| Setting | Default | When to change it |
| --- | --- | --- |
| `SEED_DEMO` | `true` | Set to `false` to skip seeding at startup. Existing photos remain in the gallery. |
| `DATABASE_URL` | Local PostgreSQL service `db`, database `gallery` | Set to a server-side connection string to use another PostgreSQL database, including Supabase. The database role needs permission to create the `stillroom` schema. |
| `MINIO_USER`, `MINIO_PASSWORD` | Local demo credentials in `compose.yaml` | Override both to choose credentials for the MinIO server and the app's storage client. |
| `COOKIE_SECURE` | `false` for local HTTP | Set to `true` when serving the app over HTTPS. |

### Restart, update, or stop

Run these commands from `photo-gallery/`.

| Task | Command |
| --- | --- |
| Start in the background or apply configuration changes | `docker compose up -d` |
| Check service status | `docker compose ps` |
| Watch startup logs | `docker compose logs -f gallery` |
| Rebuild after changing the UI or API while the stack is running | `docker compose up -d --build --no-deps gallery` |
| Stop the stack and keep accounts and images | `docker compose down` |

## Try the gallery

- **Discover** shows up to nine random public frames from different photographers. Pause the animated mosaic, flip through a photographer’s stack, or open their public collection.
- **Your gallery** accepts one to five still JPEG, PNG or WebP files per upload, up to 10 MiB and 32 megapixels each. Uploads start private. The filmstrip loads 24 photos at a time. Open a photo to inspect its metadata, change visibility, or delete it.
- **Edit** offers freeform and square crops, quarter-turn rotation, a result preview, and reset to original. Changes regenerate all three display files. The original stays in MinIO.
- **Picture of the day** reveals one random photo from your personal gallery per UTC day. Replaying the animation reveals the same pick. Deleting the selected photo makes another draw available.

## Storage

Each upload produces three WebP display files in MinIO. Their longest edges are up to 480, 960 and 1600 pixels. Smaller originals use proportionally smaller files. Gallery images use HTML `srcset` and `sizes` so the browser can choose a file based on the display slot and screen density. The original is kept separately for editing. On the first startup after upgrading, existing photos receive the three versions automatically.

To demonstrate, open a large landscape photo's detail page, inspect the image in browser developer tools, and check `$0.currentSrc`. Reload at different emulated viewport widths with pixel density set to 1 and the browser cache disabled. The requested URL identifies the selected file as `thumb`, `medium`, or `preview`.

The browser accesses photos through the API, which checks visibility and ownership before reading MinIO. Only the owner can see original GPS coordinates. Public image variants omit EXIF metadata. Deleted files and superseded variants are queued for cleanup every 30 seconds.

PostgreSQL stores accounts, password hashes, sessions, metadata and daily picks in the `stillroom` schema. Express handles account registration and sessions, including when you use Supabase Postgres.

## Verify

With Node 24 and npm installed:

```sh
npm ci
npm test
npm run build
```

Tests exercise the HTTP routes, PostgreSQL queries via PGlite, and real Sharp image conversions. They use an in-memory object store. To check MinIO in the running stack, upload a fixture through the UI, reopen its detail page, and verify that its preview and dimensions persist after restarting the containers.

| JPEG fixture | Expected simulated coordinates |
| --- | --- |
| Alpine stillness.jpg | 10.77500, 106.70000 |
| Tide line.jpg | −33.87000, −70.68000 |
| Blue hour.jpg | No location recorded |
