import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../lib/errors.js';
export function csrf(req,res,next) {
  req.session.csrf ||= randomBytes(32).toString('hex');
  res.locals.csrf=req.session.csrf;
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const provided=req.body?._csrf;
    if (typeof provided!=='string' || !/^[a-f0-9]{64}$/.test(provided) || !timingSafeEqual(Buffer.from(provided),Buffer.from(req.session.csrf))) return next(new AppError(403,'Invalid form token. Reload the page and try again.'));
  }
  next();
}
export function loadUser(repo) {
  return async (req,res,next)=>{
    req.user=null;
    if (req.session.userId) {
      const user=await repo.staff.byId(req.session.userId);
      if (user?.isActive) req.user={id:user.id,displayName:user.displayName,role:user.role};
      else delete req.session.userId;
    }
    res.locals.user=req.user;
    next();
  };
}
export function allow(...roles) {
  return (req,res,next)=>{
    if (!req.user) return req.method==='GET' ? res.redirect(303,'/login') : next(new AppError(401,'Please sign in again.'));
    if (!roles.includes(req.user.role)) return next(new AppError(403,'You do not have permission for this action.'));
    next();
  };
}
