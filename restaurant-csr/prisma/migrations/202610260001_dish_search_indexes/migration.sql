-- Expression GIN index: no data rewrite or recipe exposure. Keep expression in sync with dish-query.js.
CREATE INDEX dishes_search_gin ON restaurant.dishes USING GIN ((setweight(to_tsvector('simple', coalesce(name,'')), 'A') || setweight(to_tsvector('simple', coalesce(description,'')), 'B')));
CREATE INDEX dishes_public_price_id ON restaurant.dishes (price_minor, id) WHERE archived_at IS NULL AND is_published = true;
CREATE INDEX dishes_category_price_id ON restaurant.dishes (category_id, price_minor, id) WHERE archived_at IS NULL;
CREATE INDEX dishes_name_id ON restaurant.dishes (name, id) WHERE archived_at IS NULL;
CREATE INDEX dishes_created_id ON restaurant.dishes (created_at, id) WHERE archived_at IS NULL;
