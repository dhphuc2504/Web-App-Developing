# Block 6 project rules

- JavaScript, React, React Router, Express, Prisma and Supabase. React owns rendering; Express serves JSON under /api.
- Preserve the restaurant schema and the completed restaurant-mvc sibling. Do not run migrations or seed the shared database without an explicit request.
- Never inspect, print, copy or transmit real .env files. Existing runtime configuration may load credentials privately. Maintain .env.example only after initial creation.
- API success: HTTP 200 {ok:true,data}. Expected business failures: HTTP 200 {ok:false,error:{code,message,fields?}}. Authentication/authorization: 401/403. Unexpected failures: 500. Unknown API endpoints: 404.
- Centralize response handling, writable-field validation and client HTTP/error processing. Pages never call fetch directly.
- Use actual DELETE for archive and logout. Preserve CSRF, HttpOnly sessions, role enforcement, inventory transactions and request-key idempotency.
- No customer accounts, ordering or booking. Chefs manage dishes/recipes/usage/waste; admins additionally manage ingredients/categories/receipts/corrections/staff.
