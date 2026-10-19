import {
  categoryInput,
  dishInput,
  ingredientInput,
  uuid,
} from "../validators/input.js";
import { AppError } from "../lib/errors.js";
export function dishSlug(name) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 160)
      .replace(/-$/, "") || "dish"
  );
}
export function createCatalogService(repo, { photos } = {}) {
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
      if (
        data.imagePath &&
        !(photos
          ? photos.acceptsPath(data.imagePath)
          : /^\/images\/[a-zA-Z0-9_./-]+$/.test(data.imagePath) &&
            !data.imagePath.includes(".."))
      )
        throw new AppError(
          422,
          "Choose a photo using the upload button.",
          "INVALID_PHOTO_REFERENCE",
          { imagePath: "Use an uploaded dish photo." },
        );
      if (!id && !data.imageAlt) data.imageAlt = data.name;
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
      if (id)
        return db.dish.update({
          where: { id: uuid.parse(id), archivedAt: null },
          data,
        });
      if (data.slug) return db.dish.create({ data });
      const base = dishSlug(data.name);
      // The unique database constraint resolves races between simultaneous creations.
      for (let suffix = 1; suffix <= 1000; suffix++) {
        const generated = suffix === 1 ? base : `${base}-${suffix}`;
        try {
          return await db.dish.create({ data: { ...data, slug: generated } });
        } catch (error) {
          if (error.code !== "P2002") throw error;
        }
      }
      throw new AppError(
        409,
        "Please use a more distinctive dish name.",
        "SLUG_UNAVAILABLE",
        { name: "Choose a more distinctive name." },
      );
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
