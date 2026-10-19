# Demo recipes and inventory

This opt-in import adds demonstration kitchen data to the database configured for the application. It loads connection settings through the existing server configuration and never prints credentials. It does not run automatically at startup.

```sh
npm run demo:seed -- --plan
npm run demo:seed
```

The first command is a read-only inventory of existing dishes, ingredients and staff-role counts. The second applies the import. Both Block 5 and Block 6 display the imported data when they share a database.

## Contents

- Recipes for the nine matching existing Japanese dishes, with per-serving allocations, instructions and preparation/cooking times.
- Thirty shared ingredients with gram, millilitre or piece units. Existing ingredients are reused without overwriting their descriptions or thresholds.
- Four opening receipts, nine recipe-usage operations, two manual usage operations, three waste operations, two corrections and two restocks: 22 journal entries when all nine recipes can be created.
- All new recipes, ingredient descriptions and journal reasons are marked `[DEMO]`. Journals use actual import timestamps and existing active staff accounts as actors; the reason makes clear that the activity is simulated.
- Mushrooms, nori and strawberries finish below their proposed low-stock thresholds, while retaining stock for demonstration.

Recipes are illustrative presentation data, not production kitchen specifications. Rice quantities are dry weight; oil quantities represent allocated consumption rather than fryer capacity. Water is not tracked.

## Preservation and repeatability

The import does not create or change dishes, categories, staff accounts or sessions. It creates recipes only for dishes without a recipe. Existing recipes are preserved, and their stock usage is not simulated. Existing ingredient balances receive additive, journalled stock changes; they are never reset.

Stable operation request keys and recipe IDs prevent duplicate demo imports. A transaction-level lock serializes simultaneous imports. All additions run in one transaction using the stock service's validation, row locks and movement calculations. Any failure rolls back the entire import. Existing journal entries are never edited or removed.

Conflicting ingredient units, inactive/archived ingredient matches or ambiguous dish/ingredient matches stop the import for review rather than overwrite existing records. Missing dishes are reported and skipped. Rerunning after a normal completed import changes nothing; it does not top up stock consumed later by users.

## Verification

```sh
node --test tests/demo-inventory.test.js
```

These isolated database tests verify repeatability, balance reconciliation, preservation of existing dishes/accounts/recipes/history, and atomic rollback. They do not load environment credentials or connect to Supabase.

## Completed import — 19 October 2026

The configured Supabase database received 27 new ingredients (reusing Rice, Seasonal vegetables and Cooking oil), nine recipes, 22 stock operations and 98 stock movements. No dishes, categories or staff accounts were changed. All nine existing dishes matched the recipe plan.

A second live run added zero ingredients, recipes, operations or movements, and reported identical balances. All three isolated import tests passed.

Low-stock examples immediately after import:

| Ingredient | Stock | Threshold |
|---|---:|---:|
| Mushrooms | 410 g | 500 g |
| Nori | 38 g | 40 g |
| Strawberries | 140 g | 200 g |

Later use of the application will naturally change these balances. Rerunning the import does not reset them.
