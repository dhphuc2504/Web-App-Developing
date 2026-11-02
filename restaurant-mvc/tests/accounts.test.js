import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { testDatabase } from './database.js';
import { createApp } from '../src/app.js';
import { createAccountService } from '../src/services/account-service.js';
import { createAuthService } from '../src/services/auth-service.js';
import { createRepository } from '../src/models/repository.js';
import { PrismaSessionStore } from '../src/models/session-store.js';
import { AppError } from '../src/lib/errors.js';
let fixture,db,app,service,admin;const mail=[];
const password='Test-only-passphrase-2026';
const csrf=html=>html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
const delivery={captcha:async token=>{if(token!=='test-valid')throw new AppError(422,'Invalid CAPTCHA');},send:async message=>{mail.push(message);}};
const config={NODE_ENV:'test',SESSION_SECRET:'x'.repeat(64),RECAPTCHA_SITE_KEY:'test-site-key'};
before(async()=>{fixture=await testDatabase();db=fixture.db;service=createAccountService(db,delivery);admin=await createAuthService(createRepository(db)).createInitialAdmin({email:'admin@example.test',displayName:'Admin',password});app=createApp({db,store:new PrismaSessionStore(db),config,accountDelivery:delivery});});
after(async()=>{await fixture?.close();});
async function post(agent,path,body,form='/login'){const page=await agent.get(form);return agent.post(path).type('form').send({_csrf:csrf(page.text),...body});}
async function login(email,remember=''){const agent=request.agent(app);const result=await post(agent,'/login',{email,password,remember});assert.equal(result.status,303);return {agent,result};}
async function register(email){const agent=request.agent(app);const response=await post(agent,'/signup',{email,displayName:'New Chef',password,confirmPassword:password,'g-recaptcha-response':'test-valid',role:'admin',approvalStatus:'approved',emailVerifiedAt:'2026-01-01'},'/signup');assert.equal(response.status,303);assert.equal(response.headers.location,'/check-email');
 const page=await agent.get('/check-email');assert.equal(page.status,200);assert.match(page.text,/Check your email/);assert.match(page.text,/data-remaining="[1-6][0-9]?" disabled/);
 const before=mail.length;const retry=await agent.post('/resend-verification').type('form').send({_csrf:csrf(page.text),email});assert.equal(retry.headers.location,'/check-email');assert.equal(mail.length,before);
 return db.staffUser.findUnique({where:{email}});}
test('registration requires CAPTCHA and CSRF; creates only an unverified pending chef',async()=>{
 const agent=request.agent(app);
 assert.equal((await agent.post('/signup').type('form').send({})).status,403);
 assert.equal((await post(agent,'/signup',{email:'bad@example.test',displayName:'Bad',password,confirmPassword:password},'/signup')).status,422);
 assert.equal(await db.staffUser.count({where:{email:'bad@example.test'}}),0);
 const chef=await register('chef@example.test');assert.equal(chef.role,'chef');assert.equal(chef.approvalStatus,'pending');assert.equal(chef.emailVerifiedAt,null);assert.notEqual(chef.passwordHash,password);
 const token=await db.authToken.findFirst({where:{userId:chef.id}});assert.notEqual(token.tokenHash,mail.at(-1).token);
 const blocked=await post(agent,'/login',{email:chef.email,password});assert.equal(blocked.status,403);assert.match(blocked.text,/href="\/resend-verification"/);
 const wrong=await post(agent,'/login',{email:chef.email,password:'incorrect'});assert.doesNotMatch(wrong.text,/href="\/resend-verification"/);
});
test('verification GET is read-only; POST consumes once; approval is admin-only',async()=>{
 const token=mail.find(x=>x.email==='chef@example.test').token,agent=request.agent(app);
 await agent.get('/verify-email?token='+token);
 let chef=await db.staffUser.findUnique({where:{email:'chef@example.test'}});assert.equal(chef.emailVerifiedAt,null);
 const verified=await post(agent,'/verify-email',{token},'/verify-email?token='+token);assert.equal(verified.status,303);assert.equal(verified.headers.location,'/verification-complete');
 const complete=await agent.get('/verification-complete');assert.match(complete.text,/Waiting for admin approval/);assert.doesNotMatch(complete.text,/href="\/resend-verification"/);
 assert.equal((await post(agent,'/verify-email',{token})).status,422);
 const pending=await post(agent,'/login',{email:chef.email,password});assert.equal(pending.status,403);assert.match(pending.text,/Waiting for admin approval/);assert.doesNotMatch(pending.text,/href="\/resend-verification"/);
 assert.equal((await post(agent,`/admin/staff/${chef.id}/approval`,{decision:'approved'})).status,401);
 const {agent:boss}=await login(admin.email);
 assert.equal((await post(boss,`/admin/staff/${chef.id}/approval`,{decision:'approved'},'/admin/staff')).status,303);
 const signed=await login(chef.email,'on');assert.match(signed.result.headers['set-cookie'][0],/HttpOnly/);assert.match(signed.result.headers['set-cookie'][0],/SameSite=Lax/);
 const cookie=signed.result.headers['set-cookie'][0];const expiry=new Date(cookie.match(/Expires=([^;]+)/)[1]);assert.ok(expiry-Date.now()>29*86400000);
 assert.equal((await signed.agent.get('/kitchen')).status,200);assert.equal((await signed.agent.get('/admin')).status,403);
 assert.equal((await post(signed.agent,`/admin/staff/${chef.id}/approval`,{decision:'approved'})).status,403);
});
test('database session survives a new application instance and rejection blocks existing sessions',async()=>{
 const {agent,result}=await login('chef@example.test');
 const restarted=createApp({db,store:new PrismaSessionStore(db),config,accountDelivery:delivery});
 assert.equal((await request(restarted).get('/kitchen').set('Cookie',result.headers['set-cookie'][0].split(';')[0])).status,200);
 const chef=await db.staffUser.findUnique({where:{email:'chef@example.test'}});
 await service.decide(chef.id,'rejected');assert.equal((await agent.get('/kitchen')).headers.location,'/login');
 assert.equal((await post(request.agent(app),'/login',{email:chef.email,password})).status,403);
 await service.decide(chef.id,'approved');
});
test('forgot-password replies are generic; reset token expires, is single-use and revokes all sessions',async()=>{
 const first=await login('chef@example.test'),second=await login('chef@example.test');
 const agent=request.agent(app);
 const unknown=await post(agent,'/forgot-password',{email:'missing@example.test'},'/forgot-password');const unknownPage=await agent.get(unknown.headers.location);
 const known=await post(agent,'/forgot-password',{email:'chef@example.test'},'/forgot-password');const knownPage=await agent.get(known.headers.location);
 assert.equal(unknown.status,303);assert.equal(known.status,303);assert.match(unknownPage.text,/If the account exists/);assert.match(knownPage.text,/If the account exists/);
 const token=mail.at(-1).token;const newer='New-test-passphrase-2026';
 assert.equal((await post(agent,'/reset-password',{token,password:newer,confirmPassword:'different'},'/reset-password?token='+token)).status,422);
 assert.equal((await post(agent,'/reset-password',{token,password:newer,confirmPassword:newer},'/reset-password?token='+token)).status,303);
 assert.equal((await first.agent.get('/kitchen')).headers.location,'/login');assert.equal((await second.agent.get('/kitchen')).headers.location,'/login');
 await assert.rejects(()=>service.reset({token,password:newer,confirmPassword:newer}),{status:422});
 assert.equal((await post(agent,'/login',{email:'chef@example.test',password})).status,422);
 assert.equal((await post(agent,'/login',{email:'chef@example.test',password:newer})).status,303);
});
test('expired verification and reset do not bypass approval; resends are cooled down',async()=>{
 const chef=await register('pending@example.test'),initial=mail.length;
 await service.request({email:chef.email},'verify');assert.equal(mail.length,initial);
 const token=mail.at(-1).token;
 await db.authToken.updateMany({where:{userId:chef.id},data:{expiresAt:new Date(0)}});
 await assert.rejects(()=>service.verify(token),{status:422});
 await service.request({email:chef.email},'reset');const reset=mail.at(-1).token;
 await service.reset({token:reset,password,confirmPassword:password});
 const row=await db.staffUser.findUnique({where:{id:chef.id}});assert.equal(row.emailVerifiedAt,null);assert.equal(row.approvalStatus,'pending');
});
test('failed delivery leaves registration recoverable and no usable token',async()=>{
 const failing=createAccountService(db,{captcha:delivery.captcha,send:async()=>{throw new AppError(503,'Delivery unavailable');}});
 await assert.rejects(()=>failing.register({email:'retry@example.test',displayName:'Retry Chef',password,confirmPassword:password,'g-recaptcha-response':'test-valid'}),{status:503});
 const user=await db.staffUser.findUnique({where:{email:'retry@example.test'}});assert.ok(user);assert.equal(await db.authToken.count({where:{userId:user.id}}),0);
 await service.request({email:user.email},'verify');assert.equal(mail.at(-1).email,user.email);
});

test('check-email cooldown survives refresh and enables a later resend',async()=>{
 const agent=request.agent(app),email='cooldown@example.test';
 await post(agent,'/signup',{email,displayName:'Cooldown',password,confirmPassword:password,'g-recaptcha-response':'test-valid'},'/signup');
 const before=mail.length;
 for(let i=0;i<2;i++){const page=await agent.get('/check-email');assert.match(page.text,/data-remaining="[1-6][0-9]?" disabled/);}
 const user=await db.staffUser.findUnique({where:{email}});
 await db.authToken.updateMany({where:{userId:user.id},data:{createdAt:new Date(Date.now()-61000)}});
 for(const row of await db.session.findMany()){
  const data=JSON.parse(row.data);if(data.verificationEmail===email){data.verificationResendAt=Date.now()-1000;await db.session.update({where:{sid:row.sid},data:{data:JSON.stringify(data)}});}
 }
 const ready=await agent.get('/check-email');assert.match(ready.text,/data-remaining="0" >/);
 const resent=await agent.post('/resend-verification').type('form').send({_csrf:csrf(ready.text),email});assert.equal(resent.status,303);assert.equal(resent.headers.location,'/check-email');assert.equal(mail.length,before+1);
 assert.equal((await request(app).get('/check-email')).headers.location,'/resend-verification');
 assert.equal((await request(app).get('/verification-complete')).headers.location,'/login');
});
