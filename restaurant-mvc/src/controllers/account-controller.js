export function createAccountController(service) {
 const checkEmail=(req,res,email)=>{req.session.verificationEmail=email.trim().toLowerCase();req.session.verificationResendAt=Date.now()+60000;res.redirect(303,'/check-email');};
 const done=(req,res,message)=>{req.session.flash=message;res.redirect(303,'/login');};
 return {
  checkEmail(req,res){
   if(!req.session.verificationEmail)return res.redirect(303,'/resend-verification');
   res.render('auth/check-email',{title:'Check your email',email:req.session.verificationEmail,remaining:Math.max(0,Math.ceil(((req.session.verificationResendAt || 0)-Date.now())/1000))});
  },
  verified(req,res){
   if(!req.session.verificationResult)return res.redirect(303,'/login');
   res.render('auth/verified',{title:'Email verified',result:req.session.verificationResult});
  },
  form:kind=>(req,res)=>res.render('auth/account',{title:{signup:'Join the kitchen',forgot:'Forgot password',resend:'Resend verification',verify:'Verify your email',reset:'Choose a new password'}[kind],kind,error:null,input:{},token:typeof req.query.token==='string'?req.query.token:''}),
  async signup(req,res){await service.register(req.body);checkEmail(req,res,req.body.email);},
  async resend(req,res){
   if(typeof req.body.email==='string' && req.body.email.trim().toLowerCase()===req.session.verificationEmail && req.session.verificationResendAt>Date.now())return res.redirect(303,'/check-email');
   await service.request(req.body,'verify');checkEmail(req,res,req.body.email);
  },
  async forgot(req,res){await service.request(req.body,'reset');done(req,res,'If the account exists, a password reset email will be sent. Please check your inbox and spam folder. Wait one minute before retrying.');},
  async verify(req,res){const user=await service.verify(req.body.token);req.session.verificationResult=!user.isActive?'inactive':user.approvalStatus;delete req.session.verificationEmail;delete req.session.verificationResendAt;res.redirect(303,'/verification-complete');},
  async reset(req,res){await service.reset(req.body);req.session.userId=null;done(req,res,'Password changed. Please sign in again. Existing sessions have been invalidated.');},
  async decide(req,res){await service.decide(req.params.id,req.body.decision);req.session.flash='Chef application updated.';res.redirect(303,'/admin/staff');}
 };
}
