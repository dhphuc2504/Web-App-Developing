import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.js";
import { createRepository } from "../src/models/repository.js";
test("public dish details expose only ingredient names and estimated time, with published related dishes", async () => {
  const fixture = await testDatabase(),
    db = fixture.db;
  try {
    const staff = await db.staffUser.create({
      data: {
        email: "private@example.test",
        displayName: "Private chef",
        passwordHash: "private-hash",
        role: "chef",
      },
    });
    const cat = await db.category.create({
      data: { name: "Warm dishes", slug: "warm" },
    });
    const hiddenCat = await db.category.create({
      data: { name: "Hidden", slug: "hidden", isActive: false },
    });
    const create = (slug, extra = {}) =>
      db.dish.create({
        data: {
          name: slug,
          slug,
          categoryId: cat.id,
          priceMinor: 90000n,
          isPublished: true,
          ...extra,
        },
      });
    const dish = await create("demo-salmon-teriyaki");
    await create("visible");
    await create("draft", { isPublished: false });
    await create("archived", { archivedAt: new Date() });
    await create("hidden-category", { categoryId: hiddenCat.id });
    const ingredient = await db.ingredient.create({
      data: {
        name: "Salmon",
        baseUnit: "g",
        quantityOnHand: "999",
        lowStockThreshold: "5",
        description: "Private supplier note",
      },
    });
    await db.recipe.create({
      data: {
        dishId: dish.id,
        updatedBy: staff.id,
        instructions: "SECRET kitchen process",
        preparationMinutes: 10,
        cookingMinutes: 20,
        items: {
          create: {
            ingredientId: ingredient.id,
            quantity: "180",
            notes: "SECRET allocation",
          },
        },
      },
    });
    const repo = createRepository(db),
      detail = await repo.menu.detail(dish.slug);
    assert.deepEqual(detail.ingredients, ["Salmon"]);
    assert.equal(detail.estimatedMinutes, 30);
    assert.match(detail.preparationSummary, /glazed/);
    assert.deepEqual(
      detail.relatedDishes.map((d) => d.slug),
      ["visible"],
    );
    const encoded = JSON.stringify(detail, (_, value) =>
      typeof value === "bigint" ? String(value) : value,
    );
    for (const secret of [
      "SECRET",
      "Private",
      "private@",
      "passwordHash",
      "quantity",
      "instructions",
      "recipeVersion",
      "updatedBy",
      "supplier",
    ])
      assert.ok(!encoded.includes(secret), secret);
    assert.equal(detail.recipe, undefined);
    for (const slug of ["draft", "archived", "hidden-category"])
      assert.equal(await repo.menu.detail(slug), null);
    const bare = await repo.menu.detail("visible");
    assert.deepEqual(bare.ingredients, []);
    assert.equal(bare.estimatedMinutes, null);
    assert.equal(bare.preparationSummary, null);
    await db.recipe.update({
      where: { dishId: dish.id },
      data: { cookingMinutes: null },
    });
    assert.equal((await repo.menu.detail(dish.slug)).estimatedMinutes, null);
  } finally {
    await fixture.close();
  }
});
