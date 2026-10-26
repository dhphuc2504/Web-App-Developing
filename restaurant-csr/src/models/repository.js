export function createRepository(db) {
  const publicFields = {
    id: true,
    name: true,
    slug: true,
    description: true,
    preparationSummary: true,
    priceMinor: true,
    currency: true,
    imagePath: true,
    imageAlt: true,
    isAvailable: true,
    category: { select: { name: true, slug: true } },
  };
  const publicDish = {
    isPublished: true,
    archivedAt: null,
    category: { isActive: true, archivedAt: null },
  };
  const menuOrder = {
    recommended: [{ displayOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    name: [{ name: "asc" }, { id: "asc" }],
    price_asc: [{ priceMinor: "asc" }, { id: "asc" }],
    price_desc: [{ priceMinor: "desc" }, { id: "asc" }],
  };
  return {
    db,
    staff: {
      byId: (id) => db.staffUser.findUnique({ where: { id } }),
      byEmail: (email) => db.staffUser.findUnique({ where: { email } }),
      list: () =>
        db.staffUser.findMany({
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
    },
    menu: {
      detail: async (slug) => {
        const row = await db.dish.findFirst({
          where: { ...publicDish, slug },
          select: {
            ...publicFields,
            categoryId: true,
            recipe: {
              select: {
                preparationMinutes: true,
                cookingMinutes: true,
                items: { select: { ingredient: { select: { name: true } } } },
              },
            },
          },
        });
        if (!row) return null;
        const related = await db.dish.findMany({
          where: {
            ...publicDish,
            id: { not: row.id },
            categoryId: row.categoryId,
          },
          select: publicFields,
          orderBy: menuOrder.recommended,
          take: 3,
        });
        if (related.length < 3)
          related.push(
            ...(await db.dish.findMany({
              where: {
                ...publicDish,
                id: { not: row.id },
                categoryId: { not: row.categoryId },
              },
              select: publicFields,
              orderBy: menuOrder.recommended,
              take: 3 - related.length,
            })),
          );
        const { recipe, categoryId, ...dish } = row;
        const hasTime =
          recipe &&
          recipe.preparationMinutes !== null &&
          recipe.cookingMinutes !== null;
        return {
          ...dish,
          ingredients: [
            ...new Set(recipe?.items.map((item) => item.ingredient.name) || []),
          ].sort(),
          estimatedMinutes:
            hasTime && recipe.preparationMinutes + recipe.cookingMinutes > 0
              ? recipe.preparationMinutes + recipe.cookingMinutes
              : null,
          relatedDishes: related,
        };
      },
    },
    categories: () =>
      db.category.findMany({
        where: { archivedAt: null },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        take: 100,
      }),
    ingredients: () =>
      db.ingredient.findMany({
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        take: 100,
      }),
    history: () =>
      db.stockOperation.findMany({
        include: {
          actor: { select: { displayName: true } },
          movements: { include: { ingredient: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
  };
}
