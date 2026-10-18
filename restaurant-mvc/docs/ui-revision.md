# Santaishi-tei restaurant experience

The restaurant is branded 三太子亭 — Santaishi-tei across the public and staff pages. The application remains Express/EJS SSR with Prisma and MVC. JavaScript enhances HTML returned by the server; ordinary page links and form submissions remain available.

- Dining: a two-page menu book on a Japanese dining-table background, four dishes per spread, accessible dish dialogs, two-sided 800 ms page-turn animation with moving paper shading and floor shadows, category/search/sort controls, and browser history.
- Kitchen: a Japanese kitchen background, clipped dish tickets, and a paper editor that opens the server-rendered dish or recipe form. Successful POSTs redirect with HTTP 303 to the board. The sheet returns only after a successful response; validation/conflict responses retain submitted values.
- Pantry: shelf and list views, search and low-stock filters, ingredient labels opening protected ledgers, recent stock movements, recipe references, and preselected stock forms.
- House: glowing arrows projected onto the floor toward the three doorways, with short guidance on hover/focus and visible guidance on phones.
- Movement: two full-screen shoji panels close from the left and right over 550 ms before room navigation. The new server-rendered room starts behind the same closed panels, which slide apart over 700 ms. The transition contains no guide text, zoom or page fade. Links inside the same room, including kitchen subpages, use normal navigation. Reduced-motion preferences bypass the panels.

Background PNG masters are preserved. The application loads compressed JPG versions for the exterior, foyer, dining table, and kitchen.

No schema migration is needed. Recipe editing does not deduct stock; preparation usage and waste remain separate journal operations. Admin/chef authorization, CSRF, optimistic recipe versions, exact inventory quantities, and DELETE method override remain enforced on the server.

Verification: 53 isolated tests covering backend behavior, server lifecycle and room transitions. Desktop and phone browser checks use disposable fixture data, independent of Supabase and the real environment file; they confirm full-screen panels, keyboard room changes, normal menu/pantry/journal navigation, and browser Back recovery.
