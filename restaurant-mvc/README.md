# 三太子亭 — Santaishi-tei

JavaScript SSR restaurant introduction website with public menu browsing, admin catalog management, and chef recipe/inventory tools. No customer accounts, orders, or reservations.

## Stack and structure

- Express 5 serves HTTP and EJS server-rendered views.
- Prisma 7 and its PostgreSQL driver adapter connect to Supabase PostgreSQL.
- Prisma models live in `prisma/schema.prisma`; versioned SQL migrations live in `prisma/migrations/`.
- `src/models/` holds repository access and the Prisma-backed session store.
- `src/controllers/` handles HTTP input/output; `src/services/` handles business rules and transactions.
- `src/routes/`, `src/middleware/`, and `src/validators/` define routes, authorization/CSRF, and input validation.
- Fixed restaurant copy lives in `src/views/public/`. Images can be placed in `public/images/` and referenced by `/images/filename.jpg`.
- PostgreSQL application tables live in the private `restaurant` schema. Public visitors use the Express website, not the Supabase Data API.

## Local setup

Use Node.js 24 or later. In this directory:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm start
```

Enter your credentials into `.env` locally using `.env.example` as a guide. Agents must never inspect the actual `.env`. Runtime configuration loads it without logging its values.

- `DATABASE_URL`: application PostgreSQL URL; a Supabase Session pooler connection is suitable for this persistent Express server.
- `MIGRATION_DATABASE_URL`: migration URL using direct or Session pooler access. The CLI targets the `restaurant` schema.
- `SESSION_SECRET`: at least 32 characters, generated securely.
- `NODE_ENV`, `PORT`, `APP_ORIGIN`: environment, local port, and browser origin.

Do not use the Supabase HTTPS project URL as a PostgreSQL connection string. No Supabase API key is needed for this backend. Use separate restricted runtime and migration database users when deploying beyond this exercise.

The Prisma CLI wrapper suppresses credential-bearing diagnostics and emits only command status or Prisma error codes. Configuration never logs database URLs, passwords, or session secrets.

## Test UI

1. Visit `http://localhost:3000/setup` to create the initial admin. This is development-only, loopback-only, and closes permanently once an admin exists.
2. Visit `/login` and sign in.
3. Use `/admin/staff` to create a chef account.
4. Manage menu categories and dishes through `/admin/categories` and `/admin/dishes`.
5. Receive initial stock through `/kitchen/stock/new` before recording recipe usage.
6. Maintain per-serving recipes through `/kitchen` and record preparation usage there.
7. Review immutable stock history at `/kitchen/stock-history`.
8. Browse the menu anonymously at `/menu`.

Alternatively, create the first admin with `npm run admin:create`; it asks for an email/name and a hidden password. Do not pass passwords as command-line arguments.

The idempotent seed adds a sample category, a published dish, and three zero-balance ingredients. It never seeds accounts or passwords and does not overwrite existing records.

## Roles

- Customers browse public introduction/menu pages without accounts.
- Admins manage categories, dishes, ingredients, chef accounts, recipes, and every stock operation.
- Chefs view inventory, create/edit/archive dishes, edit recipes, and record usage/waste. They cannot receive stock, adjust counts, manage accounts, or change categories and ingredient metadata.
- Removing a chef uses DELETE and deactivates access while preserving historical references.
- Each authenticated request reloads active status and role from the database. Deactivation takes effect on the next request.

## HTTP / PRG

Successful HTML form mutations respond with `303 See Other` and a `Location` header; the browser follows with GET. Refreshing that GET does not replay the POST. Mutations never use GET. Category, dish, and ingredient archive forms submit POST with a hidden `_method=DELETE` field to their resource URL. The method-override middleware converts these requests to DELETE before CSRF/authorization checks; successful DELETE handlers still redirect with HTTP 303. Only POST body overrides to DELETE are accepted; GET, query-string, and header overrides cannot trigger deletion.

Forms require session-bound CSRF tokens. Validation failures use 422, conflicts use 409, forbidden operations use 403, and missing resources use 404. Login rotates the session ID; logout destroys it. Sessions have HTTP-only, SameSite cookies and secure cookies in production. Stock forms also have UUID request keys to prevent duplicate deductions.

## Database integrity

- Money is integer VND (`BIGINT`). Quantities are exact `NUMERIC(14,3)` values, calculated using Decimal rather than floating-point arithmetic.
- Recipes list ingredient quantities per serving. Optimistic versions detect stale edits. Empty draft recipes are allowed; preparation usage requires at least one ingredient.
- Usage for N servings snapshots the recipe version and records actual ingredient deltas.
- Ingredient balances, operation headers, and movement history are written in a single Prisma transaction with deterministic row locking.
- Insufficient stock rolls back the complete operation. Reusing a request key for different data returns 409.
- Database CHECK constraints prevent invalid roles, negative balances, invalid recipe quantities, incomplete recipe references, and incorrect movement signs/math.
- Triggers preserve immutable stock history and prevent changing units of referenced ingredients.
- Archive actions preserve foreign keys/history. Stock corrections create compensating entries.
- App tables deny schema/table access to Supabase anon/authenticated roles. RLS is not the authorization mechanism for this server-only schema; HTTP middleware and restricted database credentials enforce application access.
- Lists currently show up to 100 records; menu browsing includes all published dishes. The public menu has category/search/sort controls and four-dish pagination.

## Migrations and tests

```sh
npm run db:validate
npm run db:generate
npm test
```

Tests run against an isolated embedded PostgreSQL engine (PGlite) through Prisma's PostgreSQL adapter, plus Supertest HTTP requests. They do not load `.env` or modify Supabase. The test-only pool serializes transactions on the embedded connection; production uses PostgreSQL row/advisory locks across connections.

The final audit passes 38 automated tests, including complete chef/admin restrictions, ignored GET/query/header method overrides, CSRF on DELETE, PRG refresh behavior, escaped SSR output, and archived-resource protection. Prisma schema validation used a temporary audit configuration without dotenv. Browser checks used a disposable database for recipe-paper saves, failed usage recovery, signed stock corrections, duplicate chef form recovery, and DELETE confirmation. No Supabase schema/data changes were needed. Recipe editors retain saved ingredients beyond the first 100 pantry records, and paper forms lock their fields while a save is pending.

To change the schema, edit `prisma/schema.prisma` and create a new migration using Prisma Migrate against a local development PostgreSQL database. Include CHECK constraints/triggers in migration SQL where Prisma cannot express them. Never edit an already-deployed migration. Deploy reviewed changes using `npm run db:deploy`.

## Current limits

The UI provides a Japanese restaurant setting and paper-based management screens. Dish images use controlled local paths; uploaded media, password reset/email delivery, suppliers, expiry batches, and multiple restaurants are outside the current backend. Use HTTPS and reviewed proxy/database configuration for production deployment.

## Japanese restaurant experience

- `/`: illustrated exterior with native shoji panels. The sliding door is used only to enter the restaurant.
- `/directory`: glowing arrows projected onto the foyer floor toward dining, kitchen, and office. Labels appear on hover/keyboard focus and remain visible on phones.
- `/menu`: open menu book on a dining-table background. Four dishes per spread, two-sided 800 ms page turns with moving shadows, category/search filters, name/price sorting, and dish dialogs. The backend renders every spread; JavaScript updates the book and browser history without a full page reload.
- `/kitchen` and `/kitchen/dishes`: searchable clipped-ticket board on a Japanese kitchen background. Editing lifts a server-rendered dish or recipe sheet into a dialog; a confirmed successful save returns it to the board. Failed validation preserves entries.
- `/kitchen/ingredients`: pantry jars, shelf/list toggle, search, and low-stock filtering. Open a label for the ingredient ledger, recipe references, and the latest 30 stock movements.
- `/kitchen/stock/new?ingredientId=UUID`: stock form with that ingredient selected.
- `/admin` and `/admin/staff`: staff roster, chef creation, profile updates, and access removal.
- Recipe sheets show quantities per serving, current pantry stock, Add/Remove controls, and preparation notes. Recipe edits do not deduct stock; preparation usage and waste are recorded separately.
- Room changes use a short POV turn/step. Links between kitchen subpages use normal navigation. Reduced-motion preferences skip movement; links and forms still work without JavaScript.
- Mutations keep CSRF, authorization, and HTTP 303 PRG. Archive forms use DELETE method override and a confirmation dialog.
- Generated artwork is local under `public/images/japan/`; PNG masters and generation prompts are preserved. The website loads optimized JPG backgrounds.
- `node scripts/seed-japanese-menu.js` idempotently adds the demonstration menu without overwriting existing edits.

No schema changes were required for this revision. Browser QA uses a disposable database rather than Supabase. Agents never inspect `.env`.
