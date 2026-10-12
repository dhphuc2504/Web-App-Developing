import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { testDatabase } from './database.js';
import { createApp } from '../src/app.js';
import { PrismaSessionStore } from '../src/models/session-store.js';
import { createRepository } from '../src/models/repository.js';
import { createAuthService } from '../src/services/auth-service.js';
import { createCatalogService } from '../src/services/catalog-service.js';
import { createRecipeService } from '../src/services/recipe-service.js';
import { createStockService } from '../src/services/stock-service.js';
let fixture,db,admin,chef,category,dish,rice,oil,recipe,stock,catalog,app;
const csrf=html=>html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
const password='Test-only-long-passphrase-123';
before(async()=>{
 fixture=await testDatabase();db=fixture.db;
 const repo=createRepository(db),auth=createAuthService(repo);
 admin=await auth.createInitialAdmin({displayName:'Test Admin',email:'admin@example.test',password});
 chef=await auth.createChef({displayName:'Test Chef',email:'chef@example.test',password});
 catalog=createCatalogService(repo);stock=createStockService(db);
 category=await catalog.category(null,{name:'Mains',slug:'mains',isActive:'on'});
 dish=await catalog.dish(null,{categoryId:category.id,name:'Rice bowl',slug:'rice-bowl',priceMinor:'75000',isPublished:'on',isAvailable:'on'});
 rice=await catalog.ingredient(null,{name:'Rice',baseUnit:'g',lowStockThreshold:'100',isActive:'on'});
 oil=await catalog.ingredient(null,{name:'Oil',baseUnit:'ml',lowStockThreshold:'10',isActive:'on'});
 recipe=await createRecipeService(db).save(dish.id,{version:0,instructions:'Cook rice.',preparationMinutes:5,cookingMinutes:10,items:[{ingredientId:rice.id,quantity:'100'},{ingredientId:oil.id,quantity:'5'}]},chef.id);
 await stock.record({type:'receipt',reason:'Opening rice',requestKey:randomUUID(),lines:[{ingredientId:rice.id,quantity:'1000'}]},admin);
 await stock.record({type:'receipt',reason:'Opening oil',requestKey:randomUUID(),lines:[{ingredientId:oil.id,quantity:'20'}]},admin);
 app=createApp({db,store:new PrismaSessionStore(db),config:{NODE_ENV:'test',SESSION_SECRET:'a'.repeat(64)}});
});
after(async()=>{if(fixture)await fixture.close();});
async function signIn(email){const agent=request.agent(app),page=await agent.get('/login');const token=csrf(page.text);const response=await agent.post('/login').type('form').send({_csrf:token,email,password});assert.equal(response.status,303);return agent;}

test('public menu is SSR HTML and excludes drafts',async()=>{
 const draft=await db.dish.create({data:{name:'Private draft',slug:'private-draft',categoryId:category.id,priceMinor:1n}});
 const response=await request(app).get('/menu');assert.equal(response.status,200);assert.match(response.headers['content-type'],/text\/html/);assert.match(response.text,/Rice bowl/);assert.doesNotMatch(response.text,/Private draft/);
 assert.equal((await request(app).get(`/menu/${draft.slug}`)).status,404);
});
test('customers cannot mutate and missing CSRF is rejected',async()=>{
 assert.equal((await request(app).get('/admin')).headers.location,'/login');
 assert.equal((await request(app).post('/admin/categories').type('form').send({name:'Attack'})).status,403);
 const agent=request.agent(app),page=await agent.get('/login');
 assert.equal((await agent.post('/admin/categories').type('form').send({_csrf:csrf(page.text),name:'Attack'})).status,401);
});
test('login rotates session and chef cannot enter admin area',async()=>{
 const agent=request.agent(app),page=await agent.get('/login');const cookie=page.headers['set-cookie'][0].split(';')[0];
 const login=await agent.post('/login').type('form').send({_csrf:csrf(page.text),email:chef.email,password});assert.equal(login.status,303);assert.equal(login.headers.location,'/kitchen');assert.notEqual(login.headers['set-cookie'][0].split(';')[0],cookie);
 assert.equal((await agent.get('/admin')).status,403);
 assert.equal((await agent.get('/kitchen')).status,200);
});
test('chef cannot receive stock even with a valid form token',async()=>{
 const agent=await signIn(chef.email),page=await agent.get('/kitchen/stock/new');
 const response=await agent.post('/kitchen/stock/receipts').type('form').send({_csrf:csrf(page.text),ingredientId:rice.id,quantity:'50',reason:'Denied receipt',requestKey:randomUUID()});assert.equal(response.status,403);
});
test('admin category form follows PRG and GET refresh does not duplicate',async()=>{
 const agent=await signIn(admin.email),page=await agent.get('/admin/categories/new');
 const response=await agent.post('/admin/categories').type('form').send({_csrf:csrf(page.text),name:'Desserts',slug:'desserts',isActive:'on'});assert.equal(response.status,303);assert.equal(response.headers.location,'/admin/categories');
 assert.equal((await agent.get(response.headers.location)).status,200);await agent.get(response.headers.location);
 assert.equal(await db.category.count({where:{slug:'desserts'}}),1);
});
test('stock form renders after a validation failure without leaking a stack',async()=>{
 const agent=await signIn(admin.email),page=await agent.get('/kitchen/stock/new');
 const response=await agent.post('/kitchen/stock/receipts').type('form').send({_csrf:csrf(page.text),ingredientId:rice.id,quantity:'not-a-number',reason:'Invalid quantity',requestKey:randomUUID()});assert.equal(response.status,422);assert.doesNotMatch(response.text,/PrismaClient|node_modules|password_hash/);
});
test('recipe usage deducts all ingredients atomically and retries only once',async()=>{
 const input={type:'usage',reason:'Two servings',requestKey:randomUUID(),recipeId:recipe.id,recipeVersion:1,servings:2};
 const first=await stock.record(input,chef),second=await stock.record(input,chef);assert.equal(first.id,second.id);
 const current=await db.ingredient.findUnique({where:{id:rice.id}});assert.equal(current.quantityOnHand.toString(),'800');
 const moves=await db.stockMovement.findMany({where:{operationId:first.id}});assert.equal(moves.length,2);assert.equal(await db.stockOperation.count({where:{requestKey:input.requestKey}}),1);
 await assert.rejects(()=>stock.record({...input,servings:3},chef),{status:409});
});
test('insufficient ingredient rolls back the entire recipe usage',async()=>{
 const before=await db.stockOperation.count();
 await assert.rejects(()=>stock.record({type:'usage',reason:'Too much',requestKey:randomUUID(),recipeId:recipe.id,recipeVersion:1,servings:3},chef),{status:409});
 assert.equal((await db.ingredient.findUnique({where:{id:rice.id}})).quantityOnHand.toString(),'800');assert.equal(await db.stockOperation.count(),before);
});
test('recipe editing detects stale versions and inactive ingredients',async()=>{
 const service=createRecipeService(db);
 await assert.rejects(()=>service.save(dish.id,{version:0,instructions:'Stale',items:[{ingredientId:rice.id,quantity:'5'}]},chef.id),{status:409});
 await db.ingredient.update({where:{id:oil.id},data:{isActive:false}});
 await assert.rejects(()=>service.save(dish.id,{version:1,instructions:'Inactive',items:[{ingredientId:oil.id,quantity:'5'}]},chef.id),{status:422});
 await db.ingredient.update({where:{id:oil.id},data:{isActive:true}});
});
test('base unit cannot change once recipe/history references it',async()=>{
 await assert.rejects(()=>catalog.ingredient(rice.id,{name:'Rice',baseUnit:'piece',lowStockThreshold:'100',isActive:'on'}),{status:409});
 await assert.rejects(()=>db.ingredient.update({where:{id:rice.id},data:{baseUnit:'ml'}}));
});
test('database constraints protect negative balances and immutable history',async()=>{
 await assert.rejects(()=>db.ingredient.update({where:{id:rice.id},data:{quantityOnHand:'-1'}}));
 const operation=await db.stockOperation.findFirst();await assert.rejects(()=>db.stockOperation.update({where:{id:operation.id},data:{reason:'Edited history'}}));
 const movement=await db.stockMovement.findFirst();await assert.rejects(()=>db.stockMovement.delete({where:{id:movement.id}}));
});
test('deactivated chef loses access with an existing session',async()=>{
 const agent=await signIn(chef.email);await db.staffUser.update({where:{id:chef.id},data:{isActive:false}});
 const response=await agent.get('/kitchen');assert.equal(response.status,303);assert.equal(response.headers.location,'/login');await db.staffUser.update({where:{id:chef.id},data:{isActive:true}});
});
test('stock mutation succeeds with HTTP 303 and POST logout destroys access',async()=>{
 const agent=await signIn(admin.email),page=await agent.get('/kitchen/stock/new');
 const input={_csrf:csrf(page.text),ingredientId:rice.id,quantity:'25',reason:'HTTP receipt',requestKey:randomUUID()};
 const response=await agent.post('/kitchen/stock/receipts').type('form').send(input);assert.equal(response.status,303);assert.equal(response.headers.location,'/kitchen/stock-history');
 assert.equal((await agent.get(response.headers.location)).status,200);
 const next=await agent.get('/admin');assert.equal((await agent.post('/logout').type('form').send({_csrf:csrf(next.text)})).status,303);assert.equal((await agent.get('/admin')).headers.location,'/login');
});
test('setup is disabled outside development',async()=>{assert.equal((await request(app).get('/setup')).status,404);});

test('parallel deductions cannot consume more stock than exists',async()=>{
 const ingredient=await catalog.ingredient(null,{name:'Limited stock',baseUnit:'piece',lowStockThreshold:'0',isActive:'on'});
 await stock.record({type:'receipt',reason:'Limited opening',requestKey:randomUUID(),lines:[{ingredientId:ingredient.id,quantity:'10'}]},admin);
 const attempts=await Promise.allSettled([1,2].map(i=>stock.record({type:'waste',reason:`Concurrent waste ${i}`,requestKey:randomUUID(),lines:[{ingredientId:ingredient.id,quantity:'6'}]},chef)));
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(attempts.find(x=>x.status==='rejected').reason.status,409);
 assert.equal((await db.ingredient.findUnique({where:{id:ingredient.id}})).quantityOnHand.toString(),'4');
});
test('recipe allocation requires all three recipe fields at database level',async()=>{
 await assert.rejects(()=>db.stockOperation.create({data:{type:'usage',reason:'Incomplete recipe metadata',requestKey:randomUUID(),createdBy:admin.id,recipeId:recipe.id}}));
});
test('archiving a dish hides it publicly but preserves its recipe',async()=>{
 await catalog.archive('dish',dish.id);
 assert.equal((await request(app).get('/menu/rice-bowl')).status,404);
 assert.ok(await db.recipe.findUnique({where:{id:recipe.id}}));
});

test('GET deletion links and method override query strings never mutate',async()=>{
 const agent=await signIn(admin.email);
 const row=await catalog.category(null,{name:'GET protected',slug:'get-protected',isActive:'on'});
 for(const path of [`/admin/categories/${row.id}`,`/admin/categories/${row.id}?_method=DELETE`,`/admin/categories/${row.id}/archive`])assert.equal((await agent.get(path)).status,404);
 assert.equal((await db.category.findUnique({where:{id:row.id}})).archivedAt,null);
});
test('archive forms override POST to DELETE and keep PRG for every catalog type',async()=>{
 const agent=await signIn(admin.email);
 const categoryRow=await catalog.category(null,{name:'Archive test',slug:'archive-test',isActive:'on'});
 const dishRow=await catalog.dish(null,{categoryId:category.id,name:'Archive dish',slug:'archive-dish',priceMinor:'50000',isPublished:'on'});
 const ingredientRow=await catalog.ingredient(null,{name:'Archive ingredient',baseUnit:'g',lowStockThreshold:'0',isActive:'on'});
 for(const [base,model,row] of [['/admin/categories','category',categoryRow],['/kitchen/dishes','dish',dishRow],['/kitchen/ingredients','ingredient',ingredientRow]]){
  const page=await agent.get(base);assert.match(page.text,/name="_method" value="DELETE"/);assert.doesNotMatch(page.text,/href="[^"]*\/archive"/);
  assert.equal((await agent.post(`${base}/${row.id}`).type('form').send({_csrf:csrf(page.text)})).status,404);
  const response=await agent.post(`${base}/${row.id}`).type('form').send({_csrf:csrf(page.text),_method:'DELETE'});assert.equal(response.status,303);assert.equal(response.headers.location,base);
  assert.ok((await db[model].findUnique({where:{id:row.id}})).archivedAt);assert.equal((await agent.get(base)).status,200);
 }
});
test('DELETE retains CSRF and administrator authorization',async()=>{
 const row=await catalog.category(null,{name:'DELETE protected',slug:'delete-protected',isActive:'on'});
 const adminAgent=await signIn(admin.email);
 assert.equal((await adminAgent.post(`/admin/categories/${row.id}`).type('form').send({_method:'DELETE'})).status,403);
 const chefAgent=await signIn(chef.email),chefPage=await chefAgent.get('/kitchen');
 assert.equal((await chefAgent.post(`/admin/categories/${row.id}`).type('form').send({_method:'DELETE',_csrf:csrf(chefPage.text)})).status,403);
 assert.equal((await db.category.findUnique({where:{id:row.id}})).archivedAt,null);
 const page=await adminAgent.get('/admin/categories');
 assert.equal((await adminAgent.delete(`/admin/categories/${row.id}`).type('form').send({_csrf:csrf(page.text)})).status,303);
 assert.ok((await db.category.findUnique({where:{id:row.id}})).archivedAt);
});

test('directory links keep the three rooms and staff protection',async()=>{
 const page=await request(app).get('/directory');assert.equal(page.status,200);
 assert.match(page.text,/class="room-door room-dining" href="\/menu"/);
 assert.match(page.text,/class="room-door room-kitchen" href="\/kitchen"/);
 assert.match(page.text,/class="room-door room-office" href="\/admin"/);
 assert.equal((await request(app).get('/kitchen')).headers.location,'/login');
});
test('menu sorting, category filtering and pagination are server-rendered',async()=>{
 const group=await catalog.category(null,{name:'Pagination test',slug:'pagination-test',isActive:'on'});
 for(let i=1;i<=5;i++)await catalog.dish(null,{categoryId:group.id,name:`Pagination dish ${i}`,slug:`pagination-dish-${i}`,priceMinor:String(i*10000),isPublished:'on',isAvailable:'on'});
 const first=await request(app).get('/menu?category=pagination-test&sort=price_desc');assert.equal(first.status,200);
 assert.ok(first.text.indexOf('View Pagination dish 5 details')<first.text.indexOf('View Pagination dish 4 details'));
 assert.doesNotMatch(first.text,/View Pagination dish 1 details/);assert.match(first.text,/data-dish-dialog=/);
 const second=await request(app).get('/menu?category=pagination-test&sort=price_desc&page=2');assert.match(second.text,/View Pagination dish 1 details/);assert.doesNotMatch(second.text,/View Pagination dish 5 details/);
 const search=await request(app).get('/menu?category=pagination-test&q=Pagination+dish+3');assert.match(search.text,/View Pagination dish 3 details/);assert.doesNotMatch(search.text,/View Pagination dish 4 details/);
 const invalid=await request(app).get('/menu?category=pagination-test&sort=sql&page=-1');assert.equal(invalid.status,200);assert.match(invalid.text,/PAGE 01/);
});
test('chef can manage dishes while categories and staff remain restricted',async()=>{
 const agent=await signIn(chef.email),page=await agent.get('/kitchen/dishes/new');assert.equal(page.status,200);
 const creation=await agent.post('/kitchen/dishes').type('form').send({_csrf:csrf(page.text),name:'Chef-created dish',slug:'chef-created-dish',categoryId:category.id,priceMinor:'80000',isAvailable:'on'});assert.equal(creation.status,303);
 const created=await db.dish.findUnique({where:{slug:'chef-created-dish'}});const board=await agent.get('/kitchen');assert.match(board.text,/dish-ticket/);assert.match(board.text,/Chef-created dish/);
 assert.equal((await agent.post(`/kitchen/dishes/${created.id}`).type('form').send({_csrf:csrf(board.text),_method:'DELETE'})).status,303);
 assert.ok((await db.dish.findUnique({where:{id:created.id}})).archivedAt);
 assert.equal((await agent.get('/admin/categories')).status,403);assert.equal((await agent.get('/admin/staff')).status,403);
});
test('removing chef access uses DELETE and preserves the account record',async()=>{
 const auth=createAuthService(createRepository(db));const temporary=await auth.createChef({displayName:'Temporary chef',email:'temporary@example.test',password});
 const agent=await signIn(admin.email),page=await agent.get('/admin/staff');
 assert.equal((await agent.get(`/admin/staff/${temporary.id}`)).status,404);
 const result=await agent.post(`/admin/staff/${temporary.id}`).type('form').send({_csrf:csrf(page.text),_method:'DELETE'});assert.equal(result.status,303);
 const account=await db.staffUser.findUnique({where:{id:temporary.id}});assert.ok(account);assert.equal(account.isActive,false);
});
test('a chef can remove the final ingredient and save an empty draft recipe',async()=>{
 const next=await catalog.dish(null,{categoryId:category.id,name:'Draft recipe test',slug:'draft-recipe-test',priceMinor:'1000'});
 const service=createRecipeService(db);const saved=await service.save(next.id,{version:0,instructions:'Draft',items:[{ingredientId:rice.id,quantity:'5'}]},chef.id);
 await service.save(next.id,{version:1,instructions:'Cleared draft',items:[]},chef.id);
 assert.equal(await db.recipeItem.count({where:{recipeId:saved.id}}),0);
 await assert.rejects(()=>stock.record({type:'usage',reason:'Empty recipe',requestKey:randomUUID(),recipeId:saved.id,recipeVersion:2,servings:1},chef),{status:422});
});

test('paper recipe saves retain PRG and failed edits preserve the entered sheet',async()=>{
 const next=await catalog.dish(null,{categoryId:category.id,name:'Paper dish',slug:'paper-dish',priceMinor:'80000'});
 const agent=await signIn(chef.email),page=await agent.get(`/kitchen/dishes/${next.id}/recipe`);
 assert.equal(page.status,200);assert.match(page.text,/data-paper-sheet/);assert.match(page.text,/on shelf/);
 const token=csrf(page.text),payload={_csrf:token,version:'0',instructions:'Handwritten preparation notes.',preparationMinutes:'3',ingredientId:rice.id,quantity:'4.25',itemNotes:'Rinse gently'};
 const denied=await agent.post(`/kitchen/dishes/${next.id}/recipe`).set('X-Requested-With','RecipePaper').type('form').send({...payload,_csrf:'invalid'});assert.equal(denied.status,403);
 const saved=await agent.post(`/kitchen/dishes/${next.id}/recipe`).set('X-Requested-With','RecipePaper').type('form').send(payload);assert.equal(saved.status,303);assert.equal(saved.headers.location,'/kitchen');
 const stale=await agent.post(`/kitchen/dishes/${next.id}/recipe`).set('X-Requested-With','RecipePaper').type('form').send({...payload,instructions:'Keep my unsaved writing',quantity:'8.5',itemNotes:'Keep this note'});
 assert.equal(stale.status,409);assert.match(stale.text,/Keep my unsaved writing/);assert.match(stale.text,/value="8.5"/);assert.match(stale.text,/Keep this note/);assert.match(stale.text,/name="version" value="0"/);
 const invalid=await agent.post(`/kitchen/dishes/${next.id}/recipe`).type('form').send({...payload,version:'1',quantity:'-2',instructions:'Do not lose these notes'});assert.equal(invalid.status,422);assert.match(invalid.text,/Do not lose these notes/);assert.match(invalid.text,/value="-2"/);
 const normal=await agent.post(`/kitchen/dishes/${next.id}/recipe`).type('form').send({...payload,version:'1'});assert.equal(normal.status,303);assert.equal(normal.headers.location,`/kitchen/dishes/${next.id}/recipe`);
});
test('paper dish editor redirects to the board and preserves invalid form input',async()=>{
 const agent=await signIn(chef.email),page=await agent.get('/kitchen/dishes/new'),token=csrf(page.text);
 assert.match(page.text,/data-paper-sheet/);
 const payload={_csrf:token,name:'Paper-created dish',slug:'paper-created-dish',categoryId:category.id,priceMinor:'95000'};
 const saved=await agent.post('/kitchen/dishes').set('X-Requested-With','RecipePaper').type('form').send(payload);assert.equal(saved.status,303);assert.equal(saved.headers.location,'/kitchen');
 const invalid=await agent.post('/kitchen/dishes').set('X-Requested-With','RecipePaper').type('form').send({...payload,name:'Still on my sheet',priceMinor:'bad'});assert.equal(invalid.status,422);assert.match(invalid.text,/value="Still on my sheet"/);
 assert.equal((await request(app).get('/kitchen/dishes/new')).headers.location,'/login');
});
test('pantry shelves and ingredient ledgers remain protected SSR pages',async()=>{
 const agent=await signIn(chef.email),shelf=await agent.get('/kitchen/ingredients');assert.equal(shelf.status,200);assert.match(shelf.text,/data-pantry-low/);assert.match(shelf.text,/Open Rice ingredient ledger/);
 const page=await agent.get(`/kitchen/ingredients/${rice.id}`);assert.equal(page.status,200);assert.match(page.text,/Opening rice/);assert.match(page.text,/Test Admin/);assert.match(page.text,/quantity|800|825/);assert.doesNotMatch(page.text,/passwordHash|password_hash/);
 const preselect=await agent.get(`/kitchen/stock/new?ingredientId=${oil.id}`);assert.match(preselect.text,new RegExp(`value="${oil.id}" selected`));
 assert.equal((await request(app).get(`/kitchen/ingredients/${rice.id}`)).headers.location,'/login');
 assert.equal((await agent.get('/kitchen/ingredients/not-a-uuid')).status,422);
 const archived=await catalog.ingredient(null,{name:'Archived ledger test',baseUnit:'g',lowStockThreshold:'0'});await catalog.archive('ingredient',archived.id);assert.equal((await agent.get(`/kitchen/ingredients/${archived.id}`)).status,404);
});

test('archived catalog records reject direct update submissions',async()=>{
 const agent=await signIn(admin.email),page=await agent.get('/admin'),token=csrf(page.text);
 const cases=[
  ['category','/admin/categories',await catalog.category(null,{name:'Audit archived category',slug:'audit-archived-category',isActive:'on'}),{name:'Changed category',slug:'audit-archived-category',isActive:'on'}],
  ['dish','/kitchen/dishes',await catalog.dish(null,{name:'Audit archived dish',slug:'audit-archived-dish',categoryId:category.id,priceMinor:'2000'}),{name:'Changed dish',slug:'audit-archived-dish',categoryId:category.id,priceMinor:'3000',isPublished:'on'}],
  ['ingredient','/kitchen/ingredients',await catalog.ingredient(null,{name:'Audit archived ingredient',baseUnit:'g',lowStockThreshold:'0'}),{name:'Changed ingredient',baseUnit:'g',lowStockThreshold:'10',isActive:'on'}],
 ];
 for(const [kind,base,row,body] of cases){
  await catalog.archive(kind,row.id);
  const result=await agent.post(`${base}/${row.id}/update`).type('form').send({...body,_csrf:token});assert.equal(result.status,404);
  const current=await db[kind].findUnique({where:{id:row.id}});assert.equal(current.name,row.name);assert.ok(current.archivedAt);
 }
});
test('positive corrections accept a leading plus and remain idempotent PRG operations',async()=>{
 const item=await catalog.ingredient(null,{name:'Audit correction ingredient',baseUnit:'g',lowStockThreshold:'0',isActive:'on'});
 const agent=await signIn(admin.email),page=await agent.get(`/kitchen/stock/new?ingredientId=${item.id}`),input={_csrf:csrf(page.text),ingredientId:item.id,quantity:'+12.125',reason:'Verified correction',requestKey:randomUUID()};
 const result=await agent.post('/kitchen/stock/corrections').type('form').send(input);assert.equal(result.status,303);assert.equal(result.headers.location,'/kitchen/stock-history');
 assert.equal((await agent.post('/kitchen/stock/corrections').type('form').send(input)).status,303);
 assert.equal((await db.ingredient.findUnique({where:{id:item.id}})).quantityOnHand.toString(),'12.125');assert.equal(await db.stockOperation.count({where:{requestKey:input.requestKey}}),1);
});
test('failed recipe usage preserves servings, reason and submission key on its SSR form',async()=>{
 const next=await catalog.dish(null,{name:'Audit usage dish',slug:'audit-usage-dish',categoryId:category.id,priceMinor:'1000'});
 const item=await catalog.ingredient(null,{name:'Audit no-stock ingredient',baseUnit:'piece',lowStockThreshold:'0',isActive:'on'});
 await createRecipeService(db).save(next.id,{version:0,instructions:'Use one piece.',items:[{ingredientId:item.id,quantity:'1'}]},chef.id);
 const agent=await signIn(chef.email),page=await agent.get(`/kitchen/dishes/${next.id}/recipe`),key=randomUUID(),before=await db.stockOperation.count();
 const result=await agent.post(`/kitchen/dishes/${next.id}/usage`).type('form').send({_csrf:csrf(page.text),requestKey:key,recipeVersion:'1',servings:'3',reason:'Keep this preparation reason'});
 assert.equal(result.status,409);assert.match(result.text,/name="servings"[^>]*value="3"/);assert.match(result.text,/Keep this preparation reason/);assert.match(result.text,new RegExp(`name="requestKey" value="${key}"`));assert.match(result.text,/Use one piece/);assert.equal(await db.stockOperation.count(),before);
});
test('duplicate chef creation keeps safe fields and never echoes the password',async()=>{
 const agent=await signIn(admin.email),page=await agent.get('/admin/staff');
 const result=await agent.post('/admin/staff').type('form').send({_csrf:csrf(page.text),displayName:'Keep this chef name',email:chef.email,password});
 assert.equal(result.status,409);assert.match(result.text,/value="Keep this chef name"/);assert.match(result.text,new RegExp(`value="${chef.email}"`));assert.doesNotMatch(result.text,new RegExp(password));assert.match(result.text,/Create chef account/);
});
test('all staff restrictions and method override sources are enforced with valid CSRF',async()=>{
 const chefAgent=await signIn(chef.email),chefPage=await chefAgent.get('/kitchen'),chefToken=csrf(chefPage.text);
 for(const [method,path,body] of [
  ['get','/kitchen/ingredients/new',null],['get',`/kitchen/ingredients/${rice.id}/edit`,null],
  ['post','/kitchen/ingredients',{name:'Denied ingredient',baseUnit:'g',lowStockThreshold:'0'}],
  ['post',`/kitchen/ingredients/${rice.id}/update`,{name:'Denied update'}],
  ['delete',`/kitchen/ingredients/${rice.id}`,{}],['post','/admin/staff',{role:'admin'}],
  ['post',`/admin/staff/${admin.id}/update`,{role:'admin'}],['delete',`/admin/staff/${chef.id}`,{}],
  ['post','/kitchen/stock/corrections',{ingredientId:rice.id,quantity:'1',reason:'Denied correction',requestKey:randomUUID()}],
 ]){let req=chefAgent[method](path);if(body)req=req.type('form').send({...body,_csrf:chefToken});assert.equal((await req).status,403,`${method} ${path}`);}
 const agent=await signIn(admin.email),page=await agent.get('/admin/categories'),token=csrf(page.text),row=await catalog.category(null,{name:'Audit override source',slug:'audit-override-source',isActive:'on'});
 for(const requestMethod of ['get','head'])assert.equal((await agent[requestMethod](`/admin/categories/${row.id}?_method=DELETE`).set('X-HTTP-Method-Override','DELETE')).status,404);
 for(const [path,header] of [[`/admin/categories/${row.id}?_method=DELETE`,false],[`/admin/categories/${row.id}`,true]]){let req=agent.post(path);if(header)req=req.set('X-HTTP-Method-Override','DELETE');assert.equal((await req.type('form').send({_csrf:token})).status,404);}
 assert.equal((await db.category.findUnique({where:{id:row.id}})).archivedAt,null);
 const outsider=request.agent(app),publicPage=await outsider.get('/login');assert.equal((await outsider.delete(`/admin/categories/${row.id}`).type('form').send({_csrf:csrf(publicPage.text)})).status,401);
 assert.equal((await agent.delete(`/admin/categories/${row.id}`).type('form').send({_csrf:'invalid'})).status,403);
 const result=await agent.post(`/admin/categories/${row.id}`).type('form').send({_csrf:token,_method:'DELETE'});assert.equal(result.status,303);assert.ok((await db.category.findUnique({where:{id:row.id}})).archivedAt);
});
test('public SSR output escapes content, carries branding and protects inactive categories',async()=>{
 const group=await catalog.category(null,{name:'Audit HTML',slug:'audit-html',isActive:'on'}),name='<script>alert("audit")</script>';
 const next=await catalog.dish(null,{name,slug:'audit-escaped-dish',categoryId:group.id,priceMinor:'99000',isPublished:'on',isAvailable:'on',description:'<img src=x onerror=alert(1)>'});
 const page=await request(app).get('/menu?category=audit-html');assert.equal(page.status,200);assert.match(page.text,/&lt;script&gt;/);assert.doesNotMatch(page.text,/<script>alert|<img src=x/);assert.match(page.text,/Santaishi-tei/);assert.match(page.text,/三太子亭/);assert.match(page.text,/data-menu-shell/);assert.equal(page.headers['cache-control'],'no-store');
 await db.category.update({where:{id:group.id},data:{isActive:false}});assert.equal((await request(app).get(`/menu/${next.slug}`)).status,404);assert.doesNotMatch((await request(app).get('/menu?category=audit-html')).text,/View &lt;script/);
});

test('recipe forms retain saved ingredients beyond the pantry list limit',async()=>{
 await db.ingredient.createMany({data:Array.from({length:105},(_,i)=>({name:`Audit pantry ${String(i).padStart(3,'0')}`,baseUnit:'g'}))});
 const outside=await catalog.ingredient(null,{name:'ZZZ saved recipe ingredient',baseUnit:'g',lowStockThreshold:'0',isActive:'on'}),next=await catalog.dish(null,{name:'Audit large pantry dish',slug:'audit-large-pantry-dish',categoryId:category.id,priceMinor:'1000'});
 await createRecipeService(db).save(next.id,{version:0,instructions:'Retain this ingredient.',items:[{ingredientId:outside.id,quantity:'7.125'}]},chef.id);
 const agent=await signIn(chef.email),page=await agent.get(`/kitchen/dishes/${next.id}/recipe`);assert.equal(page.status,200);assert.match(page.text,/ZZZ saved recipe ingredient/);assert.match(page.text,/value="7.125"/);
 const rows=[...page.text.matchAll(/<tr data-recipe-row[\s\S]*?<\/tr>/g)].map(([row])=>({id:row.match(/name="ingredientId" value="([^"]+)"/)[1],quantity:row.match(/name="quantity"[^>]*value="([^"]*)"/)[1]}));
 assert.ok(rows.length>100);
 const result=await agent.post(`/kitchen/dishes/${next.id}/recipe`).type('form').send({_csrf:csrf(page.text),version:'1',instructions:'Saved without losing the ingredient.',ingredientId:rows.map(r=>r.id),quantity:rows.map(r=>r.quantity),itemNotes:rows.map(()=> '')});assert.equal(result.status,303);
 const current=await db.recipeItem.findMany({where:{recipe:{dishId:next.id}}});assert.equal(current.length,1);assert.equal(current[0].ingredientId,outside.id);assert.equal(current[0].quantity.toString(),'7.125');
});

test('admin chef CRUD retains PRG and ignores attempts to grant admin through form fields',async()=>{
 const agent=await signIn(admin.email),page=await agent.get('/admin/staff'),email='audit-created-chef@example.test';
 const created=await agent.post('/admin/staff').type('form').send({_csrf:csrf(page.text),displayName:'Audit created chef',email,password,role:'admin'});assert.equal(created.status,303);assert.equal(created.headers.location,'/admin/staff');
 await agent.get(created.headers.location);await agent.get(created.headers.location);assert.equal(await db.staffUser.count({where:{email}}),1);
 const user=await db.staffUser.findUnique({where:{email}});assert.equal(user.role,'chef');
 const editPage=await agent.get('/admin/staff'),updated=await agent.post(`/admin/staff/${user.id}/update`).type('form').send({_csrf:csrf(editPage.text),displayName:'Renamed audit chef',isActive:'on',role:'admin'});assert.equal(updated.status,303);assert.equal((await db.staffUser.findUnique({where:{id:user.id}})).role,'chef');
 assert.equal((await agent.post(`/admin/staff/${admin.id}/update`).type('form').send({_csrf:csrf(editPage.text),displayName:'Forbidden admin edit'})).status,403);
 assert.equal((await agent.delete(`/admin/staff/${admin.id}`).type('form').send({_csrf:csrf(editPage.text)})).status,403);
 const removed=await agent.post(`/admin/staff/${user.id}`).type('form').send({_csrf:csrf(editPage.text),_method:'DELETE'});assert.equal(removed.status,303);assert.equal((await db.staffUser.findUnique({where:{id:user.id}})).isActive,false);
});
test('recipe validation renders excluded ingredients with the correct Add state',async()=>{
 const next=await catalog.dish(null,{name:'Audit recipe form state',slug:'audit-recipe-form-state',categoryId:category.id,priceMinor:'1000'}),agent=await signIn(chef.email),page=await agent.get(`/kitchen/dishes/${next.id}/recipe`);
 const result=await agent.post(`/kitchen/dishes/${next.id}/recipe`).type('form').send({_csrf:csrf(page.text),version:'0',instructions:'Keep the form state.',ingredientId:rice.id,quantity:'-1',itemNotes:'Keep this note'});assert.equal(result.status,422);
 assert.match(result.text,/aria-pressed="false"[^>]*aria-label="Toggle Rice in recipe">Add/);assert.match(result.text,/Keep this note/);
});

test('failed logins are rate limited while successful sessions do not exhaust the limit',async()=>{
 const agent=request.agent(app),page=await agent.get('/login'),token=csrf(page.text);
 for(let i=0;i<10;i++)assert.equal((await agent.post('/login').type('form').send({_csrf:token,email:admin.email,password:'incorrect-password'})).status,422);
 assert.equal((await agent.post('/login').type('form').send({_csrf:token,email:admin.email,password:'incorrect-password'})).status,429);
});
