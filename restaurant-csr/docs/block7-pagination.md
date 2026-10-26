# Block 7: database paging, filtering and search

The dining menu and kitchen dish board expose **Page numbers**, **Load more**, and **Infinite scroll**. The existing database and schema are reused. The index migration changes no dish, category, recipe, ingredient, staff or stock records.

## Request and response

Both `GET /api/menu` (public) and `GET /api/dishes` (chef/admin) accept:

| Parameter | Values / behavior |
|---|---|
| `page` | 1–100000; out-of-range pages clamp to the last matching page |
| `pageSize` | 1–48; default 4 for dining, 12 for staff; UI offers 4, 12, 24, 48 |
| `mode` | `pages`, `more`, `infinite` |
| `q` | Full-text query, up to 100 characters; name and description |
| `category` | Category slug |
| `sort` | `recommended`, `name`, `name_desc`, `price_asc`, `price_desc`, `newest`, `oldest`, `relevance` |
| `availability` | empty, `available`, `unavailable` |
| `status` | Staff only: empty (active), `published`, `draft`, `archived`, `all` |
| `minPrice`, `maxPrice` | Optional nonnegative integer VND amounts, at most 1 billion |

Success remains `{ok:true,data}`. Data contains `items`, `categories`, `total`, `page`, `pageSize`, `pageCount`, `hasNext`, and `mode`. **The staff dishes endpoint now returns this object instead of the old array.** Other resource lists are unchanged. Validation and authorization preserve the existing error conventions.

The server executes a count aggregate, a filtered/sorted ID query with SQL LIMIT/OFFSET, and a Prisma read of only those selected IDs. The count does not load all dish records into the application. A repeatable-read transaction keeps metadata and rows consistent within a request. Unique ID is the final sort key. The final page or an empty result can contain fewer records than `pageSize`.

All three modes use bounded offset paging. Load more and infinite scroll append only newly requested rows; they do not prefetch the whole collection. Previously loaded rows remain in browser memory until the query changes, refreshes or navigates back. This is suitable for the course dataset; very deep offsets and long sessions may eventually benefit from cursor paging and virtualization.

## Full-text search and indexes

PostgreSQL full-text queries search an expression combining name (weight A) and description (weight B). `ts_rank` provides optional relevance sorting. Queries are parameterized; ordering is selected from a server whitelist. Plain words match token prefixes: `temp` matches `tempura`, and `shr temp` matches `shrimp tempura`. Multiple plain words must all match. Quoted phrases, uppercase OR and exclusions keep PostgreSQL web-search semantics. Plain queries also support fuzzy matching for words of four or more characters using PostgreSQL pg_trgm strict word similarity (threshold 0.3). For example, `temupra shrimp` and `tempura shrmp` find Shrimp tempura. Adjacent-letter swaps are additionally matched as whole full-text lexemes, so `salomn nigiir` finds Salmon nigiri without lowering the similarity threshold. Every word must match a prefix, a swapped-letter variant or an approximate word in the name/description, regardless of order. Short words remain prefix-only. Quoted phrases, OR and exclusions retain their original full-text semantics. Relevance sorting puts full-text matches ahead of approximate matches. Approximate matching is heuristic, not guaranteed correction of every typo; accent normalization is not provided. The `simple` dictionary avoids applying English stemming to Japanese dish names written in Latin letters.

Migration `202610260001_dish_search_indexes` contains a GIN expression index and partial B-tree indexes for public price, category/price, name and creation date. These SQL-managed expression/partial indexes are tracked in the migration; do not replace them with `db push`. Run `npm run db:migrate:search` for deployment and `npm run db:check:search` for read-only query-plan checks. Both commands keep runtime credentials private.

On 26 October 2026, the live check returned 12 rows per requested batch with no overlap. The tested price query used `dishes_public_price_id`; the tested text query used `dishes_search_gin`. Observed execution times were about 1.46 ms and 0.07 ms respectively, excluding HTTP/network overhead. These are individual measurements, not guaranteed performance or a before/after benchmark.

## Bookmarks and navigation

Example: `/kitchen?mode=pages&page=2&pageSize=12&q=miso&sort=price_desc`.

The URL retains filters, search, sort, mode and current batch; an `anchor` dish ID is added for restoring the visible position. The anchor is client navigation state and does not widen the database query. A load-more/infinite bookmark loads the bookmarked batch directly, without downloading earlier batches. Further requests append from that position. Browser Back/Forward replaces accumulated rows with the selected historical batch. Protected kitchen bookmarks return to their query after login.

A bookmark is not a database snapshot. Later CRUD changes may alter matching rows. If the anchor no longer exists, the selected batch still renders. Changing controls resets to page 1. Editing or archiving refreshes the current batch; disappearing final pages clamp safely. Staff archived records remain read-only in the board.

Dining and kitchen keep basic search and sorting visible. Advanced search opens a collapsible paper panel for category, availability and price; kitchen also offers publication/archive status. Panel edits remain local until Apply filters. Reset filters clears advanced filters while preserving the submitted search and sort. Active filter chips and counts remain visible when collapsed. All three modes share a floating toolbar: page numbers have navigation and a page input, Load more has a fetch button, and infinite scroll has Pause/Resume. The infinite trigger stays at the end of the dish list, separate from the floating controls. Applied values stay in the URL and restore on reload or Back/Forward.

Typing only updates the input. Search is submitted with Enter or the Search button; no search requests are sent while typing. New requests cancel stale requests. Dish-list reads use background loading, so the application stays interactive. The next-batch action is disabled while pending; duplicate append requests are guarded. Changing modes or filters aborts stale reads. Writes still use global loading protection. Infinite scroll rechecks the end-of-list trigger after each completed batch. If it remains visible, the next batch loads automatically, with only one request in flight. It stops when paused, on errors, when the end leaves the viewport, or when no more results remain. Retrying a failed appended batch preserves previously displayed batches. Pause prevents future automatic loads (an already pending batch may finish). Manual Load more remains available. Dining remains visible during requests; numbered pages keep the flip animation, while append modes add book spreads without moving existing dishes between sides. Infinite scroll has a manual Load more fallback. Existing security and public/private data separation remain enforced on the server.

## Verification

`npm test` uses an isolated database, including migrations and paging/search tests. `npm run preview:fixture -- --large --trace` starts a disposable browser preview with 1,200 additional mock dishes; it never loads `.env` or connects to Supabase. Live migration verification compared fingerprints of all application data tables (excluding session activity) and confirmed preservation.


Fuzzy-search migration: `202610260002_dish_fuzzy_search` installs pg_trgm if needed, preserves an existing extension location, and adds an inline SQL matching helper plus `dishes_fuzzy_search_idx`. No restaurant rows are changed. Apply via `npm run db:migrate:search`; verify via `npm run db:check:search`.
