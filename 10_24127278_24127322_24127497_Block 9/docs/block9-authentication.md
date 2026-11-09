# Block 9: JWT, email challenges and dish ownership

The React application authenticates staff with email/password and an email OTP. Customers remain anonymous. No TOTP or recovery-code feature is included in this iteration; email activation and sign-in OTP are distinct steps.

## Account lifecycle

1. Register as a chef with display name, email, password (12+ characters), confirmation and reCAPTCHA v2. Submitted roles cannot grant privileges.
2. Open the single-use activation link (valid 24 hours), then explicitly confirm verification. GET never consumes the token.
3. An administrator approves or rejects the application in the office. Verification alone cannot grant staff access.
4. Enter a correct password after verification and approval. Both chefs and admins receive an email OTP.
5. Enter the six-digit OTP within five minutes. A challenge allows five attempts, is single-use and cannot authorize CRUD. A new email can be requested by returning to password login after one minute; previous challenges are invalidated.
6. Successful OTP verification returns a JWT valid for 15 minutes. No refresh token or remember-me cookie is used.

Forgot-password responses do not disclose account existence. Reset links last 30 minutes and are single-use. Resets invalidate outstanding login challenges. Verification/reset tokens are stored as hashes. OTP hashes use HMAC with the signing secret so the small numeric code space cannot be searched from a database dump alone. Passwords use Argon2id.

## JWT and browser storage

The API checks HS256 signatures, explicit issuer/audience, subject, token type, issued-at and expiry. Verification depends only on the JWT and configured key, never a database or session lookup. Claims contain only safe identity fields and role. JWTs are signed, not encrypted.

React stores the JWT in sessionStorage (memory fallback when browser storage is unavailable), includes it in Authorization headers and sends requests with credentials omitted. Refreshing preserves the tab's login; closing the tab normally ends storage persistence. Browser restoration/duplication can retain a tab's storage, so expiry is the authoritative limit. JavaScript can read sessionStorage: XSS can steal a token. Helmet CSP and normal React escaping reduce exposure but do not eliminate that risk.

401 clears the token and navigates to login. 403 displays a permission error and preserves the token. Logout removes the local copy. There is no database token-revocation lookup: already issued JWTs remain valid until expiry after logout, password reset, role changes or disabling an account. The maximum ordinary window is 15 minutes. Rotating JWT_SECRET invalidates all issued tokens and outstanding OTP hashes, not just one user's token.

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
| POST | /auth/login | email, password → `{next:"mfa",challenge,expiresIn:300}` |
| POST | /auth/otp | challenge, code → `{accessToken,expiresIn:900,user}` |
| GET | /auth/me | Bearer identity; no DB read |
| DELETE | /auth/logout | Browser clears JWT; no server session exists |
| PATCH | /chefs/:id/approval | Admin only: decision = approved/rejected |

Success is `{ok:true,data}`. Business errors use HTTP 200 with `{ok:false,error:{code,message,fields?}}`. Codes include INVALID_CREDENTIALS, ACCOUNT_NOT_ACTIVATED, APPROVAL_REQUIRED, OTP_COOLDOWN, INVALID_OTP and RATE_LIMITED. Token failures use HTTP 401; authorization failures use 403. Infrastructure failures use 500.

Login attempts are reserved atomically in a persistent per-email counter: ten attempts in 15 minutes, cleared after successful OTP completion. A separate in-memory IP limiter caps auth POST requests at twenty per fifteen minutes. OTP attempts also have a persistent five-attempt limit per challenge. The single-process IP limiter must be replaced with shared storage for a multi-instance deployment.

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
