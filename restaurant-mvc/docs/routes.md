# HTTP routes — current SSR application

Forms render as HTML. Successful mutations redirect with HTTP 303. Every mutation requires CSRF; staff routes additionally require an active, verified, approved session with the appropriate role. Email-token routes use the token and CSRF rather than staff authentication.

## Public pages and account flows

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/`, `/directory` | Restaurant entrance and room directory |
| GET | `/menu`, `/menu/:slug` | Published menu and dish details |
| GET / POST | `/signup` | Chef registration with server-verified reCAPTCHA v2 |
| GET | `/check-email` | Session-held registration/resend progress and cooldown |
| GET / POST | `/resend-verification` | Request another verification email |
| GET / POST | `/verify-email` | Display confirmation / consume verification token |
| GET | `/verification-complete` | Verification outcome and approval guidance |
| GET / POST | `/login` | Sign-in form / authenticate and rotate session |
| GET / POST | `/forgot-password` | Request a password-reset link; generic response |
| GET / POST | `/reset-password` | Display form / consume token and replace password |
| POST | `/logout` | Authenticated staff logout |
| GET / POST | `/setup` | First admin only; development and loopback only |

Opening a verification or reset link with GET does not consume it. Verification and reset are POST actions. Public confirmation pages do not grant staff access. Visiting `/check-email` or `/verification-complete` without the required session context redirects to the relevant account form.

## Catalog resource conventions

| Base path | Read access | Mutation access |
| --- | --- | --- |
| `/admin/categories` | Admin | Admin |
| `/kitchen/dishes` | Chef / admin | Chef / admin |
| `/kitchen/ingredients` | Chef / admin | Admin |

Each base supports GET (list), GET `/new`, POST (create), GET `/:id/edit`, POST `/:id/update` and DELETE `/:id` (archive). New/edit forms require mutation permission. GET `/admin/dishes` is an admin-only redirect to the kitchen list.

## Kitchen and stock

| Method | Path | Access / purpose |
| --- | --- | --- |
| GET | `/kitchen` | Chef / admin dashboard |
| GET / POST | `/kitchen/dishes/:id/recipe` | Chef / admin view/save recipe |
| POST | `/kitchen/dishes/:id/usage` | Chef / admin record recipe usage |
| GET | `/kitchen/ingredients/:id` | Chef / admin ingredient ledger |
| GET | `/kitchen/stock-history` | Chef / admin journal |
| GET | `/kitchen/stock/new` | Chef / admin stock form |
| POST | `/kitchen/stock/usage`, `/kitchen/stock/waste` | Chef / admin |
| POST | `/kitchen/stock/receipts`, `/kitchen/stock/corrections` | Admin only |

## Administrator office

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin` | Office dashboard |
| GET / POST | `/admin/staff` | List / provision chef |
| POST | `/admin/staff/:id/approval` | Approve or reject chef |
| POST | `/admin/staff/:id/update` | Change chef name/active access |
| DELETE | `/admin/staff/:id` | Deactivate chef; preserve historical records |

All office routes require administrator access. Chef management cannot create an admin or alter another admin through these forms. Native archive forms submit POST with hidden `_method=DELETE`; query-string and header overrides do not perform deletion.

Source of truth: [route definitions](../src/routes/index.js) and [application setup](../src/app.js).
