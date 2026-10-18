// Run before the body renders so the new room starts behind closed panels.
(() => {
 try {
  const arrival=JSON.parse(sessionStorage.getItem('santaishi-tei-doors') || 'null');
  sessionStorage.removeItem('santaishi-tei-doors');
  sessionStorage.removeItem('santaishi-tei-walk');
  const age=arrival?Date.now()-arrival.at:Infinity;
  if(age>=0 && age<30000 && !matchMedia('(prefers-reduced-motion: reduce)').matches){
   document.documentElement.classList.add('journey-arriving');
   // Reveal the document if the enhancement script fails to load.
   window.santaishiDoorWatchdog=setTimeout(()=>{
    document.documentElement.classList.remove('journey-arriving','journey-revealing','journey-closing');
    document.body?.removeAttribute('aria-busy');
   },4500);
  }
 }catch{}
})();
