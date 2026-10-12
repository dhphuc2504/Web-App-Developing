import { AppError } from '../lib/errors.js';
export function createPublicController(repo) {
 return {
  home: (req,res)=>res.render('public/home',{title:'Welcome'}),
  directory: (req,res)=>res.render('public/directory',{title:'Choose your room'}),
  menu: async(req,res)=>{
   const sort=['recommended','name','price_asc','price_desc'].includes(req.query.sort)?req.query.sort:'recommended';
   const category=typeof req.query.category==='string'?req.query.category.slice(0,120):'';
   const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,100):'';
   const total=await repo.menu.count({category,q}),pageCount=Math.max(1,Math.ceil(total/4));
   const requested=typeof req.query.page==='string' && /^\d{1,6}$/.test(req.query.page)?Number(req.query.page):1;
   const page=Math.max(1,Math.min(requested,pageCount));
   const dishes=await repo.menu.list({category,q,sort,take:4,skip:(page-1)*4});
   const categories=(await repo.categories()).filter(c=>c.isActive);
   const menuUrl=changes=>{const params=new URLSearchParams({sort,...(category?{category}:{}),...(q?{q}:{}),page:String(page),...changes});return `/menu?${params.toString()}`;};
   res.render('public/menu',{title:'The dining room',dishes,total,page,pageCount,sort,category,q,categories,menuUrl});
  },
  dish: async(req,res)=>{const dish=await repo.menu.detail(req.params.slug);if(!dish)throw new AppError(404,'Dish not found.');res.render('public/dish',{title:dish.name,dish});},
 };
}
