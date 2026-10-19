import { promisify } from "node:util";
import { z } from "zod";
import { success } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { ensureCsrf } from "../middleware/security.js";
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
export function createApiController({ repo, auth, catalog, recipes, stock }) {
  const db = repo.db;
  return {
    session: (req, res) =>
      success(res, { user: req.user, csrfToken: ensureCsrf(req) }),
    login: async (req, res) => {
      const user = await auth.login(req.body);
      await promisify(req.session.regenerate).call(req.session);
      req.session.userId = user.id;
      const csrfToken = ensureCsrf(req);
      await promisify(req.session.save).call(req.session);
      res.locals.loginSucceeded = true;
      success(res, { user: staffDto(user), csrfToken });
    },
    logout: async (req, res) => {
      await promisify(req.session.destroy).call(req.session);
      res.clearCookie("restaurant.csr.sid", { path: "/" });
      success(res, { user: null });
    },
    menu: async (req, res) => {
      const options = z
        .object({
          sort: z
            .enum(["recommended", "name", "price_asc", "price_desc"])
            .default("recommended"),
          category: z.string().max(120).default(""),
          q: z.string().trim().max(100).default(""),
          page: z.coerce.number().int().min(1).max(100000).default(1),
        })
        .parse(req.query);
      const total = await repo.menu.count(options),
        pageCount = Math.max(1, Math.ceil(total / 4)),
        page = Math.min(options.page, pageCount);
      const [items, categories] = await Promise.all([
        repo.menu.list({ ...options, take: 4, skip: (page - 1) * 4 }),
        repo.categories(),
      ]);
      success(res, {
        items,
        categories: categories
          .filter((c) => c.isActive)
          .map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
        total,
        page,
        pageCount,
      });
    },
    menuDish: async (req, res) =>
      success(res, found(await repo.menu.detail(req.params.slug))),
    list: (resource) => async (req, res) =>
      success(res, await repo[resource]()),
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
      success(res, await catalog[models[resource]](id, data));
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
