# Santaishi-tei — Block 8 speaker notes

Audience: lecturer and classmates. Suggested duration: 12–15 minutes, plus an optional live demonstration. The HTML contains audience slides only; keep this file on a separate device or print it.

## Slide 1: 三太子亭

Opening (30 seconds)

“Our Block 8 exercise extends the original server-rendered restaurant app. Customers can still browse freely, while chef access now has a complete registration, verification and approval process. We will first show the user journey, then explain what the server and database do.”

Scope: restaurant-mvc, not the React application from Blocks 6–7.

## Slide 2: The staff entrance

Product review (45 seconds)

“The existing Japanese design remains. The public restaurant and menu are still open to visitors. Only chefs and administrators have accounts. New staff can register without an invitation, but they cannot choose an admin role or immediately enter the kitchen.”

Point out the clean sign-in screen. Resend verification is contextual, rather than permanently beside every sign-in.

Evidence: src/views/auth/login.ejs; src/services/account-service.js. Screenshot is a local template render with fictional data, captured 9 November 2026. It is not evidence of live SMTP or Google verification.

## Slide 3: A clear next step after registration

Product review (45 seconds)

“Our first version sent new chefs straight to login, making the resend action difficult to find. We replaced that redirect with a Check your email page. The chef can check spam, correct the address used for a resend, or request another verification email after one minute.”

“The JavaScript countdown is only presentation. The session and database enforce the resend controls, even when someone tries to submit early.”

The response remains generic for already registered or ineligible addresses. SMTP failures may require a retry. Evidence: account-controller.js, account-service.js, public/js/verification.js.

## Slide 4: Verification and approval are separate

Product review (45 seconds)

“Email verification and staff authorization solve different problems. A valid email address does not make someone a member of the team. An admin can approve before or after email verification, but both conditions must be met.”

“An unverified chef entering the correct password sees a resend link. A verified chef who is still pending sees only the approval message. Rejected and inactive accounts do not gain access.”

Evidence: auth-service.js, middleware/security.js, auth/verified.ejs. Screenshot uses a fictional pending state.

## Slide 5: Registration workflow

Workflow (60 seconds)

“After validation and server-side CAPTCHA verification, we store an Argon2 password hash and create a pending chef. Nodemailer sends a verification link. Opening that link displays a confirmation page; pressing Verify my email performs the actual POST.”

“Public registration ignores submitted role and approval fields. Only the admin's protected endpoint can grant approval.”

The diagram shows a typical sequence, not a required order between approval and verification. Source: account-service.js and routes/index.js.

## Slide 6: The application remains SSR

Architecture (60 seconds)

“This remains JavaScript, Express, EJS, Prisma and PostgreSQL. Controllers coordinate HTTP requests and rendering. Services own business rules and transactions. Models provide repository and session access.”

“Successful form submissions follow Post/Redirect/Get: POST changes state, 303 redirects, and GET renders the next page. Refreshing the destination does not repeat the mutation. Errors render validation feedback rather than pretending success.”

Explain that fetching an HTML fragment for a paper dialog does not convert the application to React CSR. Source: src/app.js, controllers/, services/, models/, views/.

## Slide 7: Cookies and database sessions

Sessions (75 seconds)

“The cookie is an identifier, not the password or the full staff record. The server uses it to load a session row from PostgreSQL. That is why restarting the Node server does not automatically log everyone out.”

“Login regenerates the session ID to avoid keeping the anonymous form's identifier. On each authenticated request, the server checks the user's current role, verification, approval, active flag and session version.”

“The application has an eight-hour normal inactivity window or thirty days with Remember me. Database persistence does not make a session permanent. Browser privacy settings and incognito closure can remove cookies.”

Evidence: app.js; models/session-store.js; middleware/security.js; controllers/auth-controller.js. Never show cookie values during the presentation.

## Slide 8: Password recovery

Recovery (60 seconds)

“Forgot password gives the same message whether or not an account exists. The email contains a random token. The database stores only its SHA-256 hash, purpose, expiry and usage state.”

“Submitting a valid reset changes the Argon2 password hash atomically with token consumption and session invalidation. A second browser loses access on its next request. The session version also protects against a stale session saved concurrently.”

“A password reset is not an approval mechanism. Rejected or unverified chefs remain blocked.”

Evidence: account-service.js and tests/accounts.test.js. Do not put live reset tokens or actual passwords on the projector.

## Slide 9: Database changes for Block 8

Database (60 seconds)

“We extend StaffUser instead of creating a separate customer identity system. approvalStatus is pending, approved or rejected. emailVerifiedAt is nullable. sessionVersion is incremented when access or a password changes.”

“The new AuthToken table has a UUID primary key, user UUID foreign key, VARCHAR purpose and hash, and timezone-aware timestamps. The hash is unique, and expiry and user/purpose/date indexes support lookup and cleanup.”

“The existing Session table stores text-serialized session state. It has no foreign key to StaffUser, because anonymous CSRF forms also use sessions.”

“The migration intentionally preserves pre-existing staff access, including the initial admin needed to approve new chefs. This is a migration policy, not evidence those historical inboxes were verified by email.”

Sources: prisma/schema.prisma; prisma/migrations/202611020001_staff_auth/migration.sql; docs/database/README.md. No claim is made here about the current live migration state.

## Slide 10: Server-enforced permissions

Authorization (45 seconds)

“Authentication tells us which staff member is making the request. Authorization decides what that staff member can do. Hiding a button is not sufficient; middleware checks direct requests too.”

“Chefs can manage dishes and recipes, inspect stock, and record usage or waste. Administrators alone manage ingredient metadata, categories, receipts, corrections and staff accounts.”

“Archive forms still use DELETE method override with CSRF. GET never deletes. Successful actions still return 303.”

Evidence: routes/index.js; middleware/security.js; tests/backend.test.js.

## Slide 11: Email delivery and CAPTCHA

Integrations (60 seconds)

“We kept Nodemailer and SMTP, so Gmail is configuration rather than a dependency in the business logic. We chose a fresh dedicated Gmail account to separate project mail from personal mail. It uses an App Password, not the normal account password.”

“The requirement specifies v2 image CAPTCHA rather than v3 scoring. We use v2 checkbox and validate the response on the backend, including the hostname. Google controls whether an image challenge is necessary on an individual attempt.”

“SMTP and CAPTCHA errors are sanitized; missing provider configuration does not silently bypass verification.”

Implementation evidence: account-delivery.js; config/env.js; tests/account-delivery.test.js. Provider references: https://nodemailer.com/smtp ; https://developers.google.com/recaptcha/docs/verify ; https://developers.google.com/recaptcha/docs/display ; https://support.google.com/accounts/answer/185833 . These references document provider behavior; the demo still requires real credentials configured privately.

## Slide 12: Decisions shaped by feedback

Decision log (60 seconds)

“The main changes came from testing the experience. We first discussed invitations, but selected self-registration followed by admin review for simplicity. We considered a test SMTP inbox, but selected a dedicated Gmail sender for real delivery.”

“The resend link originally appeared on every login page. Removing it exposed a flow problem: registration still redirected there, leaving users without clear recovery. The final design makes Check your email the post-registration destination and shows resend at login only after a correct-password attempt by an unverified user.”

“Throughout these changes, we preserved restaurant data, SSR, role checks, CSRF and PRG.”

Additional decisions: keep the original Japanese design; archive the Block 5 presentation; exclude real environment files and node_modules from the submission. Existing accounts are grandfathered by migration, while new accounts follow the full flow.

## Slide 13: Validation and practical limits

Validation (45 seconds)

“The isolated suite passes 62 tests. It checks the meaningful negative cases: early resends, reused tokens, unauthorized approval, old passwords and revoked sessions. The existing inventory, navigation and server lifecycle tests also continue to pass.”

“Mock providers make repeatable tests possible, but they are not a substitute for real email delivery or Google's challenge. Our database fixture serializes transactions, so production concurrency is a separate validation task.”

Source: npm test, run 9 November 2026; tests/accounts.test.js; tests/account-delivery.test.js; tests/backend.test.js. No live database was accessed for this deck.

## Slide 14: Demonstration sequence

Live demonstration (3–5 minutes, optional)

Preparation: configure SMTP, v2 keys and APP_ORIGIN privately; apply reviewed migrations; start restaurant-mvc on localhost:3000. Use an existing administrator in a normal browser profile and a separate profile/incognito window for the chef. Register with a fresh email that can receive mail. Do not project environment files, cookie values, App Passwords or complete email tokens.

1. Open /signup, enter the chef details and complete the real CAPTCHA manually. Show /check-email. Explain the one-minute resend delay without waiting through it unless the examiner requests it.
2. Open the email link in the chef browser, then confirm verification. Show the pending approval state.
3. Switch to the admin profile and approve the chef under Office → Chef accounts. Sign in as the chef and demonstrate /kitchen works while /admin is forbidden.
4. Use Forgot password and complete the reset. In a second already-signed-in chef session, refresh a protected page and show that access has ended. Try the old password once, then the new one.
5. Log out. Open /kitchen to show the redirect to sign-in. Optionally show rejection from the admin profile instead.

For persistence testing, use a normal profile; closing incognito may erase its cookies. Restarting the Node server should not remove a valid persisted session.

If email or Google is unavailable, use the offline screenshots and the earlier workflow slides. State clearly that the live provider check could not be completed; do not describe a mock as real delivery.

Closing: “Block 8 adds a complete staff identity lifecycle while retaining the original server-rendered restaurant experience.”