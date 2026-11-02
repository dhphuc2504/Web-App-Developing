# Block 7 presentation script

**Audience:** lecturer and classmates  
**Suggested duration:** 12–15 minutes, including a 2-minute demo  
**Team:** Tam Thái Tử — 24127278, 24127322, 24127497  
**Prepared:** 2 November 2026

Keep this file on a separate device or private display. It is deliberately not linked from the projected slide interface. The HTML contains audience-facing content only.

## Before presenting

1. Open `index.html` and test the slide selector, arrow keys and projector resolution. Use the browser's full-screen mode for the presentation.
2. Start the application before class. For an isolated demo, run these commands from `restaurant-csr`:

   ```sh
   npm ci
   npm run db:generate
   npm run build
   npm run preview:fixture -- --large
   ```

3. Open `http://127.0.0.1:3003`. This preview needs no Supabase credentials after dependencies are installed and uses disposable data. The chef account is `chef@example.test`; the password is `Fixture-only-passphrase-2026`. These credentials do not apply to the real database.
4. Keep database dashboards, terminal secrets and `.env` files off the projector. Do not perform live database imports during the presentation.
5. If the demo cannot start, use slides 2 and 6–11 to explain the interaction and implementation. The slide files and images are local and need no network.

## Slide 1 — Title · 30 seconds

“Good morning. We are Tam Thái Tử. Our project is Santaishi-tei, a Japanese restaurant website. In Block 6 we built its React interface and REST API. For Block 7, we focused on making a growing menu practical to browse: pagination, filtering, sorting and search.”

Transition: “We will show the result first, then explain how the data moves through the system.”

## Slide 2 — The final experience · 45 seconds

“The dining room keeps the menu-book design. The kitchen keeps its order-board layout. Both use the same browsing components and API query rules, but permissions differ. Visitors see published, active dishes; staff can also filter drafts and archived records. Advanced filters stay folded away until needed, and the final toolbar is compact enough to leave the dishes visible.”

The dining image shows the compact toolbar. The kitchen image is an implementation capture illustrating the advanced-filter panel, rather than a claim that every historical control in that screenshot is the final layout.

## Slide 3 — Live demonstration · 2 minutes

“First, I will search for a dish with two misspelled words. Nothing is sent while I type; pressing Enter submits the search.”

Demo sequence:

1. In dining, type `salomn nigiir`. Pause before Enter to show that the current results remain unchanged. Press Enter and show Salmon nigiri results.
2. Open Advanced search. Choose a price range broad enough to leave multiple results, such as 35,000–500,000 VND, and apply it. Sort by price low–high. Point to the filter chips and changed URL.
3. Select Page numbers and go to page 2. Point out the menu flip. Then select Load more and append one batch.
4. Select Infinite scroll and scroll to the end. Explain that only one batch is pending at a time. Press Pause to stop further automatic requests; a pending batch may finish.
5. Copy the URL and reload. The query and saved batch return. Explain that previously appended batches are not all fetched again.
6. If time permits, sign into the disposable kitchen as chef and show the staff Status filter. Do not mutate live data.

Fallback: show the screenshots and describe this sequence without switching away from the slides.

Transition: “Those interactions map directly to the exercise requirements.”

## Slide 4 — Requirements and scope · 45 seconds

“The exercise required more than a thousand dish records, three pagination modes, server-side filtering and sorting, at least full-text search, and bookmark URLs. We kept the same application folder and database as Block 6. We did not add ordering or customer accounts. The focus was on discovery and browsing, with the existing role rules preserved.”

## Slide 5 — Data preparation · 1 minute

“We inserted 1,200 synthetic dishes using existing dishes as templates. Of that import, 1,080 were published and 120 were drafts. Prices, availability and dates vary, so filters and sorts have meaningful examples. Images and categories are reused; no new image generation was needed.”

“The importer is insert-only and uses stable numbered slugs to identify its records. Running it again skips those numbers, including edited or archived demo dishes. It compares original records before and after. At the original import, eleven dishes plus the new set gave 1,211 total. That is a recorded import result, not a promise that the live count can never change.”

The Block 7 import does not create recipes, ingredients or stock journals. Those belong to earlier work. Its source dishes and categories must already exist when using the real importer.

## Slide 6 — Request workflow · 1 minute

“An action updates the URL state. The React hook builds the request through a resource module and the shared HTTP client. Express handles authorization and validation. The controller calls the model/query layer, which uses Prisma and PostgreSQL to filter, sort and fetch the requested batch. React then replaces or appends the displayed dishes.”

“The shared client handles network failures, HTTP/protocol failures and application errors. Pages do not call fetch directly. The successful API response keeps the existing ok/data shape.”

The diagram groups backend layers for readability. The paginated query uses Prisma's parameterized raw SQL for PostgreSQL search and bounded ID selection, followed by a Prisma record read; not every resource takes an identical service path.

## Slide 7 — Server paging · 1 minute

“For page three with twelve dishes per page, the offset is twenty-four. The database selects the next twelve matching IDs. A second Prisma read retrieves only those selected records. A separate count aggregate supplies the total—it does not load all records into Node or React.”

“We use a repeatable-read transaction so count and rows agree within the request. The unique ID is the final sort key to make ties deterministic. The last page can contain fewer than twelve results. Deep offsets still have a cost; the claim is bounded returned data, not constant database work for every page.”

## Slide 8 — Three pagination modes · 1 minute

“All modes share offset-based server paging. Numbered pages replace the batch and support jumping. Load more appends only after a click. Infinite scroll automatically requests another batch when the end is visible.”

“The infinite flow allows one request at a time. After completion, the observer checks again. If the end has moved outside the viewport, it waits. If the end is still visible, it continues. Pause, errors and the end of results stop automatic loading. Mode controls stay available, and obsolete reads are cancelled.”

Earlier versions required scrolling away and back to re-arm the trigger. User feedback found that awkward, so the final version returned to automatic loading with Pause/Resume. Do not demonstrate the earlier gesture as a final requirement.

## Slide 9 — Full-text search and filters · 1 minute

“Search uses the dish name and public description. Names carry more weight when sorting by relevance. Plain words are combined with AND, so all words must match, but their order is flexible. That is why ‘tempura shrimp’ can find ‘Shrimp tempura’. Prefix matching lets ‘temp’ find ‘tempura’. Quoted phrases keep their order.”

“Filters and sorting execute on the server before paging. Advanced-filter changes stay local until Apply, while basic search waits for Enter or Search. Staff-only status choices do not expose drafts through the public endpoint.”

## Slide 10 — Fuzzy search bug and fix · 90 seconds

“Fuzzy search first used PostgreSQL trigram similarity. Trigrams are overlapping groups of three characters. Swapping two adjacent letters can change several groups, even though a person recognizes the typo immediately. Our threshold handled ‘temupra’ but missed the ‘salomn nigiir’ example.”

“We kept the threshold and added a generic adjacent-letter swap path. The server generates the possible one-swap variants of each eligible query word, then matches them as whole full-text lexemes. It still requires all input words to match. This is not a hard-coded rule for one dish.”

“Regression tests cover Salmon nigiri, Matcha mochi and Chicken teriyaki, including reversed query order and unrelated-word rejection. Fuzzy matching is heuristic; multiple edits, accents and all spelling errors are not guaranteed.”

The trigram diagram omits boundary markers to stay readable. The fuzzy threshold is 0.3, and approximate/swap matching is applied to plain words of at least four characters. Explicit quoted phrases, OR and exclusions retain web-search semantics.

## Slide 11 — UX decisions and bookmarks · 90 seconds

“The interface changed through feedback. We stopped requests while typing, folded advanced filters into the paper design, moved dish reads away from global interaction locks, and reduced the toolbar's height. The final toolbar stays available in every pagination mode.”

“Bookmarks store the submitted search, sort, filters, mode and current batch. The client also tracks a dish anchor to restore position. Reloading a Load more or infinite URL requests the saved batch directly, not every previous batch. Back and Forward restore historical query state. A bookmark is not a frozen data snapshot: if records change, matching dishes can change too.”

“Mutations retain loading protection. The nonblocking exception is for dish-list browsing, so saving a recipe or recording stock is not suddenly open to repeated submissions.”

## Slide 12 — Verification and conclusion · 1 minute

“The current automated suite passed 44 tests on 2 November 2026, using an isolated PostgreSQL-compatible database. Tests cover API contracts, permissions, imports, page boundaries, full-text and fuzzy search. Browser checks during implementation covered loading, mode switching and bookmark restoration.”

“Read-only checks on the exercise database in October confirmed that the relevant query plans used price, full-text and trigram indexes. Migration fingerprints confirmed that business records were preserved. These are concrete checks, not a production load benchmark.”

“Offset paging is suitable for this course dataset. At a much larger scale, deep pages and long scrolling sessions would benefit from cursor pagination and virtualization. Our main lesson is to keep each read bounded, each browsing state recoverable, and controls responsive.”

Finish: “Thank you. We are ready for questions.”

## Decision log

| Decision | Reason / consequence |
|---|---|
| Continue in `restaurant-csr` and reuse the database | Preserve Block 6 work; changes affect shared restaurant records |
| Insert 1,200 dishes; reuse image paths | Meet the dataset requirement without generating assets |
| Stable numbered demo slugs | Reruns skip existing demo records |
| Server-side count + bounded ID/read queries | Return only requested records and useful page metadata |
| Offset paging in all modes | Supports direct page numbers and bookmarkable batches; deep offsets remain a tradeoff |
| Unique ID as final sort key | Avoid ambiguous order when names/prices/dates tie |
| Repeatable-read transaction | Keep count and selected rows consistent per request |
| Shared dining/kitchen query implementation | Reuse behavior while applying different visibility rules |
| Full-text GIN and targeted B-tree indexes | Support search and common sort/filter patterns |
| pg_trgm and GIN index | Add approximate word matching on the server |
| Adjacent-letter swap lexemes | Fix short-word transpositions without lowering every similarity threshold |
| Explicit Enter/Search submission | Avoid a request for every partial input |
| Apply advanced filters as a group | Keep UI quiet and reduce unnecessary requests |
| Compact common floating toolbar | Make mode controls accessible without hiding much content |
| Background list reads + duplicate-request guard | Keep navigation usable without concurrent append requests |
| Automatic end-of-list recheck + Pause/Resume | Remove the awkward re-arm gesture while preserving user control |
| Abort stale reads; retry failed append in place | Prevent obsolete results and preserve earlier loaded batches |
| URL query and dish anchor | Restore browsing state; deliberately not a database snapshot |
| Preserve private recipe details and role checks | Search improvements must not change access permissions |

## Evidence and limitations

- Current source: `src/models/dish-query.js`, `client/src/hooks/useDishBrowser.js`, `client/src/components/DishBrowserControls.jsx`.
- Migrations: `202610260001_dish_search_indexes`, `202610260002_dish_fuzzy_search`.
- Automated verification: `npm test`, run 2 November 2026; 44 tests passed.
- Historical live checks, 26 October 2026: 1,211 total dishes; two 12-row public batches with no overlap; `salomn nigiir` returned 99 published matches. Counts can change after edits.
- Existing screenshots were captured during implementation. Temporary preview totals differ from the shared database totals because fixtures are separate.
- No before/after speedup claim is made. Individual query-plan timings exclude HTTP/network overhead.
- The prepared slide deck contains no live database calls, remote fonts, CDN dependencies or presenter notes.
