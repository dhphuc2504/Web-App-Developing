import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { z } from 'zod';
import { staffInput, uuid } from '../validators/input.js';
import { AppError } from '../lib/errors.js';
const emailInput=z.string().trim().toLowerCase().email().max(254);
const passwordInput=z.object({password:z.string().min(12).max(256),confirmPassword:z.string()}).refine(x=>x.password===x.confirmPassword,{message:'Passwords must match.',path:['confirmPassword']});
const digest=token=>createHash('sha256').update(token).digest('hex');
export function createAccountService(db,delivery) {
 async function issue(user,purpose) {
  // Serialize issuance per account, including resend cooldown, without holding a transaction during SMTP.
  const token=randomBytes(32).toString('hex');
  const row=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM restaurant.staff_users WHERE id=${user.id}::uuid FOR UPDATE`;
   const recent=await tx.authToken.findFirst({where:{userId:user.id,purpose,createdAt:{gt:new Date(Date.now()-60000)}}});
   if(recent)return null;
   return tx.authToken.create({data:{userId:user.id,purpose,tokenHash:digest(token),expiresAt:new Date(Date.now()+(purpose==='verify'?86400000:1800000))}});
  });
  if(!row)return;
  try {await delivery.send({email:user.email,purpose,token});}
  catch(error){await db.authToken.deleteMany({where:{id:row.id}});throw error;}
 }
 async function consume(token,purpose,change) {
  if(typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token))throw new AppError(422,'This link is invalid or expired. Request a new one.');
  return db.$transaction(async tx=>{
   const row=await tx.authToken.findUnique({where:{tokenHash:digest(token)}});
   if(!row || row.purpose!==purpose)throw new AppError(422,'This link is invalid or expired. Request a new one.');
   await tx.$queryRaw`SELECT id FROM restaurant.staff_users WHERE id=${row.userId}::uuid FOR UPDATE`;
   const claimed=await tx.authToken.updateMany({where:{id:row.id,purpose,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});
   if(!claimed.count)throw new AppError(422,'This link is invalid or expired. Request a new one.');
   const result=await change(tx,row.userId);
   await tx.authToken.updateMany({where:{userId:row.userId,purpose,usedAt:null},data:{usedAt:new Date()}});
   return result;
  });
 }
 return {
  async register(body) {
   const input=staffInput.parse(body);passwordInput.parse(body);
   await delivery.captcha(body['g-recaptcha-response']);
   if(await db.staffUser.findUnique({where:{email:input.email}}))return;
   let user;
   try {user=await db.staffUser.create({data:{email:input.email,displayName:input.displayName,passwordHash:await argon2.hash(input.password,{type:argon2.argon2id}),role:'chef',approvalStatus:'pending',emailVerifiedAt:null}});}
   catch(e){if(e.code==='P2002')return;throw e;}
   await issue(user,'verify');
  },
  async request(body,purpose) {
   const email=emailInput.parse(body.email),user=await db.staffUser.findUnique({where:{email}});
   if(!user || (purpose==='verify' && user.emailVerifiedAt))return;
   // Keep account existence private, including when SMTP fails. The user can retry after the cooldown.
   try {await issue(user,purpose);}catch(e){if(!(e instanceof AppError) || e.status!==503)throw e;}
  },
  verify:token=>consume(token,'verify',(tx,id)=>tx.staffUser.update({where:{id},data:{emailVerifiedAt:new Date()},select:{approvalStatus:true,isActive:true}})),
  async reset(body) {
   const input=passwordInput.parse(body),passwordHash=await argon2.hash(input.password,{type:argon2.argon2id});
   return consume(body.token,'reset',async(tx,id)=>{
    await tx.staffUser.update({where:{id},data:{passwordHash,sessionVersion:{increment:1}}});
    await tx.$executeRaw`DELETE FROM restaurant.sessions WHERE data::jsonb->>'userId'=${id}`;
   });
  },
  async decide(id,decision) {
   uuid.parse(id);if(!['approved','rejected'].includes(decision))throw new AppError(422,'Choose approve or reject.');
   const result=await db.staffUser.updateMany({where:{id,role:'chef'},data:{approvalStatus:decision,sessionVersion:{increment:1}}});
   if(!result.count)throw new AppError(404,'Chef account not found.');
  }
 };
}
