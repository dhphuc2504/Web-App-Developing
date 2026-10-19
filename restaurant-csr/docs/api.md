# Block 6 API reference

Base path: `/api`. Requests with JSON bodies require `Content-Type: application/json`. Responses use `application/json`. Cookie authentication is required for staff resources. Mutations require the `X-CSRF-Token` header obtained from `GET /api/session` or successful login. Logout uses DELETE without a body.

## Response envelopes

```json
{"ok":true,"data":{"id":"uuid","name":"Miso ramen"}}
```

```json
{"ok":false,"error":{"code":"VALIDATION_ERROR","message":"Please check the submitted fields.","fields":{"name":"Required"}}}
```

| Situation | HTTP status |
|---|---|
| Success, including creation and archive | 200 |
| Expected validation, missing record, duplicate or stock conflict | 200 |
| Missing login or invalid credentials | 401 |
| Forbidden role or invalid CSRF token | 403 |
| Unknown API endpoint | 404 |
| Unexpected server/database failure | 500 |

Do not branch on messages. Current codes include `VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE_VALUE`, `INVALID_REFERENCE`, `INVALID_CATEGORY`, `EMPTY_PATCH`, `CONFLICT`, `UNIT_LOCKED`, `INSUFFICIENT_STOCK`, `RECIPE_VERSION_CONFLICT`, `REQUEST_KEY_CONFLICT`, `INVALID_REQUEST`, `CONTENT_TYPE_REQUIRED`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN`, `CSRF_INVALID`, `ENDPOINT_NOT_FOUND`, and `INTERNAL_ERROR`.

Frontend-only errors identify transport or protocol problems: `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`, `INVALID_RESPONSE`, `HTTP_ERROR`. These are constructed by the shared client, not HTTP API business responses.

## Resources

| Method | URL | Access | Result |
|---|---|---|---|
| GET | `/session` | Public | `{user, csrfToken}` |
| POST | `/session` | Public + CSRF | Login using `{email,password}`; rotated session and CSRF token |
| DELETE | `/session` | Staff | `{user:null}` after session destruction |
| GET | `/menu` | Public | `{items,categories,total,page,pageCount}` |
| GET | `/menu/:slug` | Public | Published dish in an active category |
| GET | `/dishes` or `/dishes/:id` | Staff | Dish collection or record |
| POST | `/dishes` | Staff | Created dish |
| PATCH | `/dishes/:id` | Staff | Updated dish; only submitted writable fields change |
| DELETE | `/dishes/:id` | Staff | Archived dish |
| GET | `/dishes/:id/recipe` | Staff | `{dish,recipe,ingredients}` |
| PUT | `/dishes/:id/recipe` | Staff | Saved recipe with items and incremented version |
| GET | `/ingredients` or `/ingredients/:id` | Staff | Ingredient collection or record |
| POST / PATCH / DELETE | `/ingredients` / `/ingredients/:id` | Admin | Created, updated or archived ingredient |
| GET | `/ingredients/:id/movements` | Staff | `{ingredient,movements}` |
| GET | `/categories` or `/categories/:id` | Staff | Category collection or record |
| POST / PATCH / DELETE | `/categories` / `/categories/:id` | Admin | Created, updated or archived category |
| GET | `/chefs` or `/chefs/:id` | Admin | Safe chef profile(s), excluding password fields |
| POST | `/chefs` | Admin | Created chef from `{displayName,email,password}` |
| PATCH | `/chefs/:id` | Admin | Only `displayName` and `isActive` may change |
| DELETE | `/chefs/:id` | Admin | Chef with `isActive:false` |
| GET | `/stock-operations` | Staff | Latest 100 journal operations |
| POST | `/stock-operations` | Staff; receipt/correction admin-only | Recorded operation with movements and actor name |

Menu query parameters: `page` (positive integer), `sort` (`recommended`, `name`, `price_asc`, `price_desc`), `category` (slug), `q` (search text). Each menu page returns at most four dishes. Management lists are limited to 100 records, matching Block 5.

## Writable fields

- Dish: `name`, `slug`, `categoryId`, `description`, `priceMinor`, `imagePath`, `imageAlt`, `displayOrder`, `isFeatured`, `isPublished`, `isAvailable`.
- Ingredient: `name`, `description`, `baseUnit` (`g`, `ml`, `piece`), `lowStockThreshold`, `isActive`. Balance changes must use stock operations.
- Category: `name`, `slug`, `description`, `displayOrder`, `isActive`.
- Recipe: `version`, `instructions`, `preparationMinutes`, `cookingMinutes`, `items` containing `ingredientId`, `quantity`, `notes`.

Send booleans as JSON booleans. Send prices and exact ingredient quantities as decimal strings. Use actual UUIDs for IDs. Invalid path IDs are rejected before record lookup. Optional description fields can be empty or null. PATCH requests must contain at least one allowed field.

## Stock operations

Manual receipt, usage, waste or correction:

```json
{
  "type":"receipt",
  "reason":"Supplier delivery",
  "requestKey":"a-new-uuid-for-this-operation",
  "lines":[{"ingredientId":"ingredient-uuid","quantity":"2000"}]
}
```

Recipe preparation:

```json
{
  "type":"usage",
  "reason":"Evening preparation",
  "requestKey":"a-new-uuid-for-this-operation",
  "recipeId":"recipe-uuid",
  "recipeVersion":2,
  "servings":4
}
```

The example ID strings are placeholders; actual requests require UUIDs. Manual ingredient lines and recipe-based usage are mutually exclusive. The actor is taken from the session, never from the request body. Usage/waste accept positive quantities and subtract them. Corrections accept signed deltas. Reusing the same request key with identical inputs returns the same operation; different inputs with that key return `REQUEST_KEY_CONFLICT`.

## Client architecture

Pages call resource modules through hooks. Only `client/src/api/client.js` performs HTTP requests. It checks (1) transport/timeout, (2) HTTP status and JSON envelope, and (3) application `ok`. Loading is tracked centrally and released in `finally`. Mutations are never automatically replayed. Aborted route reads do not replace current page state or display an error.

### Public full dish details

`GET /api/menu/:slug` includes `ingredients` (names only), `preparationSummary`, `estimatedMinutes` and up to three `relatedDishes`. Related dishes prefer the same category; drafts, archived dishes and inactive categories are excluded.

Public preparation copy is stored in `Dish.preparationSummary` (`preparation_summary` in PostgreSQL) and edited through the staff dish editor. It is never extracted from internal instructions. Changing a name or slug preserves the stored copy. POST/PATCH dish payloads allow an optional summary up to 5,000 characters; an empty string clears it. Estimated minutes are the sum of preparation and cooking time only when both are provided; otherwise the value is `null`. It is not a serving-time guarantee. Missing recipes return an empty ingredient list. The response excludes recipe quantities, notes, instructions, editor identity and stock balances.

### Dish photo uploads

`POST /api/dish-photos` accepts one `photo` file using `multipart/form-data`, with a chef/admin session and CSRF header. Unlike the JSON endpoints, the browser sets its multipart Content-Type boundary. Success returns `{ok:true,data:{imagePath}}`; use that URL in the subsequent dish POST/PATCH. See [photo limits and Storage setup](photo-uploads.md).

For new dishes, `slug` is optional and generated uniquely from `name` when omitted. Renaming a dish without supplying `slug` keeps its URL. Existing explicit-slug API clients remain supported. `isPublished:false` saves a draft; `true` publishes it. The UI makes these separate save actions. `preparationSummary` is also writable.
