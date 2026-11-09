import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { createStockService } from "../../src/services/stock-service.js";
import { ingredients, recipes, manualOperations } from "./data.js";
const namespace = "santaishi-demo-inventory-v1";
export function demoId(label) {
  const hex = createHash("sha256")
    .update(namespace + ":" + label)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function stop(message) {
  const error = new Error(message);
  error.name = "DemoSeedError";
  throw error;
}
const normalized = (text) => text.trim().toLowerCase();
export async function seedDemoInventory(db) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${namespace}, 0))`;
      const staff = await tx.staffUser.findMany({
        where: { isActive: true },
        select: { id: true, role: true },
        orderBy: { createdAt: "asc" },
      });
      const admin = staff.find((x) => x.role === "admin"),
        chef = staff.find((x) => x.role === "chef") || admin;
      if (!admin)
        stop("An active administrator is required. No accounts were created.");
      const dishes = await tx.dish.findMany({
        where: { archivedAt: null },
        include: { recipe: { include: { items: true } } },
      });
      const targets = recipes.flatMap((spec) => {
        const matches = dishes.filter(
          (d) =>
            d.slug === spec.slug ||
            normalized(d.name) === normalized(spec.name),
        );
        if (matches.length > 1)
          stop(`Ambiguous dish match: ${spec.name}. No data was changed.`);
        return matches.length ? [{ spec, dish: matches[0] }] : [];
      });
      if (!targets.length)
        stop("No matching restaurant dishes found. No data was changed.");
      const summary = {
        ingredientsAdded: 0,
        ingredientsReused: 0,
        recipesAdded: 0,
        recipesPreserved: 0,
        operationsAdded: 0,
        operationsAlreadyPresent: 0,
        movementsAdded: 0,
        missingDishes: recipes
          .filter((s) => !targets.some((t) => t.spec === s))
          .map((s) => s.name),
      };
      const existingIngredients = await tx.ingredient.findMany();
      const mapped = {};
      for (const spec of ingredients) {
        const matches = existingIngredients.filter(
          (i) => normalized(i.name) === normalized(spec.name),
        );
        if (matches.length > 1)
          stop(
            `Ambiguous ingredient match: ${spec.name}. No data was changed.`,
          );
        let record = matches[0];
        if (
          record &&
          (record.baseUnit !== spec.baseUnit ||
            !record.isActive ||
            record.archivedAt)
        )
          stop(
            `Existing ingredient needs review: ${spec.name}. Its unit or active status differs; nothing was overwritten.`,
          );
        if (record) summary.ingredientsReused++;
        else {
          record = await tx.ingredient.create({
            data: {
              id: demoId("ingredient:" + spec.key),
              name: spec.name,
              baseUnit: spec.baseUnit,
              lowStockThreshold: String(spec.threshold),
              description:
                "[DEMO] Shared ingredient for presentation recipes. Quantities are illustrative.",
              quantityOnHand: "0",
            },
          });
          summary.ingredientsAdded++;
        }
        mapped[spec.key] = record;
      }
      const demoRecipes = [];
      for (const { spec, dish } of targets) {
        await tx.$queryRaw`SELECT id FROM restaurant.dishes WHERE id = ${dish.id}::uuid FOR UPDATE`;
        let recipe = await tx.recipe.findUnique({
          where: { dishId: dish.id },
          include: { items: true },
        });
        const ownId = demoId("recipe:" + dish.id);
        if (recipe) summary.recipesPreserved++;
        else {
          recipe = await tx.recipe.create({
            data: {
              id: ownId,
              dishId: dish.id,
              updatedBy: chef.id,
              version: 1,
              instructions:
                "[DEMO] Illustrative recipe; quantities below are per serving. Rice quantities refer to dry rice. Water is not tracked.\n\n" +
                spec.instructions,
              preparationMinutes: spec.prep,
              cookingMinutes: spec.cook,
              items: {
                create: Object.entries(spec.items).map(([key, quantity]) => ({
                  ingredientId: mapped[key].id,
                  quantity: String(quantity),
                  notes: "[DEMO] Per-serving allocation",
                })),
              },
            },
            include: { items: true },
          });
          summary.recipesAdded++;
        }
        // Never create simulated usage from a pre-existing or subsequently edited recipe.
        if (recipe.id === ownId && recipe.version === 1)
          demoRecipes.push({ spec, recipe });
      }
      const applied = [];
      async function record(label, body, actor) {
        const requestKey = demoId("operation:" + label);
        const existing = await tx.stockOperation.findUnique({
          where: { requestKey },
        });
        if (existing) {
          summary.operationsAlreadyPresent++;
          return;
        }
        // Assign real import time at insertion; history is immutable after insertion.
        let timestamp;
        const stock = createStockService({
          $transaction: (action) =>
            action(
              new Proxy(tx, {
                get(target, property) {
                  if (property === "stockOperation")
                    return {
                      ...target.stockOperation,
                      create: (args) => {
                        timestamp = new Date();
                        return target.stockOperation.create({
                          ...args,
                          data: { ...args.data, createdAt: timestamp },
                        });
                      },
                    };
                  if (property === "stockMovement")
                    return {
                      ...target.stockMovement,
                      create: (args) =>
                        target.stockMovement.create({
                          ...args,
                          data: { ...args.data, createdAt: timestamp },
                        }),
                    };
                  return target[property];
                },
              }),
            ),
        });
        const op = await stock.record({ ...body, requestKey }, actor);
        const movementCount = await tx.stockMovement.count({
          where: { operationId: op.id },
        });
        summary.operationsAdded++;
        summary.movementsAdded += movementCount;
        applied.push(op.id);
      }
      for (let index = 0; index < 4; index++) {
        const group = ingredients.slice(index * 8, index * 8 + 8);
        await record(
          "opening-" + index,
          {
            type: "receipt",
            reason: `[DEMO] Opening delivery ${index + 1}: ingredients for simulated service`,
            lines: group.map((i) => ({
              ingredientId: mapped[i.key].id,
              quantity: String(i.receipt),
            })),
          },
          admin,
        );
      }
      for (const { spec, recipe } of demoRecipes)
        await record(
          "recipe:" + recipe.dishId,
          {
            type: "usage",
            reason: `[DEMO] Simulated service: ${spec.servings} portions of ${spec.name}`,
            recipeId: recipe.id,
            recipeVersion: recipe.version,
            servings: spec.servings,
            lines: [],
          },
          chef,
        );
      for (const [type, key, reason, quantities] of manualOperations)
        await record(
          key,
          {
            type,
            reason: "[DEMO] " + reason,
            lines: Object.entries(quantities).map(([key, quantity]) => ({
              ingredientId: mapped[key].id,
              quantity: String(quantity),
            })),
          },
          ["receipt", "correction"].includes(type) ? admin : chef,
        );
      // Validate movement arithmetic before committing this entire import.
      const movements = await tx.stockMovement.findMany({
        where: { operationId: { in: applied } },
      });
      for (const m of movements)
        if (
          !new Decimal(m.quantityBefore.toString())
            .plus(m.quantityDelta.toString())
            .eq(m.quantityAfter.toString())
        )
          stop(
            "Demo movement reconciliation failed; the import was rolled back.",
          );
      const balances = await tx.ingredient.findMany({
        where: { id: { in: Object.values(mapped).map((x) => x.id) } },
        select: {
          name: true,
          baseUnit: true,
          quantityOnHand: true,
          lowStockThreshold: true,
        },
        orderBy: { name: "asc" },
      });
      summary.lowStock = balances
        .filter((i) =>
          new Decimal(i.quantityOnHand.toString()).lte(
            i.lowStockThreshold.toString(),
          ),
        )
        .map((i) => ({
          name: i.name,
          quantity: String(i.quantityOnHand),
          unit: i.baseUnit,
          threshold: String(i.lowStockThreshold),
        }));
      summary.balances = balances.map((i) => ({
        name: i.name,
        quantity: String(i.quantityOnHand),
        unit: i.baseUnit,
      }));
      return summary;
    },
    { maxWait: 15000, timeout: 180000 },
  );
}
