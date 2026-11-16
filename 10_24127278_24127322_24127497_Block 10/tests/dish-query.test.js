import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database.js";
import { queryDishes } from "../src/models/dish-query.js";
test("server paging, full-text relevance, filters and stable boundaries", async () => {
  const fixture = await testDatabase(),
    db = fixture.db;
  try {
    const c = await db.category.create({
      data: { name: "Mains", slug: "mains" },
    });
    await db.dish.createMany({
      data: Array.from({ length: 105 }, (_, i) => ({
        name: i === 0 ? "Miso special" : `Bowl ${String(i).padStart(3, "0")}`,
        slug: `query-${i}`,
        categoryId: c.id,
        description: "Miso broth and noodles",
        priceMinor: BigInt(100 + (i % 5)),
        isPublished: i < 100,
        isAvailable: i % 2 === 0,
      })),
    });
    const reads = [];
    const traced = {
      $transaction: (action, options) =>
        db.$transaction(
          (tx) =>
            action({
              $queryRaw: async (...args) => {
                const rows = await tx.$queryRaw(...args);
                reads.push({
                  sql: (args[0].strings || args[0]).join("?"),
                  rows: rows.length,
                });
                return rows;
              },
              dish: {
                findMany: async (args) => {
                  reads.push({ take: args.take, ids: args.where.id.in.length });
                  return tx.dish.findMany(args);
                },
              },
              category: tx.category,
            }),
          options,
        ),
    };
    const a = await queryDishes(traced, { pageSize: 12, sort: "price_asc" }),
      b = await queryDishes(db, { pageSize: 12, page: 2, sort: "price_asc" });
    assert.equal(a.items.length, 12);
    assert.equal(reads.find((r) => r.sql?.includes("count(*)")).rows, 1);
    assert.match(
      reads.find((r) => r.sql?.includes("SELECT d.id")).sql,
      /LIMIT .* OFFSET /,
    );
    assert.equal(reads.find((r) => r.sql?.includes("SELECT d.id")).rows, 12);
    assert.deepEqual(
      reads.find((r) => r.take),
      { take: 12, ids: 12 },
    );
    assert.equal(a.total, 100);
    assert.equal(a.pageCount, 9);
    assert.equal(new Set([...a.items, ...b.items].map((x) => x.id)).size, 24);
    assert.deepEqual(
      (
        await queryDishes(db, {
          pageSize: 12,
          page: 2,
          sort: "price_asc",
          mode: "more",
        })
      ).items,
      b.items,
    );
    const end = await queryDishes(db, { pageSize: 12, page: 999 });
    assert.equal(end.page, 9);
    assert.equal(end.items.length, 4);
    assert.equal(end.hasNext, false);
    const search = await queryDishes(db, { q: "miso", sort: "relevance" });
    assert.equal(search.items[0].name, "Miso special");
    assert.equal(
      (
        await queryDishes(db, {
          q: '"broth and noodles"',
          category: "mains",
          availability: "available",
          minPrice: 101,
          maxPrice: 103,
        })
      ).total,
      30,
    );
    assert.equal((await queryDishes(db, { q: "nonexistentterm" })).total, 0);
    assert.equal((await queryDishes(db, { status: "draft" }, true)).total, 5);
    assert.equal((await queryDishes(db, { status: "draft" })).total, 100);
    assert.equal("isPublished" in a.items[0], false);
    await assert.rejects(() => queryDishes(db, { pageSize: 5000 }));
    await assert.rejects(() =>
      queryDishes(db, { sort: "name; DROP TABLE dishes" }),
    );
    await assert.rejects(() => queryDishes(db, { minPrice: 50, maxPrice: 10 }));
  } finally {
    await fixture.close();
  }
});

test("plain search matches word prefixes with pagination and public visibility intact", async () => {
  const fixture = await testDatabase(),
    db = fixture.db;
  try {
    const category = await db.category.create({
      data: { name: "Tempura", slug: "tempura" },
    });
    await db.dish.createMany({
      data: [
        {
          name: "Shrimp tempura",
          description: "Crisp batter",
          isPublished: true,
        },
        {
          name: "Vegetable tempura",
          description: "Seasonal vegetables",
          isPublished: true,
        },
        {
          name: "Chef special",
          description: "Shrimp tempura selection",
          isPublished: true,
        },
        {
          name: "Draft tempura",
          description: "Private dish",
          isPublished: false,
        },
      ].map((d, i) => ({
        ...d,
        slug: "prefix-" + i,
        categoryId: category.id,
        priceMinor: 100n,
      })),
    });
    const first = await queryDishes(db, {
      q: "temp",
      pageSize: 2,
      sort: "relevance",
    });
    const second = await queryDishes(db, {
      q: "temp",
      pageSize: 2,
      page: 2,
      sort: "relevance",
    });
    assert.equal(first.total, 3);
    assert.equal(first.items.length, 2);
    assert.equal(second.items.length, 1);
    assert.equal(
      new Set([...first.items, ...second.items].map((d) => d.id)).size,
      3,
    );
    assert.equal((await queryDishes(db, { q: "TEMP" })).total, 3);
    assert.equal((await queryDishes(db, { q: "shr temp" })).total, 2);
    assert.equal((await queryDishes(db, { q: "temp" }, true)).total, 4);
    assert.equal((await queryDishes(db, { q: '"shrimp tempura"' })).total, 2);
    assert.equal(
      (await queryDishes(db, { q: "shrimp OR vegetable" })).total,
      3,
    );
    assert.equal((await queryDishes(db, { q: "tempura -shrimp" })).total, 1);
    assert.equal((await queryDishes(db, { q: "   " })).total, 3);
    assert.equal((await queryDishes(db, { q: "zzzz" })).total, 0);
  } finally {
    await fixture.close();
  }
});

test("fuzzy search handles typos and reversed words without exposing drafts", async () => {
  const fixture = await testDatabase();
  try {
    const db = fixture.db;
    const category = await db.category.create({
      data: { name: "Fuzzy mains", slug: "fuzzy-mains" },
    });
    await db.dish.createMany({
      data: [
        { name: "Shrimp tempura", isPublished: true },
        { name: "Shrimp temupra", isPublished: true },
        { name: "Private shrimp tempura", isPublished: false },
        { name: "Vegetable tempura", isPublished: true },
        {
          name: "Shrimp tempura archived",
          isPublished: true,
          archivedAt: new Date(),
        },
      ].map((d, i) => ({
        ...d,
        slug: "fuzzy-" + i,
        categoryId: category.id,
        priceMinor: 100n,
      })),
    });
    const result = await queryDishes(db, {
      q: "temupra shrimp",
      sort: "relevance",
      pageSize: 1,
    });
    assert.equal(result.total, 2);
    assert.equal(result.items[0].name, "Shrimp temupra");
    const second = await queryDishes(db, {
      q: "temupra shrimp",
      sort: "relevance",
      pageSize: 1,
      page: 2,
    });
    assert.equal(second.items[0].name, "Shrimp tempura");
    assert.equal(second.hasNext, false);
    assert.equal((await queryDishes(db, { q: "tempura shrmp" })).total, 2);
    assert.equal(
      (await queryDishes(db, { q: "temupra shrimp", status: "draft" }, true))
        .total,
      1,
    );
    assert.equal((await queryDishes(db, { q: '"temupra shrimp"' })).total, 0);
    assert.equal((await queryDishes(db, { q: "zzzzzzzz" })).total, 0);
    assert.equal(
      (await queryDishes(db, { q: "temupra shrimp", minPrice: 101 })).total,
      0,
    );
  } finally {
    await fixture.close();
  }
});

test("adjacent transpositions match different dish names and keep every term required", async () => {
  const f = await testDatabase();
  try {
    const c = await f.db.category.create({
      data: { name: "Sushi", slug: "sushi" },
    });
    await f.db.dish.createMany({
      data: [
        "Salmon nigiri",
        "Matcha mochi",
        "Chicken teriyaki",
        "Salmon salad",
      ].map((name, i) => ({
        name,
        slug: "swaps-" + i,
        categoryId: c.id,
        priceMinor: 100n,
        isPublished: true,
      })),
    });
    for (const [q, name] of [
      ["salomn nigiir", "Salmon nigiri"],
      ["nigiir salomn", "Salmon nigiri"],
      ["mathca mohci", "Matcha mochi"],
      ["chikcen teriykai", "Chicken teriyaki"],
    ]) {
      const result = await queryDishes(f.db, { q });
      assert.ok(
        result.items.some((d) => d.name === name),
        q,
      );
      if (q.includes("nigiir"))
        assert.ok(!result.items.some((d) => d.name === "Salmon salad"));
    }
    assert.equal((await queryDishes(f.db, { q: "salomn zzzzzz" })).total, 0);
    assert.equal((await queryDishes(f.db, { q: '"salomn nigiir"' })).total, 0);
  } finally {
    await f.close();
  }
});
