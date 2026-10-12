import { promisify } from 'node:util';
import { AppError,publicError } from '../lib/errors.js';
import { uuid } from '../validators/input.js';
export function createAuthController(auth,repo) {
  return {
    loginForm: (req,res)=>res.render('auth/login',{title:'Staff login',error:null}),
    async login(req,res) {
      const user=await auth.login(req.body);
      await promisify(req.session.regenerate).call(req.session);
      req.session.userId=user.id;
      await promisify(req.session.save).call(req.session);
      res.redirect(303,user.role==='admin'?'/admin':'/kitchen');
    },
    async logout(req,res) { await promisify(req.session.destroy).call(req.session); res.clearCookie('restaurant.sid'); res.redirect(303,'/'); },
    async office(req,res) { res.render('admin/dashboard',{title:'The administrator’s room',rows:await repo.staff.list()}); },
    async removeStaff(req,res) {
      uuid.parse(req.params.id);const user=await repo.staff.byId(req.params.id);
      if(!user || user.role!=='chef')throw new AppError(403,'Only chef access can be removed here.');
      await repo.db.staffUser.update({where:{id:user.id},data:{isActive:false}});
      req.session.flash='Chef access removed. Historical records are preserved.';res.redirect(303,'/admin/staff');
    },
    async staff(req,res) { res.render('admin/staff',{title:'Chef accounts',rows:await repo.staff.list(),error:null,input:{}}); },
    async createStaff(req,res) {
      try {await auth.createChef(req.body);req.session.flash='Chef account created.';res.redirect(303,'/admin/staff');}
      catch(error){const safe=publicError(error);if(![409,422].includes(safe.status))throw error;
        res.status(safe.status).render('admin/staff',{title:'Chef accounts',rows:await repo.staff.list(),error:safe.message,input:{displayName:typeof req.body.displayName==='string'?req.body.displayName:'',email:typeof req.body.email==='string'?req.body.email:''}});
      }
    },
    async updateStaff(req,res) {
      uuid.parse(req.params.id);
      const user=await repo.staff.byId(req.params.id);
      if (!user || user.role!=='chef') throw new AppError(403,'Only chef accounts can be changed here.');
      const displayName=String(req.body.displayName || '').trim();
      if (!displayName || displayName.length>100) throw new AppError(422,'Enter a name of up to 100 characters.');
      await repo.db.staffUser.update({where:{id:user.id},data:{displayName,isActive:req.body.isActive==='on'}});
      req.session.flash='Chef account updated.'; res.redirect(303,'/admin/staff');
    },
  };
}
