import { Prisma } from "@prisma/client";
import { z } from "zod";
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).optional(),
    mode: z.enum(["pages", "more", "infinite"]).default("pages"),
    q: z.string().trim().max(100).default(""),
    category: z.string().max(120).default(""),
    sort: z
      .enum([
        "recommended",
        "name",
        "name_desc",
        "price_asc",
        "price_desc",
        "newest",
        "oldest",
        "relevance",
      ])
      .default("recommended"),
    availability: z.enum(["", "available", "unavailable"]).default(""),
    status: z.enum(["", "published", "draft", "archived", "all"]).default(""),
    minPrice: z.coerce.number().int().min(0).max(1000000000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(1000000000).optional(),
  })
  .refine(
    (o) =>
      o.minPrice === undefined ||
      o.maxPrice === undefined ||
      o.minPrice <= o.maxPrice,
    {
      path: ["maxPrice"],
      message: "Maximum price must be at least minimum price.",
    },
  );
export async function queryDishes(db, input, staff = false) {
  const o = querySchema.parse(input),
    size = o.pageSize ?? (staff ? 12 : 4);
  const vector = Prisma.sql`(setweight(to_tsvector('simple', coalesce(d.name,'')), 'A') || setweight(to_tsvector('simple', coalesce(d.description,'')), 'B'))`;
  // Plain words match token prefixes: "temp" finds "tempura". Keep explicit
  // web-search operators (quotes, OR, exclusions) on PostgreSQL's web parser.
  const plainWords = /^[\p{L}\p{N}\s]+$/u.test(o.q) && !/\bOR\b/.test(o.q);
  const prefixQuery = plainWords
    ? o.q
        .split(/\s+/u)
        .map((word) => word + ":*")
        .join(" & ")
    : null;
  const terms = prefixQuery
    ? Prisma.sql`to_tsquery('simple', ${prefixQuery})`
    : Prisma.sql`websearch_to_tsquery('simple', ${o.q})`;
  const words = plainWords ? o.q.split(/\s+/u) : [];
  const fuzzyText = Prisma.sql`lower(coalesce(d.name,'') || ' ' || coalesce(d.description,''))`;
  const fullMatch = Prisma.sql`${vector} @@ ${terms}`;
  // Short words stay prefix-only to avoid very broad approximate matches.
  const fuzzyMatch = words.length
    ? Prisma.join(
        words.map((word) => {
          const prefix = Prisma.sql`${vector} @@ to_tsquery('simple', ${word + ":*"})`;
          // Trigrams can miss adjacent swaps in short words (salomn/nigiir).
          // Match those variants as whole lexemes through the full-text index.
          const letters = Array.from(word.toLowerCase());
          const swaps =
            word.length >= 4
              ? [
                  ...new Set(
                    letters.slice(1).map((_, i) => {
                      const copy = [...letters];
                      [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
                      return copy.join("");
                    }),
                  ),
                ]
              : [];
          const swapped = swaps.length
            ? Prisma.sql`${vector} @@ to_tsquery('simple', ${swaps.join(" | ")})`
            : Prisma.sql`false`;
          return word.length >= 4
            ? Prisma.sql`(${prefix} OR ${swapped} OR restaurant.dish_fuzzy_match(${fuzzyText}, ${word.toLowerCase()}))`
            : prefix;
        }),
        " AND ",
      )
    : null;
  const filters = [];
  if (!staff)
    filters.push(
      Prisma.sql`d.archived_at IS NULL AND d.is_published = true AND c.is_active = true AND c.archived_at IS NULL`,
    );
  else if (o.status === "archived")
    filters.push(Prisma.sql`d.archived_at IS NOT NULL`);
  else if (o.status !== "all") {
    filters.push(Prisma.sql`d.archived_at IS NULL`);
    if (o.status)
      filters.push(Prisma.sql`d.is_published = ${o.status === "published"}`);
  }
  if (o.category) filters.push(Prisma.sql`c.slug = ${o.category}`);
  if (o.q)
    filters.push(
      fuzzyMatch ? Prisma.sql`(${fullMatch} OR (${fuzzyMatch}))` : fullMatch,
    );
  if (o.availability)
    filters.push(
      Prisma.sql`d.is_available = ${o.availability === "available"}`,
    );
  if (o.minPrice !== undefined)
    filters.push(Prisma.sql`d.price_minor >= ${BigInt(o.minPrice)}`);
  if (o.maxPrice !== undefined)
    filters.push(Prisma.sql`d.price_minor <= ${BigInt(o.maxPrice)}`);
  const where = filters.length
    ? Prisma.join(filters, " AND ")
    : Prisma.sql`true`;
  const orders = {
    recommended: Prisma.sql`d.display_order ASC, d.name ASC`,
    name: Prisma.sql`d.name ASC`,
    name_desc: Prisma.sql`d.name DESC`,
    price_asc: Prisma.sql`d.price_minor ASC`,
    price_desc: Prisma.sql`d.price_minor DESC`,
    newest: Prisma.sql`d.created_at DESC`,
    oldest: Prisma.sql`d.created_at ASC`,
    relevance: o.q
      ? Prisma.sql`(${fullMatch}) DESC, ts_rank(${vector},${terms}) DESC`
      : Prisma.sql`d.display_order ASC`,
  };
  return db.$transaction(
    async (tx) => {
      if (fuzzyMatch)
        await tx.$queryRaw`SELECT set_config('pg_trgm.strict_word_similarity_threshold', '0.3', true)`;
      const [count] =
        await tx.$queryRaw`SELECT count(*)::int AS total FROM restaurant.dishes d JOIN restaurant.categories c ON c.id=d.category_id WHERE ${where}`;
      const pageCount = Math.max(1, Math.ceil(count.total / size)),
        page = Math.min(o.page, pageCount);
      const ids =
        await tx.$queryRaw`SELECT d.id FROM restaurant.dishes d JOIN restaurant.categories c ON c.id=d.category_id WHERE ${where} ORDER BY ${orders[o.sort]}, d.id ASC LIMIT ${size} OFFSET ${(page - 1) * size}`;
      const rows = ids.length
        ? await tx.dish.findMany({
            where: { id: { in: ids.map((r) => r.id) } },
            take: size,
            ...(staff
              ? { include: { category: true } }
              : {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    priceMinor: true,
                    currency: true,
                    imagePath: true,
                    imageAlt: true,
                    isAvailable: true,
                    category: { select: { name: true, slug: true } },
                  },
                }),
          })
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const categories = await tx.category.findMany({
        where: { archivedAt: null, ...(!staff ? { isActive: true } : {}) },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
        take: 100,
      });
      return {
        items: ids.map((r) => byId.get(r.id)),
        categories,
        total: count.total,
        page,
        pageSize: size,
        pageCount,
        hasNext: page < pageCount,
        mode: o.mode,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
