import {
  categoryInput,
  dishInput,
  ingredientInput,
  uuid,
} from "../validators/input.js";
import { AppError } from "../lib/errors.js";
export function createCatalogService(repo) {
  const db = repo.db;
  const parse = (schema, id, body) => {
    const parsed = (id ? schema.partial() : schema).strict().parse(body);
    return id
      ? Object.fromEntries(Object.keys(body).map((key) => [key, parsed[key]]))
      : parsed;
  };
  return {
    async category(id, body) {
      const data = parse(categoryInput, id, body);
      return id
        ? db.category.update({
            where: { id: uuid.parse(id), archivedAt: null },
            data,
          })
        : db.category.create({ data });
    },
    async dish(id, body) {
      const data = parse(dishInput, id, body);
      if (data.categoryId) {
        const category = await db.category.findFirst({
          where: { id: data.categoryId, archivedAt: null, isActive: true },
        });
        if (!category)
          throw new AppError(
            422,
            "Choose an active category.",
            "INVALID_CATEGORY",
            { categoryId: "Choose an active category." },
          );
      }
      return id
        ? db.dish.update({
            where: { id: uuid.parse(id), archivedAt: null },
            data,
          })
        : db.dish.create({ data });
    },
    async ingredient(id, body) {
      const data = parse(ingredientInput, id, body);
      if (!id) return db.ingredient.create({ data });
      uuid.parse(id);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM restaurant.ingredients WHERE id = ${id}::uuid FOR UPDATE`;
        const old = await tx.ingredient.findUnique({
          where: { id },
          include: {
            _count: { select: { movements: true, recipeItems: true } },
          },
        });
        if (!old || old.archivedAt)
          throw new AppError(404, "Ingredient not found.");
        if (
          data.baseUnit !== undefined &&
          old.baseUnit !== data.baseUnit &&
          (old._count.movements || old._count.recipeItems)
        )
          throw new AppError(
            409,
            "The unit cannot change after recipes or stock history reference this ingredient.",
            "UNIT_LOCKED",
          );
        return tx.ingredient.update({ where: { id }, data });
      });
    },
    async archive(kind, id) {
      uuid.parse(id);
      const model = {
        category: db.category,
        dish: db.dish,
        ingredient: db.ingredient,
      }[kind];
      return model.update({
        where: { id, archivedAt: null },
        data: {
          archivedAt: new Date(),
          ...(kind === "dish" ? { isPublished: false } : { isActive: false }),
        },
      });
    },
  };
}
