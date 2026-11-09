import { createHash } from "node:crypto";
import { queryDishes } from "../models/dish-query.js";
import { z } from "zod";
import { success } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import {
  uuid,
  categoryInput,
  dishInput,
  ingredientInput,
} from "../validators/input.js";
export const validId = (id) => {
  if (!uuid.safeParse(id).success) throw new AppError(404, "Record not found.");
  return id;
};
const found = (row) => {
  if (!row || row.archivedAt) throw new AppError(404, "Record not found.");
  return row;
};
const staffDto = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  isActive: user.isActive,
  approvalStatus: user.approvalStatus,
  emailVerifiedAt: user.emailVerifiedAt,
});
const schemas = {
  categories: categoryInput,
  dishes: dishInput,
  ingredients: ingredientInput,
};
const models = {
  categories: "category",
  dishes: "dish",
  ingredients: "ingredient",
};
export function createApiController({
  repo,
  auth,
  catalog,
  recipes,
  stock,
  photos,
}) {
  const db = repo.db;
  return {
    uploadPhoto: async (req, res) =>
      success(res, await photos.upload(req.file)),
    publicDish: async (req, res) => {
      const dish = await db.dish.findUnique({
        where: { id: validId(req.params.id) },
        select: { slug: true },
      });
      success(res, found(dish && (await repo.menu.detail(dish.slug))));
    },
    menu: async (req, res) => success(res, await queryDishes(db, req.query)),
    menuDish: async (req, res) =>
      success(res, found(await repo.menu.detail(req.params.slug))),
    list: (resource) => async (req, res) =>
      success(
        res,
        resource === "dishes"
          ? await queryDishes(db, req.query, true)
          : await repo[resource](),
      ),
    detail: (resource) => async (req, res) =>
      success(
        res,
        found(
          await db[models[resource]].findUnique({
            where: { id: validId(req.params.id) },
          }),
        ),
      ),
    save: (resource) => async (req, res) => {
      const id = req.params.id ? validId(req.params.id) : null;
      if (id) found(await db[models[resource]].findUnique({ where: { id } }));
      const schema = schemas[resource];
      const body = (id ? schema.partial() : schema).strict().parse(req.body);
      const data = Object.fromEntries(
        Object.keys(req.body).map((key) => [key, req.body[key]]),
      );
      if (id && !Object.keys(data).length)
        throw new AppError(
          422,
          "Provide at least one field to update.",
          "EMPTY_PATCH",
        );
      success(res, await catalog[models[resource]](id, data, req.user));
    },
    archive: (resource) => async (req, res) =>
      success(
        res,
        await catalog.archive(models[resource], validId(req.params.id)),
      ),
    recipe: async (req, res) => {
      const dish = found(
        await db.dish.findUnique({
          where: { id: validId(req.params.id) },
          include: {
            recipe: { include: { items: { include: { ingredient: true } } } },
          },
        }),
      );
      success(res, {
        dish,
        recipe: dish.recipe,
        ingredients: await repo.ingredients(),
      });
    },
    saveRecipe: async (req, res) => {
      const record = await recipes.save(
        validId(req.params.id),
        req.body,
        req.user.id,
        req.user,
      );
      success(
        res,
        await db.recipe.findUnique({
          where: { id: record.id },
          include: { items: { include: { ingredient: true } } },
        }),
      );
    },
    stockList: async (req, res) => success(res, await repo.history()),
    stockCreate: async (req, res) => {
      const record = await stock.record(req.body, req.user);
      success(
        res,
        await db.stockOperation.findUnique({
          where: { id: record.id },
          include: {
            movements: { include: { ingredient: true } },
            actor: { select: { displayName: true } },
          },
        }),
      );
    },
    movements: async (req, res) => {
      const ingredient = found(
        await db.ingredient.findUnique({
          where: { id: validId(req.params.id) },
        }),
      );
      const movements = await db.stockMovement.findMany({
        where: { ingredientId: ingredient.id },
        include: {
          operation: { include: { actor: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      success(res, { ingredient, movements });
    },
    chefs: async (req, res) =>
      success(
        res,
        (await repo.staff.list()).filter((user) => user.role === "chef"),
      ),
    chef: async (req, res) => {
      const user = await repo.staff.byId(validId(req.params.id));
      if (!user || user.role !== "chef")
        throw new AppError(404, "Chef not found.");
      success(res, staffDto(user));
    },
    createChef: async (req, res) =>
      success(res, staffDto(await auth.createChef(req.body))),
    updateChef: async (req, res) => {
      const id = validId(req.params.id),
        user = await repo.staff.byId(id);
      if (!user || user.role !== "chef")
        throw new AppError(404, "Chef not found.");
      const data = z
        .object({
          displayName: z.string().trim().min(1).max(100),
          isActive: z.boolean(),
        })
        .partial()
        .strict()
        .parse(req.body);
      if (!Object.keys(data).length)
        throw new AppError(
          422,
          "Provide at least one field to update.",
          "EMPTY_PATCH",
        );
      success(
        res,
        staffDto(await db.staffUser.update({ where: { id }, data })),
      );
    },
    deleteChef: async (req, res) => {
      const id = validId(req.params.id);
      const input = z
        .object({ email: z.string().trim().toLowerCase().email() })
        .strict()
        .parse(req.body);
      const deleted = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM restaurant.staff_users WHERE id=${id}::uuid FOR UPDATE`;
        const user = await tx.staffUser.findUnique({ where: { id } });
        if (!user || user.role !== "chef")
          throw new AppError(404, "Chef account not found.");
        if (user.id === req.user.id)
          throw new AppError(
            403,
            "You cannot delete your own account.",
            "FORBIDDEN",
          );
        if (input.email !== user.email.toLowerCase())
          throw new AppError(
            422,
            "Enter the chef email address to confirm deletion.",
            "CONFIRMATION_REQUIRED",
            { email: "Must match this chef account." },
          );
        const recipes = await tx.recipe.count({ where: { updatedBy: id } }),
          operations = await tx.stockOperation.count({
            where: { createdBy: id },
          });
        if (recipes || operations)
          throw new AppError(
            409,
            "This chef is referenced by recipes or stock journals. Remove access instead to preserve restaurant history.",
            "CHEF_HAS_HISTORY",
          );
        // Foreign keys cascade authentication challenges and unassign dishes, never delete dishes.
        await tx.staffUser.delete({ where: { id } });
        await tx.failedAttempt.deleteMany({
          where: { key: createHash("sha256").update(user.email).digest("hex") },
        });
        return { id, deleted: true };
      });
      success(res, deleted);
    },
    removeChef: async (req, res) => {
      const id = validId(req.params.id),
        user = await repo.staff.byId(id);
      if (!user || user.role !== "chef")
        throw new AppError(404, "Chef not found.");
      success(
        res,
        staffDto(
          await db.staffUser.update({
            where: { id },
            data: { isActive: false },
          }),
        ),
      );
    },
  };
}
