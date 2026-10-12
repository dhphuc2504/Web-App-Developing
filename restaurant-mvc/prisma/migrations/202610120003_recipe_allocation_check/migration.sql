-- SQL CHECK treats NULL as success, so explicitly require every recipe field.
ALTER TABLE restaurant.stock_operations DROP CONSTRAINT operation_recipe;
ALTER TABLE restaurant.stock_operations ADD CONSTRAINT operation_recipe CHECK (
 (recipe_id IS NULL AND recipe_version IS NULL AND servings IS NULL) OR
 (type = 'usage' AND recipe_id IS NOT NULL AND recipe_version IS NOT NULL
  AND servings IS NOT NULL AND recipe_version > 0 AND servings > 0)
);
