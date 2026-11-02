import { env } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
const db=createDatabase(env.DATABASE_URL);
try {
 await db.$transaction(async tx=>{
  const category=await tx.category.upsert({where:{slug:'house-specials'},create:{name:'House specials',slug:'house-specials',description:'Seasonal favourites'},update:{}});
  await tx.dish.upsert({where:{slug:'garden-vegetable-bowl'},create:{name:'Garden vegetable bowl',slug:'garden-vegetable-bowl',categoryId:category.id,description:'Seasonal vegetables and fragrant rice.',priceMinor:75000n,isPublished:true,isFeatured:true},update:{}});
  for(const [name,baseUnit,lowStockThreshold] of [['Rice','g','1000'],['Seasonal vegetables','g','500'],['Cooking oil','ml','250']])await tx.ingredient.upsert({where:{name},create:{name,baseUnit,lowStockThreshold},update:{}});
 });
 console.log('Demo menu and zero-balance ingredients seeded. Receive stock through the admin UI.');
} catch {console.error('Seeding failed. Check database connectivity and migrations.');process.exitCode=1;}
finally {await db.$disconnect();}
