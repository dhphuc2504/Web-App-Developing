// Disposable browser/demo server: never imports env.js or connects to Supabase.
import express from "express";
import { testDatabase } from "../tests/database.js";
import { createApp } from "../src/app.js";
import { PrismaSessionStore } from "../src/models/session-store.js";
import { createRepository } from "../src/models/repository.js";
import { createAuthService } from "../src/services/auth-service.js";
import { createCatalogService } from "../src/services/catalog-service.js";
import { createRecipeService } from "../src/services/recipe-service.js";
import { installShutdown } from "../src/lib/shutdown.js";
import { preparationSummary } from "../src/content/dish-stories.js";
const fixture = await testDatabase(),
  db = fixture.db,
  repo = createRepository(db),
  auth = createAuthService(repo),
  catalog = createCatalogService(repo);
const password = "Fixture-only-passphrase-2026";
await auth.createInitialAdmin({
  displayName: "Demo Administrator",
  email: "admin@example.test",
  password,
});
const chef = await auth.createChef({
  displayName: "Demo Chef",
  email: "chef@example.test",
  password,
});
const category = await catalog.category(null, {
  name: "House selection",
  slug: "house-selection",
  isActive: true,
});
const rice = await catalog.ingredient(null, {
  name: "Rice",
  baseUnit: "g",
  lowStockThreshold: "500",
  isActive: true,
});
for (const [index, name] of [
  "Salmon nigiri",
  "Shrimp tempura",
  "Miso ramen",
  "Seasonal vegetable bowl",
  "Salmon teriyaki",
  "Matcha mochi",
  "Vegetable tempura",
  "Shoyu ramen",
].entries()) {
  const slug = name.toLowerCase().replaceAll(" ", "-"),
    dish = await catalog.dish(null, {
      name,
      slug,
      categoryId: category.id,
      priceMinor: String(75000 + index * 10000),
      description: "Prepared with care. A little taste of Japan.",
      preparationSummary: preparationSummary(slug),
      imagePath: "/images/japan/food-atlas.png",
      imageAlt: name,
      isPublished: true,
      isAvailable: true,
    });
  await createRecipeService(db).save(
    dish.id,
    {
      version: 0,
      instructions: "Prepare with care.",
      preparationMinutes: 10,
      cookingMinutes: 20,
      items: [{ ingredientId: rice.id, quantity: "100" }],
    },
    chef.id,
  );
}
const app = createApp({
  db,
  store: new PrismaSessionStore(db),
  config: {
    NODE_ENV: "test",
    SESSION_SECRET: "Disposable-fixture-session-secret-only-2026",
  },
});
const preview = express();
let failBoardRead = false,
  boardFailureUsed = false;
preview.use((req, res, next) => {
  if (process.argv.includes("--fail-board-refresh")) {
    if (req.method === "PATCH" && /^\/api\/dishes\/[^/]+$/.test(req.path))
      res.on("finish", () => {
        if (!boardFailureUsed && res.statusCode === 200) failBoardRead = true;
      });
    if (req.method === "GET" && req.path === "/api/dishes" && failBoardRead) {
      failBoardRead = false;
      boardFailureUsed = true;
      return res
        .status(500)
        .json({
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Simulated board refresh failure.",
          },
        });
    }
  }
  if (
    process.argv.includes("--trace") &&
    (req.path.startsWith("/api") || req.accepts(["html", "json"]) === "html")
  ) {
    console.log(`[fixture] ${req.method} ${req.path}`);
  }
  if (process.argv.includes("--slow") && req.path.startsWith("/api")) {
    setTimeout(next, 750);
  } else next();
});
preview.use(app);
const server = preview.listen(3003, "127.0.0.1", () =>
  console.log(
    "Disposable CSR preview: http://127.0.0.1:3003 (test data only).",
  ),
);
installShutdown({
  server,
  db: { $disconnect: () => fixture.close() },
  cleanup: null,
});
