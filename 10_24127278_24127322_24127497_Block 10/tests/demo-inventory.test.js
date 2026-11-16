import test from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { testDatabase } from "./database.js";
import { seedDemoInventory } from "../scripts/demo/seed-inventory.js";
import { recipes } from "../scripts/demo/data.js";
async function setup(db) {
  const admin = await db.staffUser.create({
    data: {
      email: "demo-admin@example.test",
      displayName: "Test Admin",
      role: "admin",
      passwordHash: "test-only-unused-hash",
    },
  });
  await db.staffUser.create({
    data: {
      email: "demo-chef@example.test",
      displayName: "Test Chef",
      role: "chef",
      passwordHash: "test-only-unused-hash",
    },
  });
  const category = await db.category.create({
    data: { name: "Existing category", slug: "existing" },
  });
  for (const recipe of recipes)
    await db.dish.create({
      data: {
        name: recipe.name,
        slug: recipe.slug,
        categoryId: category.id,
        priceMinor: 123456n,
        description: "Existing description",
        isPublished: true,
      },
    });
  const rice = await db.ingredient.create({
    data: {
      name: "Rice",
      baseUnit: "g",
      lowStockThreshold: "77",
      description: "Existing rice notes",
    },
  });
  return { admin, rice };
}
async function snapshot(db) {
  return JSON.stringify(
    await Promise.all(
      [
        "ingredient",
        "recipe",
        "recipeItem",
        "stockOperation",
        "stockMovement",
      ].map((model) => db[model].findMany()),
    ),
    (_, value) => (typeof value === "bigint" ? String(value) : value),
  );
}
test("demo import creates nine recipes and 22 journals, preserves records, reconciles stock and is repeatable", async () => {
  const fixture = await testDatabase(),
    db = fixture.db;
  try {
    const { rice } = await setup(db);
    const dishes = await db.dish.findMany();
    const staff = await db.staffUser.findMany();
    const first = await seedDemoInventory(db);
    assert.equal(first.recipesAdded, 9);
    assert.equal(first.ingredientsAdded, 29);
    assert.equal(first.operationsAdded, 22);
    assert.equal(await db.ingredient.count(), 30);
    assert.deepEqual(await db.dish.findMany(), dishes);
    assert.deepEqual(await db.staffUser.findMany(), staff);
    const retained = await db.ingredient.findUnique({ where: { id: rice.id } });
    assert.equal(retained.description, "Existing rice notes");
    assert.equal(String(retained.lowStockThreshold), "77");
    assert.deepEqual(
      first.lowStock.map((x) => x.name),
      ["Mushrooms", "Nori", "Strawberries"],
    );
    for (const ingredient of await db.ingredient.findMany()) {
      const movements = await db.stockMovement.findMany({
        where: { ingredientId: ingredient.id },
        orderBy: { createdAt: "asc" },
      });
      let balance = new Decimal(0);
      for (const m of movements) {
        assert.ok(balance.eq(m.quantityBefore.toString()));
        balance = balance.plus(m.quantityDelta.toString());
        assert.ok(balance.eq(m.quantityAfter.toString()));
        assert.ok(balance.gte(0));
      }
      assert.ok(balance.eq(ingredient.quantityOnHand.toString()));
    }
    const before = await snapshot(db);
    const second = await seedDemoInventory(db);
    assert.equal(second.operationsAdded, 0);
    assert.equal(second.operationsAlreadyPresent, 22);
    assert.equal(second.recipesAdded, 0);
    assert.equal(second.ingredientsAdded, 0);
    assert.equal(await snapshot(db), before);
  } finally {
    await fixture.close();
  }
});
test("existing recipe and stock history remain unchanged; demo quantities add to current stock", async () => {
  const fixture = await testDatabase(),
    db = fixture.db;
  try {
    const { admin, rice } = await setup(db);
    const { createStockService } =
      await import("../src/services/stock-service.js");
    const old = await createStockService(db).record(
      {
        type: "receipt",
        reason: "Existing real delivery",
        requestKey: crypto.randomUUID(),
        lines: [{ ingredientId: rice.id, quantity: "500" }],
      },
      admin,
    );
    const history = await db.stockMovement.findMany({
      where: { operationId: old.id },
    });
    const dish = await db.dish.findUnique({
      where: { slug: "garden-vegetable-bowl" },
    });
    const recipe = await db.recipe.create({
      data: {
        dishId: dish.id,
        updatedBy: admin.id,
        instructions: "Keep my recipe",
        items: { create: { ingredientId: rice.id, quantity: "42" } },
      },
      include: { items: true },
    });
    const result = await seedDemoInventory(db);
    assert.equal(result.recipesAdded, 8);
    assert.equal(result.recipesPreserved, 1);
    assert.equal(result.operationsAdded, 21);
    assert.deepEqual(
      await db.recipe.findUnique({
        where: { id: recipe.id },
        include: { items: true },
      }),
      recipe,
    );
    assert.deepEqual(
      await db.stockMovement.findMany({ where: { operationId: old.id } }),
      history,
    );
    assert.equal(
      String(
        (await db.ingredient.findUnique({ where: { id: rice.id } }))
          .quantityOnHand,
      ),
      "11890",
    );
  } finally {
    await fixture.close();
  }
});
test("incompatible existing ingredient rolls back the entire import", async () => {
  const fixture = await testDatabase(),
    db = fixture.db;
  try {
    await setup(db);
    await db.ingredient.create({ data: { name: "Salmon", baseUnit: "piece" } });
    const before = await snapshot(db);
    await assert.rejects(seedDemoInventory(db), { name: "DemoSeedError" });
    assert.equal(await snapshot(db), before);
  } finally {
    await fixture.close();
  }
});
