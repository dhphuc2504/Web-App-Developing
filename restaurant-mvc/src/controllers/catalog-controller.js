import { AppError,publicError } from '../lib/errors.js';
import { uuid } from '../validators/input.js';
export const fields={
 category:[['name','Name','text'],['slug','Slug','text'],['description','Description','textarea'],['displayOrder','Display order','number'],['isActive','Active','checkbox']],
 dish:[['name','Name','text'],['slug','Slug','text'],['categoryId','Category','select'],['description','Description','textarea'],['priceMinor','Price (VND)','number'],['imagePath','Local image path (/images/...)','text'],['imageAlt','Image description','text'],['displayOrder','Display order','number'],['isFeatured','Featured','checkbox'],['isPublished','Published','checkbox'],['isAvailable','Available','checkbox']],
 ingredient:[['name','Name','text'],['description','Description','textarea'],['baseUnit','Base unit','select'],['lowStockThreshold','Low-stock threshold','number'],['isActive','Active','checkbox']],
};
export function createCatalogController(repo,service) {
 const specs={category:{path:'/admin/categories',model:'category',list:repo.categories},dish:{path:'/kitchen/dishes',model:'dish',list:repo.dishes},ingredient:{path:'/kitchen/ingredients',model:'ingredient',list:repo.ingredients}};
 return {
  specs,
  list: kind => async(req,res)=>res.render('admin/catalog',{title:kind==='ingredient'?'Ingredients':kind==='dish'?'Dishes':'Categories',kind,rows:await specs[kind].list(),base:specs[kind].path}),
  form: kind => async(req,res)=>{
   const spec=specs[kind];let values={displayOrder:0,isActive:true,isAvailable:true,baseUnit:'g',lowStockThreshold:'0'};
   if(req.params.id){uuid.parse(req.params.id);values=await repo.db[spec.model].findUnique({where:{id:req.params.id}});if(!values || values.archivedAt)throw new AppError(404,'Record not found.');}
   const options=kind==='dish'?(await repo.categories()).filter(c=>c.isActive).map(c=>[c.id,c.name]):[['g','Grams'],['ml','Millilitres'],['piece','Pieces']];
   res.render('admin/form',{title:`${req.params.id?'Edit':'New'} ${kind}`,fields:fields[kind],values,options,action:req.params.id?`${spec.path}/${req.params.id}/update`:spec.path,error:null});
  },
  save: kind => async(req,res)=>{
   try {await service[kind](req.params.id || null,req.body);req.session.flash='Saved successfully.';res.redirect(303,kind==='dish' && req.get('X-Requested-With')==='RecipePaper'?'/kitchen':specs[kind].path);}
   catch(error){const safe=publicError(error);if(![409,422].includes(safe.status))throw error;
    const options=kind==='dish'?(await repo.categories()).filter(c=>c.isActive).map(c=>[c.id,c.name]):[['g','Grams'],['ml','Millilitres'],['piece','Pieces']];
    res.status(safe.status).render('admin/form',{title:`${req.params.id?'Edit':'New'} ${kind}`,fields:fields[kind],values:req.body,options,action:req.params.id?`${specs[kind].path}/${req.params.id}/update`:specs[kind].path,error:safe.message});
   }
  },
  archive: kind => async(req,res)=>{await service.archive(kind,req.params.id);req.session.flash='Archived successfully.';res.redirect(303,specs[kind].path);},
 };
}
