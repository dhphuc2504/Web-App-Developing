import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { testDatabase } from "./database.js";
const migration = await readFile(
  new URL(
    "../prisma/migrations/202610190001_public_preparation_summary/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
test("summary migration preserves existing dish fields, backfills known dishes and preserves existing summaries on rerun", async () => {
  const fixture = await testDatabase();
  try {
    const { engine, db } = fixture;
    await engine.exec(`ALTER TABLE restaurant.dishes DROP COLUMN preparation_summary;
 INSERT INTO restaurant.categories(id,name,slug) VALUES ('00000000-0000-4000-a000-000000000001','Existing category','existing');
 INSERT INTO restaurant.dishes(id,category_id,name,slug,price_minor,description) VALUES ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001','Matcha mochi','demo-matcha-mochi',65000,'Keep my description');`);
    const before = (
      await engine.query("SELECT to_jsonb(d) AS data FROM restaurant.dishes d")
    ).rows[0].data;
    await engine.exec(migration);
    const after = await db.dish.findFirst();
    assert.match(after.preparationSummary, /strawberries/);
    const afterOld = (
      await engine.query(
        "SELECT to_jsonb(d) - 'preparation_summary' AS data FROM restaurant.dishes d",
      )
    ).rows[0].data;
    assert.deepEqual(afterOld, before);
    await db.dish.update({
      where: { id: after.id },
      data: {
        preparationSummary: "Custom public story",
        slug: "renamed-mochi",
      },
    });
    await engine.exec(migration);
    assert.equal(
      (await db.dish.findFirst()).preparationSummary,
      "Custom public story",
    );
  } finally {
    await fixture.close();
  }
});
