import express from 'express';
import session from 'express-session';
import methodOverride from 'method-override';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRepository } from './models/repository.js';
import { createAuthService } from './services/auth-service.js';
import { createCatalogService } from './services/catalog-service.js';
import { createRecipeService } from './services/recipe-service.js';
import { createStockService } from './services/stock-service.js';
import { createAuthController } from './controllers/auth-controller.js';
import { createPublicController } from './controllers/public-controller.js';
import { createCatalogController } from './controllers/catalog-controller.js';
import { createKitchenController } from './controllers/kitchen-controller.js';
import { csrf,loadUser } from './middleware/security.js';
import { createRoutes } from './routes/index.js';
import { AppError,publicError } from './lib/errors.js';
export function createApp({db,store,config}) {
 const app=express(),repo=createRepository(db);
 app.disable('x-powered-by');
 app.use((req,res,next)=>{Object.assign(res.locals,{user:null,csrf:'',flash:null,path:req.path,pageClass:'page-auth'});next();});
 if(config.NODE_ENV==='production')app.set('trust proxy',1);
 app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':config.NODE_ENV==='production'?[]:null}},strictTransportSecurity:config.NODE_ENV==='production'?undefined:false}));
 app.set('view engine','ejs');app.set('views',fileURLToPath(new URL('./views/',import.meta.url)));
 app.use(express.static(fileURLToPath(new URL('../public/',import.meta.url))));
 app.use(express.urlencoded({extended:false,limit:'64kb',parameterLimit:1000}));
 // Only POST form bodies may override to DELETE; GET/query/header overrides are ignored.
 app.use(methodOverride(req=>{
  if(req.body?._method==='DELETE'){delete req.body._method;return 'DELETE';}
 },{methods:['POST']}));
 app.use(session({name:'restaurant.sid',secret:config.SESSION_SECRET,store,genid:randomUUID,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:config.NODE_ENV==='production',maxAge:8*60*60*1000}}));
 app.use((req,res,next)=>{res.set('Cache-Control','no-store');res.locals.path=req.path;res.locals.pageClass=req.path==='/'?'page-entrance':req.path==='/directory'?'page-directory':req.path.startsWith('/menu')?'page-dining':req.path.startsWith('/kitchen')?'page-kitchen':req.path.startsWith('/admin')?'page-office':'page-auth';res.locals.money=value=>new Intl.NumberFormat('vi-VN').format(BigInt(value))+' ₫';res.locals.foodIndex=d=>/nigiri|sushi/i.test(d.slug)?0:/tempura/i.test(d.slug)?1:/ramen|miso/i.test(d.slug)?2:/teriyaki|grilled-salmon/i.test(d.slug)?4:/mochi|matcha/i.test(d.slug)?5:3;res.locals.user=null;res.locals.csrf='';res.locals.flash=req.session.flash;delete req.session.flash;next();});
 app.use(loadUser(repo));app.use(csrf);
 const auth=createAuthService(repo);
 // Bootstrap is development-only, loopback-only, and permanently closes after the first admin.
 const setupAllowed=async(req,res,next)=>{
  if(config.NODE_ENV!=='development' || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip) || await db.staffUser.count({where:{role:'admin'}}))return next(new AppError(404,'Page not found.'));
  next();
 };
 app.get('/setup',setupAllowed,(req,res)=>res.render('auth/setup',{title:'Create initial admin'}));
 app.post('/setup',setupAllowed,async(req,res)=>{await auth.createInitialAdmin(req.body);req.session.flash='Admin created. Sign in to continue.';res.redirect(303,'/login');});
 app.use(createRoutes({auth:createAuthController(auth,repo),public:createPublicController(repo),catalog:createCatalogController(repo,createCatalogService(repo)),kitchen:createKitchenController(repo,createRecipeService(db),createStockService(db))}));
 app.use((req,res,next)=>next(new AppError(404,'Page not found.')));
 app.use((error,req,res,next)=>{
  if(res.headersSent)return next(error);
  const safe=publicError(error);
  if(req.path==='/login' && req.method==='POST')return res.status(safe.status).render('auth/login',{title:'Staff login',error:safe.message});
  res.status(safe.status).render('error',{title:`Error ${safe.status}`,error:safe.message,status:safe.status});
 });
 return app;
}
