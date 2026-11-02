# Documentation

| Document | Purpose |
| --- | --- |
| [Product README](../README.md) | Installation, workflow, permissions and project structure |
| [Authentication](block8-authentication.md) | Block 8 SMTP, reCAPTCHA v2, registration, approval, verification and password recovery |
| [Database](database/README.md) | Complete ten-table field reference, relationships, constraints and migrations |
| [SQL reference](database/schema.sql) | Ordered migration SQL for study or an empty database |
| [HTTP routes](routes.md) | Current SSR endpoints, methods and access rules |
| [Visual design](design.md) | Japanese room navigation and progressive enhancements |
| [Block 5 presentation archive](../presentation/README.md) | Original presentation and historical screenshots |

JPG files in this folder are historical UI captures. Runtime artwork lives under `public/images/`; its provenance is in [ASSETS.md](../public/images/japan/ASSETS.md).

The current Prisma model and versioned migrations are authoritative. The former root submission SQL file has been consolidated into `docs/database/schema.sql`. Empty root `migrations/` and `seeders/` scaffolds were removed; real migrations remain in `prisma/migrations/`, and seed programs remain in `scripts/`.
