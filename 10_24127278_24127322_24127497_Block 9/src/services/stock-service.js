import Decimal from "decimal.js";
import { stockInput } from "../validators/input.js";
import { AppError } from "../lib/errors.js";
export function stockDelta(type, quantity) {
  const q = new Decimal(quantity);
  if (q.isZero()) throw new AppError(422, "Quantity must not be zero.");
  if (type !== "correction" && q.isNegative())
    throw new AppError(
      422,
      "Enter a positive quantity for receipts, usage, or waste.",
    );
  return type === "usage" || type === "waste" ? q.negated() : q;
}
export function createStockService(db) {
  return {
    async record(body, actor) {
      const input = stockInput.parse(body);
      if (
        !["admin", "chef"].includes(actor.role) ||
        (actor.role === "chef" && !["usage", "waste"].includes(input.type))
      )
        throw new AppError(403, "You cannot perform this stock operation.");
      if (
        input.recipeId &&
        (input.type !== "usage" ||
          !input.recipeVersion ||
          !input.servings ||
          input.lines.length)
      )
        throw new AppError(
          422,
          "Recipe usage requires a version and servings, with no manual ingredient lines.",
        );
      if (!input.recipeId && (input.servings || input.recipeVersion))
        throw new AppError(
          422,
          "Servings and recipe version require a recipe.",
        );
      if (!input.recipeId && !input.lines.length)
        throw new AppError(422, "Choose at least one ingredient.");
      if (
        new Set(input.lines.map((x) => x.ingredientId)).size !==
        input.lines.length
      )
        throw new AppError(422, "List each ingredient only once.");
      return db.$transaction(
        async (tx) => {
          // Serialize repeated submissions before inspecting their unique request key.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestKey}, 0))`;
          const existing = await tx.stockOperation.findUnique({
            where: { requestKey: input.requestKey },
            include: { movements: true },
          });
          if (existing) {
            let same =
              existing.createdBy === actor.id &&
              existing.type === input.type &&
              existing.reason === input.reason &&
              existing.recipeId === (input.recipeId || null) &&
              existing.recipeVersion === (input.recipeVersion || null) &&
              existing.servings === (input.servings || null);
            if (!input.recipeId)
              same =
                same &&
                existing.movements.length === input.lines.length &&
                input.lines.every((line) =>
                  existing.movements.some(
                    (m) =>
                      m.ingredientId === line.ingredientId &&
                      new Decimal(m.quantityDelta.toString()).eq(
                        stockDelta(input.type, line.quantity),
                      ),
                  ),
                );
            if (!same)
              throw new AppError(
                409,
                "This submission key was already used for a different operation. Reload the form.",
                "REQUEST_KEY_CONFLICT",
              );
            return existing;
          }
          let lines = input.lines;
          if (input.recipeId) {
            const initial = await tx.recipe.findUnique({
              where: { id: input.recipeId },
            });
            if (!initial) throw new AppError(404, "Recipe not found.");
            await tx.$queryRaw`SELECT id FROM restaurant.dishes WHERE id = ${initial.dishId}::uuid FOR UPDATE`;
            const recipe = await tx.recipe.findUnique({
              where: { id: input.recipeId },
              include: { items: true, dish: true },
            });
            if (recipe.version !== input.recipeVersion)
              throw new AppError(
                409,
                "The recipe changed. Reload before recording usage.",
                "RECIPE_VERSION_CONFLICT",
              );
            if (recipe.dish.archivedAt || !recipe.items.length)
              throw new AppError(
                422,
                "Choose an active dish with a complete recipe.",
              );
            lines = recipe.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: new Decimal(i.quantity.toString())
                .times(input.servings)
                .toFixed(3),
            }));
          }
          const ordered = [...lines].sort((a, b) =>
            a.ingredientId.localeCompare(b.ingredientId),
          );
          for (const line of ordered)
            await tx.$queryRaw`SELECT id FROM restaurant.ingredients WHERE id = ${line.ingredientId}::uuid FOR UPDATE`;
          const movements = [];
          for (const line of ordered) {
            const ingredient = await tx.ingredient.findUnique({
              where: { id: line.ingredientId },
            });
            if (!ingredient || !ingredient.isActive || ingredient.archivedAt)
              throw new AppError(
                422,
                "Stock operations require active ingredients.",
              );
            const before = new Decimal(ingredient.quantityOnHand.toString()),
              delta = stockDelta(input.type, line.quantity),
              after = before.plus(delta);
            if (after.isNegative())
              throw new AppError(
                409,
                `Insufficient stock for ${ingredient.name}.`,
                "INSUFFICIENT_STOCK",
              );
            if (
              after.greaterThan("99999999999.999") ||
              delta.abs().greaterThan("99999999999.999")
            )
              throw new AppError(422, "Quantity exceeds the supported range.");
            movements.push({
              ingredientId: ingredient.id,
              quantityDelta: delta.toFixed(3),
              quantityBefore: before.toFixed(3),
              quantityAfter: after.toFixed(3),
            });
          }
          const operation = await tx.stockOperation.create({
            data: {
              type: input.type,
              reason: input.reason,
              requestKey: input.requestKey,
              createdBy: actor.id,
              recipeId: input.recipeId || null,
              recipeVersion: input.recipeVersion || null,
              servings: input.servings || null,
            },
          });
          for (const movement of movements) {
            await tx.ingredient.update({
              where: { id: movement.ingredientId },
              data: { quantityOnHand: movement.quantityAfter },
            });
            await tx.stockMovement.create({
              data: { ...movement, operationId: operation.id },
            });
          }
          return operation;
        },
        { timeout: 15000 },
      );
    },
  };
}
