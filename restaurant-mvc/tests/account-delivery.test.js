import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountDelivery } from '../src/services/account-delivery.js';
const config={APP_ORIGIN:'http://localhost:3000',RECAPTCHA_SITE_KEY:'public-test-key',RECAPTCHA_SECRET_KEY:'private-test-key',SMTP_HOST:'mail.example.test',SMTP_PORT:587,SMTP_SECURE:false,SMTP_USER:'test',SMTP_PASSWORD:'test-only',SMTP_FROM:'sender@example.test'};
test('v2 verification fails closed for missing, failed or wrong-host responses',async()=>{
 const delivery=result=>createAccountDelivery(config,{fetchImpl:async()=>({ok:true,json:async()=>result})});
 await assert.rejects(()=>delivery({success:true,hostname:'localhost'}).captcha(''),{status:422});
 await assert.rejects(()=>delivery({success:false}).captcha('token'),{status:422});
 await assert.rejects(()=>delivery({success:true,hostname:'attacker.example'}).captcha('token'),{status:422});
 await delivery({success:true,hostname:'localhost'}).captcha('token');
 await assert.rejects(()=>createAccountDelivery(config,{fetchImpl:async()=>{throw Error('private upstream details');}}).captcha('token'),{status:503,message:'CAPTCHA verification is unavailable. Please try again.'});
 await assert.rejects(()=>createAccountDelivery({}).captcha('token'),{status:503});
});
test('email uses configured origin, enforces STARTTLS on 587 and suppresses provider diagnostics',async()=>{
 let options,message,closed=false;
 const delivery=createAccountDelivery(config,{transportFactory:input=>{options=input;return {sendMail:async body=>{message=body;},close:()=>{closed=true;}};}});
 await delivery.send({email:'chef@example.test',purpose:'reset',token:'one-time-test-token'});
 assert.equal(options.requireTLS,true);assert.equal(options.secure,false);assert.equal(message.to,'chef@example.test');assert.match(message.text,/http:\/\/localhost:3000\/reset-password\?token=one-time-test-token/);assert.equal(closed,true);
 const failing=createAccountDelivery(config,{transportFactory:()=>({sendMail:async()=>{throw Error('sensitive upstream credentials');},close:()=>{}})});
 await assert.rejects(()=>failing.send({email:'chef@example.test',purpose:'verify',token:'token'}),{status:503,message:'Email delivery is unavailable. Please try again later.'});
});
