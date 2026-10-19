import { z } from "zod";
export const uuid = z.string().uuid();
const text = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const flag = z.boolean().default(false);
const quantity = z
  .string()
  .regex(
    /^\d{1,11}(\.\d{1,3})?$/,
    "Use a non-negative quantity with up to three decimal places",
  );
export const signedQuantity = z
  .string()
  .regex(/^[+-]?\d{1,11}(\.\d{1,3})?$/, "Use up to three decimal places")
  .refine((v) => Number(v) !== 0, "Quantity must not be zero");
const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens",
  );
export const categoryInput = z.object({
  name: text(100),
  slug: slug.refine((v) => v.length <= 120),
  description: optionalText(5000),
  displayOrder: z.coerce.number().int().min(0).max(2147483647).default(0),
  isActive: flag,
});
export const dishInput = z.object({
  categoryId: uuid,
  name: text(150),
  slug,
  description: optionalText(10000),
  preparationSummary: optionalText(5000),
  priceMinor: z
    .string()
    .regex(/^\d{1,18}$/)
    .transform(BigInt),
  imagePath: optionalText(1000).refine(
    (v) => !v || (/^\/images\/[a-zA-Z0-9_./-]+$/.test(v) && !v.includes("..")),
    "Use a local /images/ path",
  ),
  imageAlt: optionalText(200),
  isFeatured: flag,
  isPublished: flag,
  isAvailable: flag,
  displayOrder: z.coerce.number().int().min(0).max(2147483647).default(0),
});
export const ingredientInput = z.object({
  name: text(150),
  description: optionalText(5000),
  baseUnit: z.enum(["g", "ml", "piece"]),
  lowStockThreshold: quantity,
  isActive: flag,
});
export const loginInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(256),
  })
  .strict();
export const staffInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    displayName: text(100),
    password: z.string().min(12).max(256),
  })
  .strict();
const nullableMinutes = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().min(0).max(2147483647).nullable(),
);
export const recipeInput = z
  .object({
    version: z.coerce.number().int().min(0),
    instructions: z.string().trim().max(20000),
    preparationMinutes: nullableMinutes,
    cookingMinutes: nullableMinutes,
    items: z
      .array(
        z.object({
          ingredientId: uuid,
          quantity: quantity.refine(
            (v) => Number(v) > 0,
            "Quantity must be positive",
          ),
          notes: optionalText(250),
        }),
      )
      .max(100),
  })
  .strict();
export const stockInput = z
  .object({
    type: z.enum(["receipt", "usage", "waste", "correction"]),
    reason: text(2000),
    requestKey: uuid,
    recipeId: uuid.optional(),
    recipeVersion: z.coerce.number().int().positive().optional(),
    servings: z.coerce.number().int().positive().max(10000).optional(),
    lines: z
      .array(z.object({ ingredientId: uuid, quantity: signedQuantity }))
      .max(100)
      .default([]),
  })
  .strict();
export function recipeItemsFromForm(body) {
  const ids = [].concat(body.ingredientId || []),
    quantities = [].concat(body.quantity || []),
    notes = [].concat(body.itemNotes || []);
  return ids
    .map((ingredientId, i) => ({
      ingredientId,
      quantity: quantities[i] || "",
      notes: notes[i] || "",
    }))
    .filter((x) => x.ingredientId && Number(x.quantity) !== 0);
}
