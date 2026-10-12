import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { allow } from '../middleware/security.js';
export function createRoutes(c) {
 const r=Router(),admin=allow('admin'),kitchen=allow('admin','chef');
 r.get('/',c.public.home);r.get('/directory',c.public.directory);r.get('/menu',c.public.menu);r.get('/menu/:slug',c.public.dish);
 r.get('/login',c.auth.loginForm);
 r.post('/login',rateLimit({windowMs:15*60*1000,limit:10,skipSuccessfulRequests:true,standardHeaders:'draft-8',legacyHeaders:false}),c.auth.login);
 r.post('/logout',kitchen,c.auth.logout);
 r.get('/admin',admin,c.auth.office);
 r.get('/admin/staff',admin,c.auth.staff);r.post('/admin/staff',admin,c.auth.createStaff);r.post('/admin/staff/:id/update',admin,c.auth.updateStaff);r.delete('/admin/staff/:id',admin,c.auth.removeStaff);
 for(const kind of ['category','dish','ingredient']){
  const base=c.catalog.specs[kind].path;
  const access=kind==='dish'?kitchen:admin;
  r.get(base,kind==='category'?admin:kitchen,c.catalog.list(kind));
  r.get(`${base}/new`,access,c.catalog.form(kind));
  r.post(base,access,c.catalog.save(kind));
  r.get(`${base}/:id/edit`,access,c.catalog.form(kind));
  r.post(`${base}/:id/update`,access,c.catalog.save(kind));
  r.delete(`${base}/:id`,access,c.catalog.archive(kind));
 }
 r.get('/admin/dishes',admin,(req,res)=>res.redirect(303,'/kitchen/dishes'));
 r.get('/kitchen',kitchen,c.kitchen.dashboard);
 r.get('/kitchen/ingredients/:id',kitchen,c.kitchen.ingredient);
 r.get('/kitchen/dishes/:id/recipe',kitchen,c.kitchen.recipe);r.post('/kitchen/dishes/:id/recipe',kitchen,c.kitchen.saveRecipe);r.post('/kitchen/dishes/:id/usage',kitchen,c.kitchen.recipeUsage);
 r.get('/kitchen/stock-history',kitchen,c.kitchen.history);r.get('/kitchen/stock/new',kitchen,c.kitchen.stockForm);
 for(const [route,type] of [['receipts','receipt'],['usage','usage'],['waste','waste'],['corrections','correction']])r.post(`/kitchen/stock/${route}`,['receipt','correction'].includes(type)?admin:kitchen,c.kitchen.stock(type));
 return r;
}
