// Only the application config loads credentials; never print configuration or raw errors.
import { createDatabase } from "../src/config/database.js";
let db;
try {
  const { env } = await import("../src/config/env.js");
  db = createDatabase(env.DATABASE_URL);
  if (process.argv.includes("--plan")) {
    const dishes = await db.dish.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        archivedAt: true,
        recipe: { select: { id: true, _count: { select: { items: true } } } },
      },
      orderBy: { name: "asc" },
    });
    const ingredients = await db.ingredient.findMany({
      select: {
        name: true,
        baseUnit: true,
        quantityOnHand: true,
        isActive: true,
        archivedAt: true,
      },
    });
    const staff = await db.staffUser.groupBy({
      by: ["role", "isActive"],
      _count: true,
    });
    console.log(
      JSON.stringify(
        {
          dishes,
          ingredients,
          staff,
          journalOperations: await db.stockOperation.count(),
        },
        null,
        2,
      ),
    );
  } else {
    const { seedDemoInventory } = await import("./demo/seed-inventory.js");
    console.log(JSON.stringify(await seedDemoInventory(db), null, 2));
  }
} catch (error) {
  console.error(
    "Demo inventory import stopped. No credentials or raw database errors are displayed.",
  );
  if (error.name === "DemoSeedError") console.error(error.message);
  else
    console.error("Check database connectivity and application configuration.");
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
}
