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
