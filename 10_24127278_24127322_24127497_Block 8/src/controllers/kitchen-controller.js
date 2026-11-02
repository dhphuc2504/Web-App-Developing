import { randomUUID } from 'node:crypto';
import { AppError,publicError } from '../lib/errors.js';
import { uuid,recipeItemsFromForm } from '../validators/input.js';
export function createKitchenController(repo,recipes,stock) {
 const recipePage=async(req,res,{error=null,input=null,usageError=null,usageInput=null}={})=>{
  uuid.parse(req.params.id);const dish=await repo.db.dish.findUnique({where:{id:req.params.id},include:{recipe:{include:{items:true}}}});
  if(!dish || dish.archivedAt)throw new AppError(404,'Dish not found.');
  // Retain saved/submitted ingredients even when they fall outside the first pantry page.
  const selectedIds=[...new Set([...(dish.recipe?.items || []).map(item=>item.ingredientId),...[].concat(input?.ingredientId || [])])].filter(id=>uuid.safeParse(id).success);
  const [available,selected]=await Promise.all([repo.ingredients(),repo.db.ingredient.findMany({where:{id:{in:selectedIds}}})]);
  const ingredients=[...new Map([...available,...selected].map(item=>[item.id,item])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  res.render('chef/recipe',{title:`Recipe: ${dish.name}`,dish,ingredients,requestKey:usageInput?.requestKey || randomUUID(),error,input,usageError,usageInput});
 };
 return {
  dashboard: async(req,res)=>res.render('chef/dashboard',{title:'Kitchen',dishes:await repo.dishes(),ingredients:await repo.ingredients()}),
  recipe: async(req,res)=>recipePage(req,res),
  saveRecipe: async(req,res)=>{
   try {await recipes.save(req.params.id,{...req.body,items:recipeItemsFromForm(req.body)},req.user.id);req.session.flash='Recipe saved.';res.redirect(303,req.get('X-Requested-With')==='RecipePaper'?'/kitchen':`/kitchen/dishes/${req.params.id}/recipe`);}
   catch(error){const safe=publicError(error);if(![409,422].includes(safe.status))throw error;res.status(safe.status);await recipePage(req,res,{error:safe.message,input:req.body});}
  },
  ingredient: async(req,res)=>{
   uuid.parse(req.params.id);
   const ingredient=await repo.db.ingredient.findUnique({where:{id:req.params.id},include:{movements:{take:30,orderBy:[{createdAt:'desc'},{id:'desc'}],include:{operation:{include:{actor:{select:{displayName:true}}}}}},recipeItems:{take:100,where:{recipe:{dish:{archivedAt:null}}},include:{recipe:{include:{dish:{select:{id:true,name:true}}}}}}}});
   if(!ingredient || ingredient.archivedAt)throw new AppError(404,'Ingredient not found.');
   res.render('chef/ingredient',{title:ingredient.name,ingredient});
  },
  recipeUsage: async(req,res)=>{
   try {
    uuid.parse(req.params.id);const recipe=await repo.db.recipe.findUnique({where:{dishId:req.params.id}});if(!recipe)throw new AppError(404,'Recipe not found.');
    await stock.record({type:'usage',reason:req.body.reason,requestKey:req.body.requestKey,recipeId:recipe.id,recipeVersion:req.body.recipeVersion,servings:req.body.servings},req.user);
    req.session.flash='Recipe usage recorded.';res.redirect(303,'/kitchen/stock-history');
   }catch(error){const safe=publicError(error);if(![409,422].includes(safe.status))throw error;res.status(safe.status);await recipePage(req,res,{usageError:safe.message,usageInput:req.body});}
  },
  history: async(req,res)=>res.render('chef/history',{title:'Stock history',operations:await repo.history()}),
  stockForm: async(req,res)=>res.render('chef/stock',{title:'Record stock change',ingredients:await repo.ingredients(),requestKey:randomUUID(),error:null,input:{ingredientId:typeof req.query.ingredientId==='string'?req.query.ingredientId:''}}),
  stock: type => async(req,res)=>{
   try {
    await stock.record({type,reason:req.body.reason,requestKey:req.body.requestKey,lines:[{ingredientId:req.body.ingredientId,quantity:req.body.quantity}]},req.user);
    req.session.flash='Stock change recorded.';res.redirect(303,'/kitchen/stock-history');
   }catch(error){const safe=publicError(error);if(![409,422].includes(safe.status))throw error;
    res.status(safe.status).render('chef/stock',{title:'Record stock change',ingredients:await repo.ingredients(),requestKey:req.body.requestKey || randomUUID(),error:safe.message,input:{...req.body,type}});
   }
  },
 };
}
