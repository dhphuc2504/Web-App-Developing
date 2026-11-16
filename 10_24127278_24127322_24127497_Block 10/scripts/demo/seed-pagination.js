// Block 7 fixtures: insert-only, deterministic slugs; never reset existing records.
export const PAGINATION_PREFIX = "block7-demo-";
export const PAGINATION_COUNT = 1200;
const styles = [
  "Kyoto",
  "Osaka",
  "Tokyo",
  "Nara",
  "Kobe",
  "Sapporo",
  "Fukuoka",
  "Nagoya",
  "Sendai",
  "Kanazawa",
];
export async function seedPaginationDishes(db) {
  return db.$transaction(
    async (tx) => {
      const templates = await tx.dish.findMany({
        where: {
          archivedAt: null,
          slug: { not: { startsWith: PAGINATION_PREFIX } },
          category: { isActive: true, archivedAt: null },
        },
        orderBy: { id: "asc" },
      });
      if (!templates.length) throw new Error("No active dish templates");
      const existing = await tx.dish.findMany({
        where: { slug: { startsWith: PAGINATION_PREFIX } },
        select: { slug: true },
      });
      const known = new Set(existing.map((d) => d.slug));
      const data = [];
      for (let index = 0; index < PAGINATION_COUNT; index++) {
        const base = templates[index % templates.length];
        const number = String(index + 1).padStart(4, "0");
        const slug = `${PAGINATION_PREFIX}${number}-${base.slug}`.slice(0, 180);
        // The numeric key remains stable even if the source dish is renamed later.
        if (
          [...known].some((s) => s.startsWith(`${PAGINATION_PREFIX}${number}-`))
        )
          continue;
        const name =
          `${styles[Math.floor(index / templates.length) % styles.length]} ${base.name}`.slice(
            0,
            130,
          ) + ` · ${number}`;
        data.push({
          name,
          slug,
          categoryId: base.categoryId,
          description: `Block 7 demonstration dish ${number}, based on ${base.name}. Synthetic menu data for pagination, sorting and filtering.`,
          preparationSummary: base.preparationSummary,
          priceMinor: BigInt(35000 + ((index * 37) % 94) * 5000),
          currency: "VND",
          imagePath: base.imagePath,
          imageAlt: base.imagePath
            ? `Reused demonstration photo: ${base.imageAlt || base.name}`
            : null,
          isPublished: index % 10 !== 0,
          isAvailable: index % 7 !== 0,
          isFeatured: index % 17 === 0,
          displayOrder: 1000 + index,
          createdAt: new Date(Date.UTC(2026, 0, 1) + index * 3600000),
        });
      }
      let created = 0;
      for (let offset = 0; offset < data.length; offset += 100) {
        const result = await tx.dish.createMany({
          data: data.slice(offset, offset + 100),
          skipDuplicates: true,
        });
        created += result.count;
      }
      return {
        created,
        alreadyPresent: PAGINATION_COUNT - data.length,
        totalDishes: await tx.dish.count(),
        demoDishes: await tx.dish.count({
          where: { slug: { startsWith: PAGINATION_PREFIX } },
        }),
        publishedDemoDishes: await tx.dish.count({
          where: {
            slug: { startsWith: PAGINATION_PREFIX },
            isPublished: true,
            archivedAt: null,
          },
        }),
        imageStrategy:
          "Reuse source dish image paths; no images generated or uploaded.",
      };
    },
    { timeout: 120000, maxWait: 15000 },
  );
}
