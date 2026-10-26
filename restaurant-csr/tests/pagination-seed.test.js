import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.js";
import {
  seedPaginationDishes,
  PAGINATION_PREFIX,
} from "../scripts/demo/seed-pagination.js";
test("pagination seed adds 1200 dishes, reuses photos and preserves original and edited fixtures on rerun", async () => {
  const fixture = await testDatabase();
  const db = fixture.db;
  try {
    const category = await db.category.create({
      data: { name: "Mains", slug: "mains" },
    });
    const original = await db.dish.create({
      data: {
        name: "Miso ramen",
        slug: "miso-ramen",
        categoryId: category.id,
        priceMinor: 75000n,
        imagePath: "/images/japan/food-atlas.png",
      },
    });
    const first = await seedPaginationDishes(db);
    assert.equal(first.created, 1200);
    assert.equal(first.publishedDemoDishes, 1080);
    assert.deepEqual(
      await db.dish.findUnique({ where: { id: original.id } }),
      original,
    );
    assert.equal(
      await db.dish.count({ where: { imagePath: original.imagePath } }),
      1201,
    );
    const demo = await db.dish.findFirst({
      where: { slug: { startsWith: PAGINATION_PREFIX } },
    });
    const edited = await db.dish.update({
      where: { id: demo.id },
      data: { name: "Keep this edit", archivedAt: new Date() },
    });
    await db.dish.update({
      where: { id: original.id },
      data: { slug: "renamed-source" },
    });
    const second = await seedPaginationDishes(db);
    assert.equal(second.created, 0);
    assert.equal(second.totalDishes, 1201);
    assert.deepEqual(
      await db.dish.findUnique({ where: { id: demo.id } }),
      edited,
    );
    assert.equal(await db.recipe.count(), 0);
    assert.equal(await db.stockOperation.count(), 0);
  } finally {
    await fixture.close();
  }
});
