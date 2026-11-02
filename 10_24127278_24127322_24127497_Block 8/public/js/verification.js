// The server and database enforce the cooldown; this timer only updates the UI.
const resendButton=document.querySelector('[data-resend-button]');
if(resendButton){
 const status=document.querySelector('[data-resend-status]');
 const availableAt=Date.now()+Number(resendButton.dataset.remaining)*1000;
 function update(){
  const seconds=Math.max(0,Math.ceil((availableAt-Date.now())/1000));
  resendButton.disabled=seconds>0;
  status.textContent=seconds>0?`You can resend in ${seconds} seconds.`:'No email yet? You can request another link.';
  if(seconds===0)clearInterval(timer);
 }
 const timer=setInterval(update,1000);update();
}
