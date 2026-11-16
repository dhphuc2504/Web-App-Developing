# Restaurant CSR documentation

This index covers the current Block 10 application and the earlier restaurant features retained from Blocks 6 and 7. Start with the [application README](../README.md) for installation, environment configuration, database preparation and startup commands.

The [Block 10 Google Authenticator setup and testing guide](../README.md#block-10-set-up-google-authenticator) covers enrollment, lockout, recovery codes and disabling TOTP.

## Current application

| Guide | Contents |
|---|---|
| [Blocks 9–10 authentication](block9-authentication.md) | Registration, activation links, approval, email OTP, optional admin TOTP/recovery codes, JWT storage/expiry, no-DB token verification, ownership and permanent chef deletion |
| [REST API](api.md) | Endpoints, response envelopes, HTTP statuses, writable fields and inventory requests |
| [Pagination and search](block7-pagination.md) | Server-side paging, sorting/filtering, full-text/fuzzy search and bookmark URLs |
| [Photo uploads](photo-uploads.md) | Supabase Storage configuration, upload limits and image handling |

The Blocks 9–10 guide and API reference define current authorization behavior. Earlier feature guides may describe their original block's routes or permissions: staff dish lists now use `/api/staff/dishes`; public dishes use `/api/dishes`. Only admins publish/archive/reassign dishes. Chefs edit their own assigned dishes and recipes. All protected CSR requests use Bearer JWTs, not session cookies or CSRF headers.

## Optional demonstration data

- [Recipe and inventory demo import](demo-data.md): sample recipes, ingredients and stock journals.
- [Pagination demo import](block7-demo-dishes.md): 1,200 generated dishes with existing images.

These imports write database records and are not required for startup. For a disposable demonstration, use `npm run preview:fixture -- --large` after installing dependencies, generating Prisma Client and building React. The fixture does not access Supabase or read `.env`; its fictional email codes appear in the terminal.

## Evidence and presentations

- [Earlier verification notes](verification.md) document historical checks; use `npm test` for current automated results.
- [Block 6 presentation](../presentation/README.md) and [Block 7 presentation](../presentation-block7/README.md) retain their original scope. Their screenshots, scripts and test counts are historical rather than current Block 10 evidence.

## Credential handling

Real `.env` files are private and excluded from version control. Configuration examples contain placeholders only. Test reports and screenshots must not include connection strings, passwords, signing secrets, real OTPs or access tokens.
