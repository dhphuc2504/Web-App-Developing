import { createDatabase } from "../src/config/database.js";
import { queryDishes } from "../src/models/dish-query.js";
let db;
try {
  const { env } = await import("../src/config/env.js");
  db = createDatabase(env.DATABASE_URL);
  const first = await queryDishes(db, {
    page: 1,
    pageSize: 12,
    sort: "price_asc",
  });
  const next = await queryDishes(db, {
    page: 2,
    pageSize: 12,
    sort: "price_asc",
  });
  const searched = await queryDishes(db, {
    q: "miso",
    sort: "relevance",
    pageSize: 4,
  });
  const prefixSearch = await queryDishes(db, {
    q: "temp",
    pageSize: 4,
    sort: "relevance",
  });
  const salmonSearch = await queryDishes(db, {
    q: "salomn nigiir",
    pageSize: 4,
    sort: "relevance",
  });
  const fuzzySearch = await queryDishes(db, {
    q: "temupra shrimp",
    pageSize: 4,
    sort: "relevance",
  });
  const indexes =
    await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname='restaurant' AND tablename='dishes'`;
  const fuzzyPlan = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('pg_trgm.strict_word_similarity_threshold', '0.3', true)`;
    return tx.$queryRaw`EXPLAIN (ANALYZE,FORMAT JSON) SELECT id FROM restaurant.dishes WHERE restaurant.dish_fuzzy_match(lower(coalesce(name,'') || ' ' || coalesce(description,'')), 'temupra') LIMIT 4`;
  });
  const pricePlan =
    await db.$queryRaw`EXPLAIN (ANALYZE,FORMAT JSON) SELECT id FROM restaurant.dishes WHERE archived_at IS NULL AND is_published=true ORDER BY price_minor,id LIMIT 12`;
  const searchPlan =
    await db.$queryRaw`EXPLAIN (ANALYZE,FORMAT JSON) SELECT id FROM restaurant.dishes WHERE (setweight(to_tsvector('simple',coalesce(name,'')),'A') || setweight(to_tsvector('simple',coalesce(description,'')),'B')) @@ websearch_to_tsquery('simple','miso') LIMIT 4`;
  const summarize = (plan) => {
    const p = plan[0]["QUERY PLAN"][0];
    const names = [];
    function visit(n) {
      if (n["Index Name"]) names.push(n["Index Name"]);
      for (const x of n.Plans || []) visit(x);
    }
    visit(p.Plan);
    return {
      milliseconds: p["Execution Time"],
      indexes: names,
      rows: p.Plan["Actual Rows"],
    };
  };
  console.log(
    JSON.stringify(
      {
        salmonTypoMatches: salmonSearch.total,
        salmonTypoNames: salmonSearch.items.map((d) => d.name),
        fuzzyQuery: "temupra shrimp",
        fuzzyMatches: fuzzySearch.total,
        fuzzyNames: fuzzySearch.items.map((d) => d.name),
        prefixQuery: "temp",
        prefixMatches: prefixSearch.total,
        prefixNames: prefixSearch.items.map((d) => d.name),
        totalMatching: first.total,
        firstBatch: first.items.length,
        nextBatch: next.items.length,
        noOverlap: !next.items.some((d) =>
          first.items.some((x) => x.id === d.id),
        ),
        fullTextMatches: searched.total,
        searchBatch: searched.items.length,
        indexes: indexes.map((i) => i.indexname),
        fuzzyPlan: summarize(fuzzyPlan),
        pricePlan: summarize(pricePlan),
        searchPlan: summarize(searchPlan),
      },
      null,
      2,
    ),
  );
} catch {
  console.error("Read-only search check failed. Provider details suppressed.");
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
}
