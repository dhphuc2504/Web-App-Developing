import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { testDatabase } from "./database.js";
import { createApp } from "../src/app.js";
import { PrismaSessionStore } from "../src/models/session-store.js";
import { createRepository } from "../src/models/repository.js";
import { createAuthService } from "../src/services/auth-service.js";
import { createCatalogService } from "../src/services/catalog-service.js";
import { createRecipeService } from "../src/services/recipe-service.js";
let fixture, db, app, admin, chef, category, dish, rice, recipe;
const password = "Fixture-only-long-passphrase-2026";
before(async () => {
  fixture = await testDatabase();
  db = fixture.db;
  const repo = createRepository(db),
    auth = createAuthService(repo),
    catalog = createCatalogService(repo);
  admin = await auth.createInitialAdmin({
    email: "admin@example.test",
    displayName: "Admin",
    password,
  });
  chef = await auth.createChef({
    email: "chef@example.test",
    displayName: "Chef",
    password,
  });
  category = await catalog.category(null, {
    name: "Mains",
    slug: "mains",
    isActive: true,
  });
  dish = await catalog.dish(null, {
    name: "Rice bowl",
    slug: "rice-bowl",
    categoryId: category.id,
    priceMinor: "75000",
    isPublished: true,
    isAvailable: true,
  });
  rice = await catalog.ingredient(null, {
    name: "Rice",
    baseUnit: "g",
    lowStockThreshold: "10",
    isActive: true,
  });
  recipe = await createRecipeService(db).save(
    dish.id,
    {
      version: 0,
      instructions: "Cook.",
      items: [{ ingredientId: rice.id, quantity: "100" }],
    },
    chef.id,
  );
  app = createApp({
    db,
    store: new PrismaSessionStore(db),
    config: { NODE_ENV: "test", SESSION_SECRET: "test-only-secret-".repeat(4) },
  });
});
after(async () => {
  await fixture?.close();
});
async function login(role = "admin") {
  const agent = request.agent(app),
    initial = await agent.get("/api/session");
  const response = await agent
    .post("/api/session")
    .set("X-CSRF-Token", initial.body.data.csrfToken)
    .send({ email: role + "@example.test", password });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  return { agent, token: response.body.data.csrfToken };
}
const send = (session, method, path, body) =>
  session.agent[method]("/api" + path)
    .set("X-CSRF-Token", session.token)
    .send(body);
test("public menu is JSON, paginated, hides drafts and serializes BigInt", async () => {
  await db.dish.create({
    data: {
      name: "Draft",
      slug: "draft",
      categoryId: category.id,
      priceMinor: 5n,
    },
  });
  const response = await request(app).get("/api/menu");
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.items.length, 1);
  assert.equal(response.body.data.items[0].priceMinor, "75000");
  assert.match(response.headers["content-type"], /application\/json/);
  assert.equal(
    (await request(app).get("/api/menu/draft")).body.error.code,
    "NOT_FOUND",
  );
});
test("session bootstrap gives anonymous CSRF state; login rotates cookie", async () => {
  const agent = request.agent(app),
    first = await agent.get("/api/session");
  assert.equal(first.body.data.user, null);
  const second = await agent
    .post("/api/session")
    .set("X-CSRF-Token", first.body.data.csrfToken)
    .send({ email: "chef@example.test", password });
  assert.notEqual(
    first.headers["set-cookie"][0].split(";")[0],
    second.headers["set-cookie"][0].split(";")[0],
  );
  assert.equal(second.body.data.user.role, "chef");
  assert.doesNotMatch(second.text, /passwordHash|password_hash|Fixture-only/);
});
test("unauthenticated and forbidden requests use 401 and 403", async () => {
  assert.equal((await request(app).get("/api/dishes")).status, 401);
  const session = await login("chef");
  assert.equal((await session.agent.get("/api/chefs")).status, 403);
  const response = await send(session, "post", "/stock-operations", {
    type: "receipt",
    reason: "Denied",
    requestKey: randomUUID(),
    lines: [{ ingredientId: rice.id, quantity: "10" }],
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "FORBIDDEN");
});
test("bad credentials use 401; CSRF is required for mutations", async () => {
  const agent = request.agent(app),
    initial = await agent.get("/api/session");
  const response = await agent
    .post("/api/session")
    .set("X-CSRF-Token", initial.body.data.csrfToken)
    .send({ email: "admin@example.test", password: "incorrect" });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "INVALID_CREDENTIALS");
  const session = await login();
  assert.equal(
    (await session.agent.delete("/api/dishes/" + dish.id)).status,
    403,
  );
});
test("validation returns HTTP 200 with stable code and input fields", async () => {
  const session = await login();
  const response = await send(session, "post", "/categories", {
    name: "",
    slug: "invalid slug",
    isActive: true,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.ok(response.body.error.fields.name);
  assert.ok(response.body.error.fields.slug);
});
test("invalid IDs are rejected before any record lookup", async () => {
  const session = await login(),
    original = db.dish.findUnique;
  let called = false;
  db.dish.findUnique = () => {
    called = true;
    throw new Error("must not query");
  };
  try {
    const response = await session.agent.get("/api/dishes/not-a-uuid");
    assert.equal(response.status, 200);
    assert.equal(response.body.error.code, "NOT_FOUND");
    assert.equal(called, false);
  } finally {
    db.dish.findUnique = original;
  }
});
test("PATCH changes only provided fields and returns updated record", async () => {
  const session = await login("chef");
  const response = await send(session, "patch", "/dishes/" + dish.id, {
    name: "Rice bowl updated",
  });
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.name, "Rice bowl updated");
  assert.equal(response.body.data.isPublished, true);
  assert.equal(response.body.data.isAvailable, true);
  assert.equal(response.body.data.priceMinor, "75000");
});
test("create works with JSON price and invalid writable fields are rejected", async () => {
  const session = await login();
  const created = await send(session, "post", "/dishes", {
    name: "Noodles",
    slug: "noodles",
    categoryId: category.id,
    priceMinor: "90000",
    isPublished: false,
    isAvailable: true,
  });
  assert.equal(created.body.ok, true);
  assert.equal(created.body.data.priceMinor, "90000");
  const response = await send(session, "patch", "/ingredients/" + rice.id, {
    quantityOnHand: "99999",
  });
  assert.equal(response.body.ok, false);
  assert.equal(
    (
      await db.ingredient.findUnique({ where: { id: rice.id } })
    ).quantityOnHand.toString(),
    "0",
  );
});
test("JSON content type and malformed JSON have managed responses", async () => {
  const session = await login();
  const wrong = await session.agent
    .post("/api/categories")
    .set("X-CSRF-Token", session.token)
    .type("form")
    .send({ name: "Test" });
  assert.equal(wrong.status, 200);
  assert.equal(wrong.body.error.code, "CONTENT_TYPE_REQUIRED");
  const malformed = await session.agent
    .post("/api/categories")
    .set("Content-Type", "application/json")
    .send("{");
  assert.equal(malformed.status, 200);
  assert.equal(malformed.body.error.code, "INVALID_JSON");
});
test("receipt stores stock movement and retry does not duplicate it", async () => {
  const session = await login(),
    body = {
      type: "receipt",
      reason: "Opening stock",
      requestKey: randomUUID(),
      lines: [{ ingredientId: rice.id, quantity: "1000" }],
    };
  const first = await send(session, "post", "/stock-operations", body),
    second = await send(session, "post", "/stock-operations", body);
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.data.id, second.body.data.id);
  assert.equal(first.body.data.movements[0].quantityAfter, "1000");
  assert.equal(
    (
      await db.ingredient.findUnique({ where: { id: rice.id } })
    ).quantityOnHand.toString(),
    "1000",
  );
  const conflict = await send(session, "post", "/stock-operations", {
    ...body,
    reason: "Different request",
  });
  assert.equal(conflict.body.error.code, "REQUEST_KEY_CONFLICT");
});
test("recipe usage is atomic and insufficient stock is a business error", async () => {
  const session = await login("chef");
  const first = await send(session, "post", "/stock-operations", {
    type: "usage",
    reason: "Dinner",
    requestKey: randomUUID(),
    recipeId: recipe.id,
    recipeVersion: 1,
    servings: 2,
  });
  assert.equal(first.body.ok, true);
  assert.equal(first.body.data.movements[0].quantityAfter, "800");
  const second = await send(session, "post", "/stock-operations", {
    type: "usage",
    reason: "Too much",
    requestKey: randomUUID(),
    recipeId: recipe.id,
    recipeVersion: 1,
    servings: 100,
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.error.code, "INSUFFICIENT_STOCK");
  assert.equal(
    (
      await db.ingredient.findUnique({ where: { id: rice.id } })
    ).quantityOnHand.toString(),
    "800",
  );
});
test("waste and signed correction create accurate immutable history", async () => {
  const cook = await login("chef"),
    manager = await login();
  const waste = await send(cook, "post", "/stock-operations", {
    type: "waste",
    reason: "Spill",
    requestKey: randomUUID(),
    lines: [{ ingredientId: rice.id, quantity: "50" }],
  });
  assert.equal(waste.body.data.movements[0].quantityAfter, "750");
  const correction = await send(manager, "post", "/stock-operations", {
    type: "correction",
    reason: "Stock count",
    requestKey: randomUUID(),
    lines: [{ ingredientId: rice.id, quantity: "+25" }],
  });
  assert.equal(correction.body.data.movements[0].quantityAfter, "775");
  await assert.rejects(() =>
    db.stockOperation.update({
      where: { id: correction.body.data.id },
      data: { reason: "rewrite" },
    }),
  );
});
test("recipe replacement uses a version and returns saved items", async () => {
  const session = await login("chef"),
    body = {
      version: 1,
      instructions: "Steam rice.",
      items: [{ ingredientId: rice.id, quantity: "110" }],
    };
  const saved = await send(
    session,
    "put",
    "/dishes/" + dish.id + "/recipe",
    body,
  );
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.data.version, 2);
  assert.equal(saved.body.data.items[0].quantity, "110");
  const stale = await send(
    session,
    "put",
    "/dishes/" + dish.id + "/recipe",
    body,
  );
  assert.equal(stale.body.error.code, "RECIPE_VERSION_CONFLICT");
});
test("chef management excludes credentials and cannot grant admin", async () => {
  const session = await login();
  const created = await send(session, "post", "/chefs", {
    displayName: "New chef",
    email: "new@example.test",
    password,
  });
  assert.equal(created.body.ok, true);
  assert.doesNotMatch(created.text, /password/i);
  const denied = await send(
    session,
    "patch",
    "/chefs/" + created.body.data.id,
    { role: "admin" },
  );
  assert.equal(denied.body.ok, false);
  const removed = await send(
    session,
    "delete",
    "/chefs/" + created.body.data.id,
  );
  assert.equal(removed.body.data.isActive, false);
});
test("deactivated staff lose existing-session access and logout clears state", async () => {
  const session = await login("chef");
  await db.staffUser.update({
    where: { id: chef.id },
    data: { isActive: false },
  });
  assert.equal((await session.agent.get("/api/dishes")).status, 401);
  await db.staffUser.update({
    where: { id: chef.id },
    data: { isActive: true },
  });
  const manager = await login();
  const response = await send(manager, "delete", "/session");
  assert.equal(response.body.ok, true);
  assert.equal((await manager.agent.get("/api/dishes")).status, 401);
});
test("actual DELETE archives, while GET and POST override cannot mutate", async () => {
  const session = await login();
  const row = await db.dish.create({
    data: {
      name: "Archive me",
      slug: "archive-me",
      categoryId: category.id,
      priceMinor: 1n,
    },
  });
  assert.equal(
    (await session.agent.get("/api/dishes/" + row.id + "?_method=DELETE")).body
      .data.archivedAt,
    null,
  );
  assert.equal(
    (await send(session, "post", "/dishes/" + row.id, { _method: "DELETE" }))
      .status,
    404,
  );
  const removed = await send(session, "delete", "/dishes/" + row.id);
  assert.equal(removed.status, 200);
  assert.ok(removed.body.data.archivedAt);
  assert.equal(
    (await send(session, "patch", "/dishes/" + row.id, { name: "No" })).body
      .error.code,
    "NOT_FOUND",
  );
});
test("unknown API routes return JSON 404; frontend deep links serve the SPA", async () => {
  const missing = await request(app).get("/api/no-such-endpoint");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "ENDPOINT_NOT_FOUND");
  const page = await request(app).get("/kitchen/ingredients");
  assert.equal(page.status, 200);
  assert.match(page.text, /id="root"/);
  assert.doesNotMatch(page.text, /Rice bowl updated/);
});
test("unexpected database failures return safe HTTP 500", async () => {
  const original = db.$transaction;
  db.$transaction = () => {
    throw new Error("private database password details");
  };
  try {
    const response = await request(app).get("/api/menu");
    assert.equal(response.status, 500);
    assert.equal(response.body.error.code, "INTERNAL_ERROR");
    assert.doesNotMatch(response.text, /password|private|stack/i);
  } finally {
    db.$transaction = original;
  }
});

test("ingredient PATCH preserves flags and locks units referenced by recipes", async () => {
  const session = await login();
  const changed = await send(session, "patch", "/ingredients/" + rice.id, {
    lowStockThreshold: "25",
  });
  assert.equal(changed.body.ok, true);
  assert.equal(changed.body.data.isActive, true);
  assert.equal(changed.body.data.quantityOnHand, "775");
  const locked = await send(session, "patch", "/ingredients/" + rice.id, {
    baseUnit: "piece",
  });
  assert.equal(locked.status, 200);
  assert.equal(locked.body.error.code, "UNIT_LOCKED");
});

test("archived ingredients retain balance and history but reject new stock changes", async () => {
  const session = await login();
  const created = await send(session, "post", "/ingredients", {
    name: "Archive stock test",
    baseUnit: "g",
    lowStockThreshold: "0",
    isActive: true,
  });
  const id = created.body.data.id;
  await send(session, "post", "/stock-operations", {
    type: "receipt",
    reason: "Opening",
    requestKey: randomUUID(),
    lines: [{ ingredientId: id, quantity: "5" }],
  });
  const archived = await send(session, "delete", "/ingredients/" + id);
  assert.equal(archived.body.data.quantityOnHand, "5");
  assert.equal(archived.body.data.isActive, false);
  assert.equal(
    await db.stockMovement.count({ where: { ingredientId: id } }),
    1,
  );
  const denied = await send(session, "post", "/stock-operations", {
    type: "usage",
    reason: "Inactive",
    requestKey: randomUUID(),
    lines: [{ ingredientId: id, quantity: "1" }],
  });
  assert.equal(denied.status, 200);
  assert.equal(denied.body.ok, false);
});

test("a failing multi-ingredient operation changes none of its balances", async () => {
  const session = await login();
  const empty = await db.ingredient.create({
    data: { name: "Empty ingredient", baseUnit: "g" },
  });
  const before = (
    await db.ingredient.findUnique({ where: { id: rice.id } })
  ).quantityOnHand.toString();
  const result = await send(session, "post", "/stock-operations", {
    type: "usage",
    reason: "Atomic failure",
    requestKey: randomUUID(),
    lines: [
      { ingredientId: rice.id, quantity: "10" },
      { ingredientId: empty.id, quantity: "1" },
    ],
  });
  assert.equal(result.body.error.code, "INSUFFICIENT_STOCK");
  assert.equal(
    (
      await db.ingredient.findUnique({ where: { id: rice.id } })
    ).quantityOnHand.toString(),
    before,
  );
});

test("multiple reads and corrections reject attempts to make stock negative", async () => {
  const session = await login();
  const result = await send(session, "post", "/stock-operations", {
    type: "correction",
    reason: "Invalid stock count",
    requestKey: randomUUID(),
    lines: [{ ingredientId: rice.id, quantity: "-99999" }],
  });
  assert.equal(result.body.error.code, "INSUFFICIENT_STOCK");
  const first = await session.agent.get("/api/stock-operations");
  const second = await session.agent.get("/api/stock-operations");
  assert.deepEqual(first.body.data, second.body.data);
  assert.equal(
    (await session.agent.get("/api/ingredients/" + rice.id + "/movements")).body
      .ok,
    true,
  );
});

test("staff can edit public preparation summaries and changing slug preserves the published story", async () => {
  const session = await login("chef");
  const saved = await send(session, "post", "/dishes", {
    name: "Public story dish",
    slug: "public-story-dish",
    categoryId: category.id,
    priceMinor: "80000",
    isPublished: true,
    preparationSummary: "A customer-facing description.",
  });
  assert.equal(saved.body.ok, true);
  const changed = await send(
    session,
    "patch",
    "/dishes/" + saved.body.data.id,
    { slug: "renamed-public-story-dish", name: "Renamed public story dish" },
  );
  assert.equal(
    changed.body.data.preparationSummary,
    "A customer-facing description.",
  );
  const publicResponse = await request(app).get(
    "/api/menu/renamed-public-story-dish",
  );
  assert.equal(
    publicResponse.body.data.preparationSummary,
    "A customer-facing description.",
  );
  assert.equal(publicResponse.body.data.recipe, undefined);
  const denied = await request(app)
    .patch("/api/dishes/" + saved.body.data.id)
    .send({ preparationSummary: "Anonymous edit" });
  assert.equal(denied.status, 401);
  const clear = await send(session, "patch", "/dishes/" + saved.body.data.id, {
    preparationSummary: "",
  });
  assert.equal(clear.body.data.preparationSummary, null);
});
test("photo endpoint enforces authentication, CSRF and validates multipart files", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/dish-photos")
        .attach("photo", Buffer.from("bad"), "dish.png")
    ).status,
    401,
  );
  const session = await login("chef");
  assert.equal(
    (
      await session.agent
        .post("/api/dish-photos")
        .attach("photo", Buffer.from("bad"), "dish.png")
    ).status,
    403,
  );
  const bad = await session.agent
    .post("/api/dish-photos")
    .set("X-CSRF-Token", session.token)
    .attach("photo", Buffer.from("bad"), "dish.png");
  assert.equal(bad.status, 200);
  assert.equal(bad.body.error.code, "INVALID_PHOTO");
  const { default: sharp } = await import("sharp");
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const valid = await session.agent
    .post("/api/dish-photos")
    .set("X-CSRF-Token", session.token)
    .attach("photo", bytes, "dish.png");
  assert.equal(valid.body.error.code, "STORAGE_NOT_CONFIGURED");
});
test("chef creates automatic unique slugs and controls draft publication without changing URLs", async () => {
  const s = await login("chef");
  const body = {
    name: "New chef special",
    categoryId: category.id,
    priceMinor: "45000",
  };
  const first = await send(s, "post", "/dishes", body);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.data.slug, "new-chef-special");
  assert.equal(first.body.data.isPublished, false);
  const second = await send(s, "post", "/dishes", body);
  assert.equal(second.body.data.slug, "new-chef-special-2");
  const edited = await send(s, "patch", "/dishes/" + first.body.data.id, {
    name: "Renamed special",
    isPublished: true,
  });
  assert.equal(edited.body.data.slug, "new-chef-special");
  assert.equal(edited.body.data.isPublished, true);
  const bad = await send(s, "patch", "/dishes/" + first.body.data.id, {
    imagePath: "https://example.com/private.webp",
  });
  assert.equal(bad.body.error.code, "INVALID_PHOTO_REFERENCE");
});
