import { recipeInput,uuid } from '../validators/input.js';
import { AppError } from '../lib/errors.js';
export function createRecipeService(db) {
  return {
    async save(dishId,body,userId) {
      uuid.parse(dishId); const data=recipeInput.parse(body);
      if (new Set(data.items.map(x=>x.ingredientId)).size!==data.items.length) throw new AppError(422,'An ingredient may appear only once in a recipe.');
      return db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM restaurant.dishes WHERE id = ${dishId}::uuid FOR UPDATE`;
        const dish=await tx.dish.findUnique({where:{id:dishId},include:{recipe:true}});
        if (!dish || dish.archivedAt) throw new AppError(404,'Dish not found.');
        if ((dish.recipe?.version || 0)!==data.version) throw new AppError(409,'This recipe changed. Reload before editing again.');
        const ids=data.items.map(i=>i.ingredientId).sort();
        for (const id of ids) await tx.$queryRaw`SELECT id FROM restaurant.ingredients WHERE id = ${id}::uuid FOR UPDATE`;
        const count=await tx.ingredient.count({where:{id:{in:ids},isActive:true,archivedAt:null}});
        if (count!==ids.length) throw new AppError(422,'Recipes require active ingredients.');
        const values={instructions:data.instructions,preparationMinutes:data.preparationMinutes,cookingMinutes:data.cookingMinutes,updatedBy:userId};
        const recipe=dish.recipe ? await tx.recipe.update({where:{id:dish.recipe.id},data:{...values,version:{increment:1}}}) : await tx.recipe.create({data:{...values,dishId}});
        await tx.recipeItem.deleteMany({where:{recipeId:recipe.id}});
        await tx.recipeItem.createMany({data:data.items.map(i=>({...i,recipeId:recipe.id}))});
        return recipe;
      });
    },
  };
}
