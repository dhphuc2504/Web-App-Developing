# Block 6 verification

Verified on 19 October 2026 using a disposable PGlite database. No Supabase connection, migration or seed was run, and no existing environment file was read.

## Automated checks

`npm test`: 27 tests passed. The command generates Prisma Client, builds the React application and runs API and shared-client tests.

Coverage includes response envelopes, pagination, credential filtering, session rotation, CSRF, HTTP 401/403, writable-field validation, malformed IDs, partial updates, actual DELETE requests, archive behavior, recipe version conflicts, stock idempotency, atomic stock deductions, immutable history, database failures and all three client error layers.

The production build succeeds. Vite reports that React Router's package-level `use client` directives are ignored; this does not prevent the CSR build.

## Browser checks

- Intro, directory and menu navigation; full-screen room transitions.
- Menu pagination, sorting, dish dialog and browser Back navigation.
- Administrator login, protected routes and direct-route refresh.
- Ingredient receipt, journal updates, recipe editing and per-serving usage.
- Dish creation and archiving in the kitchen.
- Artificially delayed responses display a loading indicator and disable the application controls and links.
- Request tracing confirms client-side room navigation requests route data without another HTML document request.
- Mobile menu sorting remains visible at 390px, with no horizontal page overflow.

The Prisma schema is identical to Block 5. The original `restaurant-mvc` project was not modified. Real Supabase connectivity must be checked after the local ignored environment file has been configured.
