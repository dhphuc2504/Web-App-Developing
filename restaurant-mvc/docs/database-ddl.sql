-- Santaishi-tei: PostgreSQL DDL reference
-- Exact SQL from the project's existing Prisma migrations, in deployment order.
-- Original migration files remain the source of truth and are unchanged.
-- This export contains application schema DDL; Prisma manages its migration metadata.

-- ===== Migration 1: 202610120001_initial =====
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "restaurant";
SET search_path TO "restaurant", public;

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "price_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "image_path" TEXT,
    "image_alt" VARCHAR(200),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "base_unit" VARCHAR(10) NOT NULL,
    "quantity_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "low_stock_threshold" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "preparation_minutes" INTEGER,
    "cooking_minutes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "recipe_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "notes" VARCHAR(250),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("recipe_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "stock_operations" (
    "id" UUID NOT NULL,
    "type" VARCHAR(12) NOT NULL,
    "reason" TEXT NOT NULL,
    "recipe_id" UUID,
    "recipe_version" INTEGER,
    "servings" INTEGER,
    "created_by" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity_delta" DECIMAL(14,3) NOT NULL,
    "quantity_before" DECIMAL(14,3) NOT NULL,
    "quantity_after" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sid" VARCHAR(36) NOT NULL,
    "data" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "dishes_slug_key" ON "dishes"("slug");

-- CreateIndex
CREATE INDEX "dishes_category_id_is_published_idx" ON "dishes"("category_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_dish_id_key" ON "recipes"("dish_id");

-- CreateIndex
CREATE INDEX "recipe_items_ingredient_id_idx" ON "recipe_items"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_operations_request_key_key" ON "stock_operations"("request_key");

-- CreateIndex
CREATE INDEX "stock_operations_created_at_idx" ON "stock_operations"("created_at");

-- CreateIndex
CREATE INDEX "stock_movements_ingredient_id_created_at_idx" ON "stock_movements"("ingredient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_operation_id_ingredient_id_key" ON "stock_movements"("operation_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_operations" ADD CONSTRAINT "stock_operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "stock_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ===== Migration 2: 202610120002_integrity =====
-- Explicit constraints supplement the code-first Prisma schema.
ALTER TABLE restaurant.staff_users ADD CONSTRAINT staff_role CHECK (role IN ('admin','chef')),
 ADD CONSTRAINT staff_email_lower CHECK (email = lower(email)),
 ADD CONSTRAINT staff_name CHECK (length(btrim(display_name)) > 0);
ALTER TABLE restaurant.categories ADD CONSTRAINT category_order CHECK (display_order >= 0),
 ADD CONSTRAINT category_name CHECK (length(btrim(name)) > 0);
ALTER TABLE restaurant.dishes ADD CONSTRAINT dish_price CHECK (price_minor >= 0),
 ADD CONSTRAINT dish_currency CHECK (currency = 'VND'),
 ADD CONSTRAINT dish_order CHECK (display_order >= 0),
 ADD CONSTRAINT dish_name CHECK (length(btrim(name)) > 0);
ALTER TABLE restaurant.ingredients ADD CONSTRAINT ingredient_unit CHECK (base_unit IN ('g','ml','piece')),
 ADD CONSTRAINT ingredient_balance CHECK (quantity_on_hand >= 0),
 ADD CONSTRAINT ingredient_threshold CHECK (low_stock_threshold >= 0),
 ADD CONSTRAINT ingredient_name CHECK (length(btrim(name)) > 0);
ALTER TABLE restaurant.recipes ADD CONSTRAINT recipe_version CHECK (version > 0),
 ADD CONSTRAINT recipe_prep CHECK (preparation_minutes IS NULL OR preparation_minutes >= 0),
 ADD CONSTRAINT recipe_cook CHECK (cooking_minutes IS NULL OR cooking_minutes >= 0);
ALTER TABLE restaurant.recipe_items ADD CONSTRAINT recipe_quantity CHECK (quantity > 0);
ALTER TABLE restaurant.stock_operations ADD CONSTRAINT operation_type CHECK (type IN ('receipt','usage','waste','correction')),
 ADD CONSTRAINT operation_reason CHECK (length(btrim(reason)) > 0),
 ADD CONSTRAINT operation_recipe CHECK (
  (recipe_id IS NULL AND recipe_version IS NULL AND servings IS NULL) OR
  (type = 'usage' AND recipe_id IS NOT NULL AND recipe_version > 0 AND servings > 0)
 );
ALTER TABLE restaurant.stock_movements ADD CONSTRAINT movement_delta CHECK (quantity_delta <> 0),
 ADD CONSTRAINT movement_balances CHECK (quantity_before >= 0 AND quantity_after >= 0),
 ADD CONSTRAINT movement_math CHECK (quantity_after = quantity_before + quantity_delta);

CREATE FUNCTION restaurant.immutable_stock_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Stock history is immutable; record a compensating operation';
END;
$$;
CREATE TRIGGER immutable_operations BEFORE UPDATE OR DELETE ON restaurant.stock_operations
 FOR EACH ROW EXECUTE FUNCTION restaurant.immutable_stock_history();
CREATE TRIGGER immutable_movements BEFORE UPDATE OR DELETE ON restaurant.stock_movements
 FOR EACH ROW EXECUTE FUNCTION restaurant.immutable_stock_history();

CREATE FUNCTION restaurant.check_movement_type() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation_type text;
BEGIN
 SELECT type INTO operation_type FROM restaurant.stock_operations WHERE id = NEW.operation_id;
 IF (operation_type = 'receipt' AND NEW.quantity_delta <= 0) OR
    (operation_type IN ('usage','waste') AND NEW.quantity_delta >= 0) THEN
  RAISE EXCEPTION 'Movement sign does not match operation type';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER check_movement_sign BEFORE INSERT ON restaurant.stock_movements
 FOR EACH ROW EXECUTE FUNCTION restaurant.check_movement_type();

CREATE FUNCTION restaurant.check_ingredient_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.base_unit <> OLD.base_unit AND (
  EXISTS (SELECT 1 FROM restaurant.recipe_items WHERE ingredient_id = OLD.id) OR
  EXISTS (SELECT 1 FROM restaurant.stock_movements WHERE ingredient_id = OLD.id)
 ) THEN RAISE EXCEPTION 'An ingredient unit cannot change after it has been used'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER check_unit_change BEFORE UPDATE ON restaurant.ingredients
 FOR EACH ROW EXECUTE FUNCTION restaurant.check_ingredient_unit();

-- These tables are accessed through the server's PostgreSQL connection, not PostgREST.
REVOKE ALL ON SCHEMA restaurant FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA restaurant FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA restaurant FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON SCHEMA restaurant FROM anon;
  REVOKE ALL ON ALL TABLES IN SCHEMA restaurant FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE ALL ON SCHEMA restaurant FROM authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA restaurant FROM authenticated;
 END IF;
END $$;


-- ===== Migration 3: 202610120003_recipe_allocation_check =====
-- SQL CHECK treats NULL as success, so explicitly require every recipe field.
ALTER TABLE restaurant.stock_operations DROP CONSTRAINT operation_recipe;
ALTER TABLE restaurant.stock_operations ADD CONSTRAINT operation_recipe CHECK (
 (recipe_id IS NULL AND recipe_version IS NULL AND servings IS NULL) OR
 (type = 'usage' AND recipe_id IS NOT NULL AND recipe_version IS NOT NULL
  AND servings IS NOT NULL AND recipe_version > 0 AND servings > 0)
);
