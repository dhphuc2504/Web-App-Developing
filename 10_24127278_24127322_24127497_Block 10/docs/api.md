# Restaurant API reference (Blocks 9–10)

Base path: `/api`. Requests with JSON bodies require `Content-Type: application/json`. Responses use `application/json`. Staff resources require `Authorization: Bearer <accessToken>`. No cookies or CSRF headers are used. See [authentication endpoints and limits](block9-authentication.md). Logout uses DELETE without a body.

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
| Missing, invalid or expired access token | 401 |
| Incorrect password or email OTP | 200 |
| Forbidden role or dish ownership | 403 |
| Unknown API endpoint | 404 |
| Unexpected server/database failure | 500 |

Do not branch on messages. Current codes include `VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE_VALUE`, `INVALID_REFERENCE`, `INVALID_CATEGORY`, `EMPTY_PATCH`, `CONFLICT`, `UNIT_LOCKED`, `INSUFFICIENT_STOCK`, `RECIPE_VERSION_CONFLICT`, `REQUEST_KEY_CONFLICT`, `INVALID_REQUEST`, `CONTENT_TYPE_REQUIRED`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_TOKEN`, `DISH_ACCESS_DENIED`, `ENDPOINT_NOT_FOUND`, and `INTERNAL_ERROR`.

Frontend-only errors identify transport or protocol problems: `NETWORK_ERROR`, `TIMEOUT`, `CANCELLED`, `INVALID_RESPONSE`, `HTTP_ERROR`. These are constructed by the shared client, not HTTP API business responses.

## Resources

| Method | URL | Access | Result |
|---|---|---|---|
| GET | `/auth/me` | Staff | Identity from verified JWT; zero database queries |
| POST | `/auth/login` | Public | Password check → email OTP or admin TOTP challenge |
| POST | `/auth/otp` | Public, challenge + code | Access JWT and safe identity, or replacement-code acknowledgement after last-code recovery |
| DELETE | `/auth/logout` | Staff | `{user:null}`; browser discards JWT |
| GET | `/menu` | Public | `{items,categories,total,page,pageCount}` |
| GET | `/menu/:slug` | Public | Published dish in an active category |
| GET | `/dishes` or `/dishes/:id` | Public | Published dishes only; public fields |
| GET | `/staff/dishes` or `/staff/dishes/:id` | Staff | Full staff list or record |
| POST | `/dishes` | Staff | Created dish |
| PATCH | `/dishes/:id` | Assigned chef or admin | Updated dish; only submitted writable fields change |
| DELETE | `/dishes/:id` | Admin | Archived dish |
| GET | `/dishes/:id/recipe` | Staff | `{dish,recipe,ingredients}` |
| PUT | `/dishes/:id/recipe` | Assigned chef or admin | Saved recipe with items and incremented version |
| GET | `/ingredients` or `/ingredients/:id` | Staff | Ingredient collection or record |
| POST / PATCH / DELETE | `/ingredients` / `/ingredients/:id` | Admin | Created, updated or archived ingredient |
| GET | `/ingredients/:id/movements` | Staff | `{ingredient,movements}` |
| GET | `/categories` or `/categories/:id` | Staff | Category collection or record |
| POST / PATCH / DELETE | `/categories` / `/categories/:id` | Admin | Created, updated or archived category |
| GET | `/chefs` or `/chefs/:id` | Admin | Safe chef profile(s), excluding password fields |
| POST | `/chefs` | Admin | Created chef from `{displayName,email,password}` |
| PATCH | `/chefs/:id` | Admin | Only `displayName` and `isActive` may change |
| DELETE | `/chefs/:id` | Admin | Chef with `isActive:false` |
| DELETE | `/chefs/:id/account` | Admin | Permanent deletion with `{email}` confirmation; rejects accounts referenced by recipe edits or stock journals |
| GET | `/stock-operations` | Staff | Latest 100 journal operations |
| POST | `/stock-operations` | Staff; receipt/correction admin-only | Recorded operation with movements and actor name |

Menu query parameters: `page` (positive integer), `sort` (`recommended`, `name`, `price_asc`, `price_desc`), `category` (slug), `q` (search text). Each menu page returns at most four dishes. Management lists are limited to 100 records, matching Block 5.

## Writable fields

- Dish: `name`, `slug`, `categoryId`, `description`, `priceMinor`, `preparationSummary`, `chefId` (admin only), `imagePath`, `imageAlt`, `displayOrder`, `isFeatured`, `isPublished`, `isAvailable`.
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

The example ID strings are placeholders; actual requests require UUIDs. Manual ingredient lines and recipe-based usage are mutually exclusive. The actor is taken from verified JWT claims, never from the request body. Usage/waste accept positive quantities and subtract them. Corrections accept signed deltas. Reusing the same request key with identical inputs returns the same operation; different inputs with that key return `REQUEST_KEY_CONFLICT`.

## Client architecture

Pages call resource modules through hooks. Only `client/src/api/client.js` performs HTTP requests. It checks (1) transport/timeout, (2) HTTP status and JSON envelope, and (3) application `ok`. Loading is tracked centrally and released in `finally`. Mutations are never automatically replayed. Aborted route reads do not replace current page state or display an error.

### Public full dish details

`GET /api/menu/:slug` includes `ingredients` (names only), `preparationSummary`, `estimatedMinutes` and up to three `relatedDishes`. Related dishes prefer the same category; drafts, archived dishes and inactive categories are excluded.

Public preparation copy is stored in `Dish.preparationSummary` (`preparation_summary` in PostgreSQL) and edited through the staff dish editor. It is never extracted from internal instructions. Changing a name or slug preserves the stored copy. POST/PATCH dish payloads allow an optional summary up to 5,000 characters; an empty string clears it. Estimated minutes are the sum of preparation and cooking time only when both are provided; otherwise the value is `null`. It is not a serving-time guarantee. Missing recipes return an empty ingredient list. The response excludes recipe quantities, notes, instructions, editor identity and stock balances.

### Dish photo uploads

`POST /api/dish-photos` accepts one `photo` file using `multipart/form-data`, with a chef/admin Bearer JWT. Unlike the JSON endpoints, the browser sets its multipart Content-Type boundary. Success returns `{ok:true,data:{imagePath}}`; use that URL in the subsequent dish POST/PATCH. See [photo limits and Storage setup](photo-uploads.md).

For new dishes, `slug` is optional and generated uniquely from `name` when omitted. Renaming a dish without supplying `slug` keeps its URL. Existing explicit-slug API clients remain supported. Only admins can set `isPublished` or `chefId`; chefs create drafts assigned to themselves. The UI makes these separate save actions. `preparationSummary` is also writable.

## Block 7 pagination update

The menu and staff dishes collections now use the paged response and full-text query contract in [Block 7 pagination](block7-pagination.md). This supersedes the earlier four-item-only menu and 100-record dish list descriptions. `/api/dishes` now returns `{items, categories, total, page, pageSize, pageCount, hasNext, mode}` inside `data`, not an array. All other resource lists retain their existing response shapes.

## Administrator authenticator routes

Optional TOTP enrollment, recovery-code replacement and disabling use `/api/auth/mfa`. Login now returns `method: "email"` or `method: "totp"`; `/api/auth/otp` accepts `method: "recovery"` for a saved one-use recovery code. The final recovery code requires acknowledging a replacement set before a JWT is issued. See the complete [MFA route contract](block9-authentication.md#additional-api-routes).
