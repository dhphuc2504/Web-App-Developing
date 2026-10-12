# Santaishi-tei restaurant experience

The restaurant is branded 三太子亭 — Santaishi-tei across the public and staff pages. The application remains Express/EJS SSR with Prisma and MVC. JavaScript enhances HTML returned by the server; ordinary page links and form submissions remain available.

- Dining: a two-page menu book on a Japanese dining-table background, four dishes per spread, accessible dish dialogs, two-sided 800 ms page-turn animation with moving paper shading and floor shadows, category/search/sort controls, and browser history.
- Kitchen: a Japanese kitchen background, clipped dish tickets, and a paper editor that opens the server-rendered dish or recipe form. Successful POSTs redirect with HTTP 303 to the board. The sheet returns only after a successful response; validation/conflict responses retain submitted values.
- Pantry: shelf and list views, search and low-stock filters, ingredient labels opening protected ledgers, recent stock movements, recipe references, and preselected stock forms.
- House: glowing arrows projected onto the floor toward the three doorways, with short guidance on hover/focus and visible guidance on phones.
- Movement: shoji sliding only at the exterior entrance. Room changes use a short turn/step; kitchen subpages use normal navigation. Reduced-motion preferences bypass the motion.

Background PNG masters are preserved. The application loads compressed JPG versions for the exterior, foyer, dining table, and kitchen.

No schema migration is needed. Recipe editing does not deduct stock; preparation usage and waste remain separate journal operations. Admin/chef authorization, CSRF, optimistic recipe versions, exact inventory quantities, and DELETE method override remain enforced on the server.

Verification: 38 isolated backend tests; desktop and phone browser checks using disposable fixture data, independent of Supabase and the real environment file.
