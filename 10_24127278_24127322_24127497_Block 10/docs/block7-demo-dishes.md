# Block 7 demonstration dishes

Run `npm run demo:seed:dishes` from `restaurant-csr` to insert the 1,200-dish demonstration set into the configured database. The command uses normal private runtime configuration and suppresses provider errors and credentials.

The importer reuses active existing dishes as templates and retains their category and image path. It creates no images, uploads, categories, recipes, ingredients or stock movements. Descriptions explicitly identify synthetic demonstration data. Names combine a location label, a source dish name and a numbered suffix; prices vary between 35,000 and 500,000 VND. Synthetic creation dates are spread across 50 days to support newest/oldest sorting exercises.

The initial set contains 1,080 published dishes and 120 drafts, with varied availability and featured flags. Slugs begin with `block7-demo-` and contain a stable four-digit number. Existing matching numbers are skipped on reruns, including archived or edited records. Do not manually change this identifying prefix/number if the importer will be rerun.

Inserts run in a transaction in batches of 100. Existing records are never updated. The command compares a fingerprint of original dishes before and after the import and prints counts only. The isolated seed test verifies rerun behavior, preservation and image reuse without loading `.env`.

This is the data preparation stage. Pagination/filtering improvements and new indexes are separate work; existing management list limits may prevent all dishes appearing at once in the kitchen.
