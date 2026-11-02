import { env } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
const db=createDatabase(env.DATABASE_URL);
try {
 await db.$transaction(async tx=>{
  const names=[['Sushi','sushi'],['Warm dishes','warm-dishes'],['Sweet endings','sweet-endings']];
  const categories={};
  for(const [name,slug] of names)categories[slug]=await tx.category.upsert({where:{slug},create:{name,slug},update:{}});
  const dishes=[
   ['Salmon nigiri','demo-salmon-nigiri','sushi',145000,'Silky salmon over gently seasoned rice, with a delicate touch of garnish.'],
   ['Shrimp tempura','demo-shrimp-tempura','warm-dishes',135000,'Light, crisp shrimp and seasonal vegetables, prepared in a delicate batter.'],
   ['Miso ramen','demo-miso-ramen','warm-dishes',125000,'A comforting miso broth with noodles, a soft egg, greens, and tender pork.'],
   ['Seasonal vegetable bowl','demo-seasonal-vegetable-bowl','warm-dishes',95000,'Colorful seasonal vegetables, roasted pumpkin, and rice in a generous bowl.'],
   ['Salmon teriyaki','demo-salmon-teriyaki','warm-dishes',165000,'Glazed salmon, steamed rice, seasonal greens, and a little pickled ginger.'],
   ['Matcha mochi','demo-matcha-mochi','sweet-endings',65000,'Soft matcha-dusted mochi with strawberries. A quiet finish to your meal.'],
   ['Vegetable tempura','demo-vegetable-tempura','warm-dishes',115000,'Seasonal vegetables in a light, crisp batter, served with dipping sauce.'],
   ['Shoyu ramen','demo-shoyu-ramen','warm-dishes',135000,'Soy-seasoned broth, springy noodles, a soft egg, and a generous garnish.'],
  ];
  for(const [name,slug,category,priceMinor,description] of dishes)await tx.dish.upsert({where:{slug},create:{name,slug,categoryId:categories[category].id,priceMinor:BigInt(priceMinor),description,imagePath:'/images/japan/food-atlas.png',imageAlt:name,isPublished:true,isAvailable:true},update:{}});
  // Only add an image to the original known demonstration dish if it still has none.
  await tx.dish.updateMany({where:{slug:'garden-vegetable-bowl',imagePath:null},data:{imagePath:'/images/japan/food-atlas.png',imageAlt:'Seasonal vegetables and rice bowl'}});
 });
 console.log('Japanese demonstration menu added. Existing dishes were not overwritten.');
} catch {console.error('Menu seed failed; details suppressed to protect credentials.');process.exitCode=1;}
finally {await db.$disconnect();}
