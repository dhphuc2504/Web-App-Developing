-- Additive: preserve every restaurant record and any existing extension schema.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
DO $migration$
DECLARE ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema FROM pg_extension e
    JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm';
  EXECUTE format('CREATE OR REPLACE FUNCTION restaurant.dish_fuzzy_match(haystack text, needle text)
    RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS %L',
    format('SELECT needle OPERATOR(%I.<<%%) haystack', ext_schema));
  EXECUTE format($index$CREATE INDEX dishes_fuzzy_search_idx ON restaurant.dishes USING gin
    ((lower(coalesce(name,'') || ' ' || coalesce(description,''))) %I.gin_trgm_ops)$index$, ext_schema);
END $migration$;
