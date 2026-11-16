# Blocks 9–10: JWT, email challenges, ownership and administrator TOTP

The React application authenticates staff with email/password and an email OTP. Customers remain anonymous. Administrators may opt into TOTP instead of email sign-in OTP, with hashed recovery codes. Email activation and sign-in verification remain distinct steps.

## Account lifecycle

1. Register as a chef with display name, email, password (12+ characters), confirmation and reCAPTCHA v2. Submitted roles cannot grant privileges.
2. Open the single-use activation link (valid 24 hours), then explicitly confirm verification. GET never consumes the token.
3. An administrator approves or rejects the application in the office. Verification alone cannot grant staff access.
4. Enter a correct password after verification and approval. Chefs and administrators without TOTP receive an email OTP. An administrator with TOTP receives a short-lived authenticator challenge without sending an email.
5. For email login, enter the six-digit OTP within five minutes. An email challenge allows five attempts, is single-use and cannot authorize CRUD. A new email can be requested by returning to password login after one minute; previous challenges are invalidated.
6. Successful email OTP or authenticator verification returns a JWT valid for 15 minutes. No refresh token or remember-me cookie is used.

Forgot-password responses do not disclose account existence. Reset links last 30 minutes and are single-use. Resets invalidate outstanding login challenges. Verification/reset tokens are stored as hashes. OTP hashes use HMAC with the signing secret so the small numeric code space cannot be searched from a database dump alone. Passwords use Argon2id.

## JWT and browser storage

The API checks HS256 signatures, explicit issuer/audience, subject, token type, issued-at and expiry. Verification depends only on the JWT and configured key, never a database or session lookup. Claims contain only safe identity fields and role. JWTs are signed, not encrypted.

React stores the JWT in sessionStorage (memory fallback when browser storage is unavailable), includes it in Authorization headers and sends requests with credentials omitted. Refreshing preserves the tab's login; closing the tab normally ends storage persistence. Browser restoration/duplication can retain a tab's storage, so expiry is the authoritative limit. JavaScript can read sessionStorage: XSS can steal a token. Helmet CSP and normal React escaping reduce exposure but do not eliminate that risk.

401 clears the token and navigates to login. 403 displays a permission error and preserves the token. Logout removes the local copy. There is no database token-revocation lookup: already issued JWTs remain valid until expiry after logout, password reset, role changes, changing MFA settings or disabling an account. The maximum ordinary window is 15 minutes. Rotating JWT_SECRET invalidates all issued tokens and outstanding OTP hashes, not just one user's token.

CSRF headers and session cookies are removed from the application. Google reCAPTCHA remains an external service with its own browser behavior. CORS normalizes APP_ORIGIN and explicitly permits Authorization. In development only, localhost and 127.0.0.1 are accepted interchangeably on the configured scheme and port. Production accepts only the configured origin. CAPTCHA hostname validation uses the same local alias policy; both development hostnames must also be permitted in the Google reCAPTCHA configuration. No Access-Control-Allow-Credentials header is used.

## RBAC and ABAC

- Admin: manage staff approval, all dishes and recipes, chef assignment, publication/archive, categories, ingredients, receipts and corrections.
- Chef: create drafts assigned to themselves; edit their own non-archived dishes and recipes, including published dishes; view staff resources and record usage/waste.
- Public: only published, non-archived dishes in active categories, without internal recipe quantities/instructions or stock balances.

A dish has an explicit nullable chefId. Existing dishes remain unassigned until an administrator assigns them. One chef can own multiple dishes. Admins assign an active approved chef in the dish editor. Ownership is unrelated to the last recipe editor.

Mutation authorization reads the stored dish and compares it to the verified JWT subject/role. Dish and recipe writes recheck ownership under a row lock so concurrent reassignment cannot bypass it. This business-resource query is separate from JWT verification. Body role/chefId/isPublished values never establish permission; chef attempts to assign or publish are rejected.

The shared SSR application remains unchanged and does not enforce these new CSR ownership restrictions. The exercise evaluates the CSR API; do not expose the old SSR app as an alternative management entry point if the new rules must apply globally.

## Auth API

All paths below use /api. JSON bodies require Content-Type: application/json.

| Method | Path | Body / behavior |
|---|---|---|
| GET | /auth/config | Public reCAPTCHA site key only |
| POST | /auth/signup | email, displayName, password, confirmPassword, g-recaptcha-response |
| POST | /auth/resend | email; generic response, one-minute issuance cooldown |
| POST | /auth/verify-email | token from activation link |
| POST | /auth/forgot-password | email; generic response |
| POST | /auth/reset-password | token, password, confirmPassword |
| POST | /auth/login | email, password → `{next:"mfa",method:"email"|"totp",challenge,expiresIn:300}` |
| POST | /auth/otp | challenge, code, optional method (totp/recovery) → JWT or recovery-code acknowledgement step |
| GET | /auth/me | Bearer identity; no DB read |
| DELETE | /auth/logout | Browser clears JWT; no server session exists |
| PATCH | /chefs/:id/approval | Admin only: decision = approved/rejected |

Success is `{ok:true,data}`. Business errors use HTTP 200 with `{ok:false,error:{code,message,fields?}}`. Codes include INVALID_CREDENTIALS, ACCOUNT_NOT_ACTIVATED, APPROVAL_REQUIRED, OTP_COOLDOWN, INVALID_OTP and RATE_LIMITED. Token failures use HTTP 401; authorization failures use 403. Infrastructure failures use 500.

Login attempts are reserved atomically in a persistent per-email counter: ten attempts in 15 minutes, cleared after successful OTP completion. A separate in-memory IP limiter caps protected authentication mutations at twenty per fifteen minutes. OTP attempts also have a persistent five-attempt limit per challenge. The single-process IP limiter must be replaced with shared storage for a multi-instance deployment.

## Configuration and migration

Keep real credentials only in restaurant-csr/.env. See ../.env.example for names. Required: DATABASE_URL and a separate random JWT_SECRET of at least 32 characters. Email needs SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD and SMTP_FROM. Gmail SMTP uses an app password. Registration needs reCAPTCHA v2 site/secret keys. APP_ORIGIN is used for email links. In development, localhost and 127.0.0.1 on the same port are accepted; all other origins must match exactly. Restart the API after changing configuration.

Run `npm ci`, `npm run db:generate`, then `npm run db:migrate:auth` once for an existing database with established restaurant Prisma migration history. The migration is additive and transactional, preserves existing verification/approval decisions, fingerprints all pre-existing restaurant columns and records the migration checksum. Re-running an applied matching migration does not duplicate data. A new empty database should use the full Prisma migration history as described in the main README.

No database reset, image import or reseeding is required. The legacy sessions table is retained for the SSR application but unused by CSR.

## Local verification

`npm test` uses isolated PostgreSQL-compatible PGlite databases and mock email delivery, never .env, Supabase or real SMTP. It covers activation/approval, reset, OTP expiry/exhaustion/replay, signature/expiry rejection, zero-DB JWT identity checks, ownership, publication restrictions, cookie-free client requests and existing restaurant regressions.

`npm run preview:fixture` starts a disposable browser demo. Its terminal prints fictional email codes solely because it injects mock delivery; the production email service never logs OTPs or tokens. Real email delivery and CAPTCHA should be tested manually with a real address and configured keys.

Registration displays CAPTCHA loading/failure/retry states and waits for Google's dependencies-ready callback. Auth submissions disable their own form while leaving navigation available. SMTP has a 20-second total delivery deadline; the client allows 45 seconds for CAPTCHA verification, database work and email delivery. An uncertain network result should be followed by checking email or requesting a new verification link rather than assuming registration was rolled back.

## Permanent chef deletion

The office opens chef profiles in a modal. Administrators can permanently delete a chef by opening the deletion section and typing that chef's email. `DELETE /api/chefs/:id/account` validates the confirmation and role server-side in a transaction. Admin accounts cannot be deleted through this endpoint.

Successful deletion frees the unique email, removes authentication challenges and the email's failed-attempt counter, and unassigns owned dishes without deleting them. A chef referenced by recipe editor attribution or stock journals is protected with `CHEF_HAS_HISTORY`; disable access instead. No existing history is rewritten. Already-issued JWTs retain the documented maximum 15-minute validity window.

## Block 10: optional administrator TOTP

Technology: otplib (RFC 6238, SHA-1, six digits, 30-second periods), locally generated QR codes, AES-256-GCM encrypted authenticator secrets, and Argon2id hashed recovery codes. The verifier accepts the current and previous 30-second time steps; the stored last accepted step prevents replay even within that window. AES uses an independent 32-byte key from `MFA_ENCRYPTION_KEY`, a random nonce, and the staff ID as authenticated associated data. QR/manual keys are returned only during password-and-email-protected enrollment, never from status or staff DTOs.

Three additive Prisma models hold the persistent state: `AdminMfa` (encrypted secret, enabled flag, last step, failure count, lockout deadline), `MfaChallenge` (hashed random challenge, purpose, user version, pending payload, expiry, consumption time), and `MfaRecoveryCode` (random ID, Argon2id hash, user, consumption time). Foreign keys cascade on account deletion. Pending payloads contain encrypted secrets or code hashes, never plaintext recovery codes.

Enrollment is password → email setup code → scan QR/manual key → TOTP confirmation → save ten recovery codes → acknowledgement. Only acknowledgement enables TOTP. Setup/email proof cannot authorize login. Pending setup and acknowledgement stages last ten minutes; email and login challenges last five. All challenges are bound to account, purpose, expiry and the account's session version. Password changes or settings changes invalidate outstanding proofs.

Each failed TOTP/recovery attempt increments a persistent per-account counter under a user row lock. The fourth failure sets a 30-second lockout. Lockout requests do not extend the deadline; after expiry the counter resets. Successful verification resets it. The same controls also protect password/OTP proof during settings changes. Issuing a new login challenge cannot reset the counter. Existing password/IP limits continue to apply independently.

The same row lock makes time-step advancement, recovery-code consumption and challenge consumption atomic. Two concurrent submissions cannot both accept the same proof. Recovery codes contain 128 random secret bits in addition to a lookup identifier, are hashed with Argon2id, and are shown only once. Replacing them invalidates the previous set when the new set is acknowledged. Using the last code at login returns replacement codes and a restricted acknowledgement challenge, **not an access token**; normal login completes after saving the replacement set. If that response is lost, use the authenticator again to recover. Without either the authenticator or any saved recovery code, there is no email-only bypass; administrator-assisted operational recovery is outside this UI.

RBAC restricts settings routes to admins. ABAC binds settings to the verified JWT subject and checks the current account is active, approved and verified. An admin cannot change another admin's MFA by supplying a user ID. These resource checks are separate from database-free JWT verification. Chefs never enroll in this TOTP flow.

### Additional API routes

All paths below have prefix `/api/auth/mfa`. Settings require an administrator Bearer JWT; the login acknowledgement instead requires its short-lived challenge.

| Method | Path suffix | Input / result |
|---|---|---|
| GET | (none) | enabled, recoveryCodesRemaining; no secret |
| POST | /setup | password → email setup challenge |
| POST | /setup/verify | challenge, code → QR data URL, manualKey, confirmation challenge |
| POST | /setup/confirm | challenge, code → ten recoveryCodes, acknowledgement challenge |
| POST | /setup/ack | challenge, saved:true → enabled |
| POST | /recovery | password, code, method:totp/recovery → replacement recoveryCodes and challenge |
| POST | /recovery/ack | challenge, saved:true → replace active codes |
| DELETE | (none) | password, code, method:totp/recovery → disabled, email OTP restored |
| POST | /login/ack | challenge, saved:true → JWT after last-code recovery |

Business codes include `INVALID_MFA_CODE`, `MFA_LOCKED`, `MFA_CHALLENGE_EXPIRED`, `MFA_ALREADY_ENABLED` and `RECOVERY_CODES_REQUIRED`. Missing encryption configuration is a server error (`MFA_CONFIGURATION_ERROR`). The client branches on codes, never message text. Forms show local loading and prevent duplicate submissions; lockout displays a 30-second countdown.

### Setup and verification

Add `MFA_ENCRYPTION_KEY` privately (generate with `openssl rand -hex 32`), install dependencies, generate Prisma Client and apply `npm run db:migrate:mfa`. Keep the encryption key backed up; there is no automatic key rotation or migration of encrypted secrets. This migration is additive, checks preservation of existing records and records a Prisma migration checksum. It does not enable TOTP for any existing admin automatically.

The isolated test suite covers enrollment prerequisites, encryption/hashing, four-failure lockout and expiry, unchanged deadlines during lockout, concurrent replay attempts, single-use recovery codes, last-code replacement, settings protection, role/ownership checks, email fallback and challenge expiry/version invalidation. The disposable preview includes a fictional encryption key and prints mock setup emails; it never loads the real `.env`.
