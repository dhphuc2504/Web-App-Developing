# Block 8 — Staff authentication

Santaishi-tei uses server-rendered EJS pages, Express MVC, Prisma and PostgreSQL-backed sessions. Customers browse without accounts. Public registration creates only a chef account; it cannot grant an administrator role.

## Account workflow

1. Open `/signup`, enter a name, email and password (at least 12 characters), confirm the password and complete reCAPTCHA v2.
2. Registration redirects to **Check your email**, where a resend button becomes available after one minute. Refreshing preserves the cooldown. Open the verification email, then press **Verify my email**. Opening a link alone never changes account state.
After verification, a confirmation page explains whether approval is still pending or sign-in is available. Unverified chefs who enter correct credentials at sign-in see a resend link; verified chefs awaiting approval see only the approval message.

3. An administrator opens **Office → Chef accounts** and approves or rejects the application. Approval and verification are independent requirements; both must be satisfied before sign-in.
4. Sign in at `/login`. A normal login lasts up to eight hours of inactivity; **Remember me** extends this to 30 days. Session data persists in PostgreSQL, while the browser stores the signed session ID in an HttpOnly cookie.
5. Logout deletes the session. Rejection or deactivation blocks existing sessions on their next request. Password reset invalidates every session for that account.

`/forgot-password` sends a single-use link valid for 30 minutes. Verification links last 24 hours. Resends have a one-minute account cooldown; authentication endpoints also have an IP rate limit. Forgot-password and resend responses do not disclose whether an email is registered. A rejected or unverified account cannot bypass approval by resetting its password.

Existing accounts are grandfathered as verified and approved by the additive migration, preserving administrator access and previous chef access. Existing inactive accounts remain inactive. Admin-provisioned new chefs are approved but must use **Send a new verification email** on the registration page before signing in. The initial administrator setup remains available only on loopback in development, before an administrator exists.

## Install and migrate

Use Node.js 24 or newer. In the `restaurant-mvc` folder:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

The versioned migration `202611020001_staff_auth` adds account approval, email verification, session version and hashed one-time token storage. It preserves restaurant records and passwords. It was tested against an isolated database; deployment to the real database is a separate step. Do not use `prisma migrate reset` or `db push` against the shared database.

Block 6/7 uses the same database but is a separate application. These authentication checks are implemented in the SSR app only. Do not expose the older CSR application as an alternative staff entrance for Block 8; its existing authentication code does not enforce the new approval and verification rules.

## Private configuration

Keep the existing `DATABASE_URL`, migration URL and `SESSION_SECRET`. Edit `.env` privately; do not commit it or send it to others. Add:

```dotenv
APP_ORIGIN=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-dedicated-account@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM="Santaishi-tei <your-dedicated-account@gmail.com>"
RECAPTCHA_SITE_KEY=your-v2-site-key
RECAPTCHA_SECRET_KEY=your-v2-secret-key
```

`APP_ORIGIN` must match the browser address exactly. Use `http://localhost:3000` consistently during local development, including when opening email links. In production, use the public HTTPS origin and `NODE_ENV=production`. Behind a reverse proxy, the application expects one trusted proxy.

The site key is public and appears in the CAPTCHA widget. The secret key, SMTP password and session secret stay server-side. Restart the app after configuration changes. Missing CAPTCHA settings disable registration; there is no production CAPTCHA bypass.

### Gmail SMTP example

1. Use a dedicated Gmail account and enable **2-Step Verification** in Google Account security settings.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords), create an app password named `Santaishi-tei`, and put it in `SMTP_PASSWORD`. Use the generated app password, not the normal account password. Google may display the password in groups; remove the display spaces when copying it.
3. Put the Gmail address in both `SMTP_USER` and `SMTP_FROM`.
4. Use port **465** with `SMTP_SECURE=true`. For a provider using STARTTLS on port **587**, set `SMTP_SECURE=false`; this application still requires the TLS upgrade.

Some organization accounts or security policies do not offer App Passwords. In that case, use an SMTP provider that supplies username/password credentials and an approved sender address. See [Google's App Password guide](https://support.google.com/accounts/answer/185833) and [Nodemailer SMTP settings](https://nodemailer.com/smtp).

### Google reCAPTCHA v2 keys

1. Open the [reCAPTCHA registration console](https://www.google.com/recaptcha/admin/create).
2. Name the site `Santaishi-tei Block 8`.
3. Choose **reCAPTCHA v2 → “I'm not a robot” Checkbox**. Do not select v3 or Invisible v2. If Google shows its Cloud console, choose **Challenge (v2) / Checkbox** and retrieve the legacy secret key for the `siteverify` integration.
4. Add `localhost` to allowed domains for this development setup. Add the actual hostname when deploying; enter hostnames without a URL scheme, port or path. Keep domain validation enabled.
5. Copy the **site key** to `RECAPTCHA_SITE_KEY` and **secret key** to `RECAPTCHA_SECRET_KEY` privately.
6. Restart the app and open `http://localhost:3000/signup`.

Google decides whether the checkbox triggers an image challenge. v2 supports image challenges but cannot guarantee images on every attempt. The server verifies each response with Google and checks its hostname against `APP_ORIGIN`; client-side success alone does not authorize registration.

References: [Google key setup](https://docs.cloud.google.com/recaptcha/docs/create-key-website), [v2 widget](https://developers.google.com/recaptcha/docs/display), [server verification](https://developers.google.com/recaptcha/docs/verify).

## Demonstration checklist

- Register a new chef and check the verification email, including the spam folder.
- Confirm the chef cannot sign in before verification or while pending approval.
- Sign in as the existing admin, open Chef accounts and approve the chef.
- Sign in as the chef; verify the kitchen is available and the office is forbidden.
- Select Remember me, close/reopen the browser, and restart the server; the valid database session should remain usable.
- Request a password reset. Change the password, confirm the old password fails, and confirm another signed-in browser loses access.
- Reuse or expire a verification/reset token and confirm it is rejected.
- Reject/deactivate a chef and verify their existing session loses access.
- Log out and verify protected CRUD routes are inaccessible.

## Tests and maintenance

```sh
npm test
node node_modules/prisma/build/index.js validate --config prisma.local.config.js
```

Tests use an isolated PGlite database and injected CAPTCHA/email doubles, without loading `.env` or sending mail. Real SMTP delivery and Google's interactive image challenge require manual verification after configuring real keys.

Expired sessions are pruned by the existing server cleanup timer. One-time tokens are stored only as SHA-256 hashes, consumed atomically, and are never reusable after success. Provider error details and credentials are not shown to users. No email links or passwords are written to application logs. If an email request fails, retry using the resend or forgot-password form; a failed registration email does not delete the pending account.
