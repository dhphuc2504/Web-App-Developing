(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const ordinaryClick=e=>!e.defaultPrevented && e.button===0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
 const parse=html=>new DOMParser().parseFromString(html,'text/html');
 const room=path=>path==='/'?'outside':path==='/directory'?'house':path.startsWith('/menu')?'dining':path.startsWith('/kitchen')?'kitchen':path.startsWith('/admin')?'office':'staff';
 const journeyRoot=document.documentElement,doors=document.querySelector('.journey-overlay');
 let leaving=journeyRoot.classList.contains('journey-arriving'),journeySequence=0,menuRequest=null,menuSequence=0,finishBookTurn=null,paperBusy=false,paperDirty=false,paperOrigin=null,paperFetch=null;
 const paper=document.getElementById('paper-dialog');
 const resetJourney=()=>{leaving=false;journeySequence++;clearTimeout(window.santaishiDoorWatchdog);journeyRoot.classList.remove('journey-closing','journey-arriving','journey-revealing');document.body.removeAttribute('aria-busy');document.querySelectorAll('[data-journey][aria-busy]').forEach(link=>link.removeAttribute('aria-busy'));try{sessionStorage.removeItem('santaishi-tei-doors');}catch{}};
 window.addEventListener('pageshow',e=>{if(e.persisted)resetJourney();});
 async function panelsFinished(fallbackMs){
  const panels=[...doors.querySelectorAll('.journey-panel')];let deadline;
  const sliding=panels.every(panel=>typeof panel.getAnimations==='function')
   ?Promise.all(panels.flatMap(panel=>panel.getAnimations()).map(animation=>animation.finished.catch(()=>{})))
   :new Promise(resolve=>setTimeout(resolve,fallbackMs));
  try{await Promise.race([sliding,new Promise(resolve=>{deadline=setTimeout(resolve,1200);})]);}
  finally{clearTimeout(deadline);}
 }
 async function revealRoom(){
  if(!doors || reduced.matches){resetJourney();return;}
  document.body.setAttribute('aria-busy','true');
  // Hold the matching closed view until the new room's first assets are ready.
  if(document.readyState!=='complete')await new Promise(resolve=>{
   const ready=()=>{clearTimeout(deadline);window.removeEventListener('load',ready);resolve();};
   const deadline=setTimeout(ready,1500);window.addEventListener('load',ready,{once:true});
  });
  if(!journeyRoot.classList.contains('journey-arriving'))return;
  doors.querySelectorAll('.journey-panel').forEach(panel=>panel.getBoundingClientRect());
  journeyRoot.classList.add('journey-revealing');await panelsFinished(700);resetJourney();
 }
 if(journeyRoot.classList.contains('journey-arriving'))revealRoom().catch(resetJourney);
 async function changeRoom(link,url){
  if(!doors){location.assign(url.href);return;}
  try{sessionStorage.setItem('santaishi-tei-doors',JSON.stringify({at:Date.now()}));}
  catch{location.assign(url.href);return;}
  const sequence=++journeySequence;link.setAttribute('aria-busy','true');document.body.setAttribute('aria-busy','true');
  doors.querySelectorAll('.journey-panel').forEach(panel=>panel.getBoundingClientRect());
  journeyRoot.classList.add('journey-closing');await panelsFinished(550);
  if(sequence!==journeySequence)return;
  location.assign(url.href);
 }
 // Preload scene assets only. Protected GET pages may consume a session notice.
 document.querySelectorAll('a[data-journey]').forEach(link=>link.addEventListener('pointerenter',()=>{const dest=room(new URL(link.href).pathname),src={dining:'dining-table',kitchen:'kitchen',house:'foyer',outside:'exterior'}[dest];if(src){const image=new Image();image.src=`/images/japan/${src}.jpg`;}},{once:true}));
 async function menuNavigate(href,{history=true,flip='',focusId=''}={}) {
  const old=document.querySelector('[data-menu-shell]');if(!old)return location.assign(href);
  menuRequest?.abort();const sequence=++menuSequence;finishBookTurn?.();menuRequest=new AbortController();old.setAttribute('aria-busy','true');
  try {
   const response=await fetch(href,{signal:AbortSignal.any([menuRequest.signal,AbortSignal.timeout(15000)]),headers:{Accept:'text/html'}});if(!response.ok)throw new Error('menu');
   const page=parse(await response.text()),fresh=page.querySelector('[data-menu-shell]');if(!fresh)throw new Error('menu');if(sequence!==menuSequence)return;
   const book=fresh.querySelector('.menu-book'),sheet=fresh.querySelector('.book-turn-sheet');
   const backward=flip==='back',front=old.querySelector(backward?'.page-left':'.page-right')?.cloneNode(true);
   let cleanup=null;
   if(!reduced.matches && flip && front){
    const back=fresh.querySelector(backward?'.page-right':'.page-left').cloneNode(true),stationary=old.querySelector(backward?'.page-right':'.page-left').cloneNode(true),shadow=document.createElement('div');
    front.classList.add('book-turn-face','turn-front');back.classList.add('book-turn-face','turn-back');sheet.replaceChildren(front,back);
    stationary.classList.add('book-stationary-page');stationary.inert=true;stationary.setAttribute('aria-hidden','true');shadow.className='book-floor-shadow';shadow.setAttribute('aria-hidden','true');book.append(stationary,shadow);
    cleanup=()=>{sheet.getAnimations().forEach(animation=>animation.cancel());sheet.replaceChildren();stationary.remove();shadow.remove();book.classList.remove('book-flipping','flip-back','flip-next');if(finishBookTurn===cleanup)finishBookTurn=null;};
    finishBookTurn=cleanup;book.classList.add('book-flipping',backward?'flip-back':'flip-next');
   }
   old.replaceWith(fresh);document.title=page.title;if(history)window.history.pushState({menu:true},'',href);
   if(cleanup){await Promise.all(sheet.getAnimations().map(animation=>animation.finished.catch(()=>{})));cleanup();}
   else if(!reduced.matches)book.animate([{opacity:.65},{opacity:1}],{duration:160});
   if(sequence!==menuSequence)return;
   const focus=focusId?document.getElementById(focusId):fresh.querySelector('.book-pagination a[aria-current]');focus?.focus({preventScroll:true});fresh.querySelector('[data-menu-status]').textContent=`Menu page ${fresh.dataset.page} loaded.`;
  }catch(error){if(error.name==='AbortError')return;if(!history)return location.reload();const status=old.querySelector('[data-menu-status]');if(status){status.classList.remove('sr-only');status.textContent='The next page could not load. Please try again.';}}
  finally{old.removeAttribute('aria-busy');}
 }
 window.addEventListener('popstate',()=>{if(document.querySelector('[data-menu-shell]'))menuNavigate(location.href,{history:false});});
 function paperStatus(message){paper.querySelector('[data-paper-status]').textContent=message;}
 function paperMotion(returning=false){
  if(reduced.matches)return Promise.resolve();
  const source=paperOrigin?.isConnected?paperOrigin.getBoundingClientRect():null,target=paper.getBoundingClientRect();
  const dx=source?source.left+source.width/2-target.left-target.width/2:0,dy=source?source.top+source.height/2-target.top-target.height/2:80;
  const offset={transform:`translate(${dx}px,${dy}px) scale(.35) rotate(-4deg)`,opacity:0},rest={transform:'translate(0,0) scale(1) rotate(0)',opacity:1};
  return paper.animate(returning?[rest,offset]:[offset,rest],{duration:returning?240:300,easing:'cubic-bezier(.2,.7,.2,1)'}).finished.catch(()=>{});
 }
 async function openPaper(link){
  if(paperBusy || paper.open)return;paperOrigin=link.closest('[data-ticket-id]') || link;paperDirty=false;paperBusy=true;
  paper.querySelector('.paper-close-choice')?.remove();paper.querySelector('[data-paper-content]').replaceChildren();paper.showModal();paperStatus('Taking the sheet from the board…');paperFetch=new AbortController();
  try {const response=await fetch(link.href,{signal:AbortSignal.any([paperFetch.signal,AbortSignal.timeout(15000)]),headers:{Accept:'text/html'}}),page=parse(await response.text()),sheet=page.querySelector('[data-paper-sheet]');
   if(!response.ok || !sheet){paper.close();location.assign(link.href);return;}
   if(!paper.open)return;paper.querySelector('[data-paper-content]').replaceChildren(sheet);paperStatus('');await paperMotion();sheet.querySelector('textarea,input:not([type="hidden"]),select')?.focus({preventScroll:true});
  }catch(error){if(error.name!=='AbortError'){paperStatus('The sheet could not load.');const a=document.createElement('a');a.href=link.href;a.textContent='Open the full editor ↗';paper.querySelector('[data-paper-content]').append(a);}}
  finally{paperBusy=false;}
 }
 async function closePaper(){
  if(paperBusy)return;
  if(paperDirty){
   paperStatus('Your sheet has unsaved changes.');
   if(!paper.querySelector('.paper-close-choice')){const choice=document.createElement('div');choice.className='paper-close-choice';const keep=document.createElement('button'),discard=document.createElement('button');keep.type=discard.type='button';keep.dataset.paperKeep='';discard.dataset.paperDiscard='';keep.textContent='Keep editing';discard.textContent='Discard changes';discard.className='secondary';choice.append(keep,discard);paper.querySelector('[data-paper-status]').after(choice);keep.focus();}return;
  }
  paperBusy=true;await paperMotion(true);paper.close();paperBusy=false;paperDirty=false;(paperOrigin?.matches('[data-paper-link]')?paperOrigin:paperOrigin?.querySelector('[data-paper-link]'))?.focus({preventScroll:true});
 }
 paper?.addEventListener('cancel',e=>{e.preventDefault();closePaper();});
 async function savePaper(form){
  if(paperBusy)return;paper.querySelector('.paper-close-choice')?.remove();paperBusy=true;paperStatus('Saving your changes…');
  // Snapshot first, then lock fields so edits made during a save cannot be lost.
  const body=new URLSearchParams(new FormData(form)),controls=[...form.querySelectorAll('button,input,select,textarea')],disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
  try {
   const response=await fetch(form.action,{method:'POST',signal:AbortSignal.timeout(20000),body,headers:{'X-Requested-With':'RecipePaper',Accept:'text/html'}}),page=parse(await response.text());
   const board=page.querySelector('[data-board-workspace]'),sheet=page.querySelector('[data-paper-sheet]');
   if(response.ok && response.redirected && board){paperStatus('Saved. Returning the sheet to the board…');paperDirty=false;await paperMotion(true);document.querySelector('[data-board-workspace]')?.replaceWith(board);paper.close();const notice=document.createElement('p');notice.className='notice';notice.setAttribute('role','status');notice.textContent='Saved successfully. The kitchen board is up to date.';document.querySelector('#main .notice')?.remove();document.getElementById('main').prepend(notice);(board.querySelector(`[data-ticket-id="${paperOrigin?.dataset.ticketId}"] [data-paper-link]`) || board.querySelector('[data-paper-link]'))?.focus({preventScroll:true});}
   else if(sheet){paper.querySelector('[data-paper-content]').replaceChildren(sheet);paperStatus('Please review the sheet. Your changes are still here.');sheet.querySelector('.error')?.setAttribute('tabindex','-1');sheet.querySelector('.error')?.focus();}
   else if(new URL(response.url).pathname==='/login'){paperStatus('Your session has ended. Your entries remain on this sheet. Sign in in another tab, then try saving again.');}
   else {paperStatus(page.querySelector('.error')?.textContent || 'The sheet could not be saved. Your entries remain here.');}
  }catch {paperStatus('The save could not be confirmed. Your entries remain here. Retry to check, or reload the board in another tab.');}
  finally{paperBusy=false;controls.forEach((control,index)=>control.disabled=disabled[index]);}
 }
 const confirmation=document.getElementById('confirm-dialog');let pendingForm=null;
 document.addEventListener('submit',e=>{
  const form=e.target;if(form.matches('[data-book-form]')){e.preventDefault();const url=new URL(form.action);url.search=new URLSearchParams(new FormData(form)).toString();menuNavigate(url.href,{focusId:document.activeElement?.id});}
  else if(form.closest('#paper-dialog')){e.preventDefault();savePaper(form);}
  else if(form.matches('[data-confirm]') && form.dataset.confirmed!=='true' && confirmation?.showModal){e.preventDefault();pendingForm=form;confirmation.querySelector('[data-confirm-message]').textContent=form.dataset.confirm;confirmation.showModal();}
 });
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-paper-keep]')){paper.querySelector('.paper-close-choice')?.remove();paperStatus('');return;}if(e.target.closest('[data-paper-discard]')){paperDirty=false;paper.querySelector('.paper-close-choice')?.remove();closePaper();return;}const close=e.target.closest('[data-dialog-close]');if(close){const dialog=close.closest('dialog');if(dialog===paper)closePaper();else dialog?.close();return;}
  if(e.target.closest('[data-confirm-cancel]')){confirmation.close();pendingForm=null;return;}
  if(e.target.closest('[data-confirm-accept]')){if(pendingForm){pendingForm.dataset.confirmed='true';confirmation.close();pendingForm.requestSubmit();pendingForm=null;}return;}
  const toggle=e.target.closest('[data-recipe-toggle]');if(toggle){const row=toggle.closest('[data-recipe-row]'),qty=row.querySelector('[name="quantity"]');qty.value=Number(qty.value)>0?'0':'1';qty.dispatchEvent(new Event('input',{bubbles:true}));qty.focus();return;}
  const view=e.target.closest('[data-pantry-view]');if(view){const list=view.closest('[data-pantry]').classList.toggle('pantry-list');view.textContent=list?'Shelf view':'List view';view.setAttribute('aria-pressed',String(list));return;}
  const dish=e.target.closest('[data-dish-dialog],[data-dish-open]');if(dish && ordinaryClick(e)){const dialog=document.getElementById(dish.dataset.dishDialog || dish.dataset.dishOpen);if(dialog?.showModal){e.preventDefault();dialog.showModal();dialog.addEventListener('close',()=>dish.focus(),{once:true});}return;}
  const link=e.target.closest('a');if(link?.hasAttribute('data-paper-cancel') && link.closest('#paper-dialog') && ordinaryClick(e)){e.preventDefault();closePaper();return;}if(!link || !ordinaryClick(e) || link.target || link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
  if(link.hasAttribute('data-book-link')){e.preventDefault();menuNavigate(url.href,{flip:link.dataset.flip || ''});return;}
  if(link.hasAttribute('data-paper-link') && paper?.showModal){e.preventDefault();openPaper(link);return;}
  if(!link.hasAttribute('data-journey') || reduced.matches || url.href===location.href || room(url.pathname)===room(location.pathname))return;
  e.preventDefault();if(leaving)return;leaving=true;changeRoom(link,url).catch(()=>{resetJourney();location.assign(url.href);});
 });
 document.addEventListener('change',e=>{if(e.target.matches('[data-auto-submit]'))e.target.form.requestSubmit();if(e.target.matches('[data-pantry-low]'))filterPantry();});
 function filterPantry(){const pantry=document.querySelector('[data-pantry]');if(!pantry)return;const q=pantry.querySelector('[data-pantry-search]').value.trim().toLowerCase(),low=pantry.querySelector('[data-pantry-low]').checked;let count=0;pantry.querySelectorAll('[data-pantry-item]').forEach(item=>{item.hidden=!item.dataset.name.includes(q) || low && item.dataset.low!=='true';if(!item.hidden)count++;});pantry.querySelector('[data-pantry-empty]').hidden=count!==0;}
 document.addEventListener('input',e=>{
  if(e.target.closest('#paper-dialog'))paperDirty=true;
  if(e.target.matches('[data-pantry-search]'))filterPantry();
  if(e.target.matches('[data-board-search]')){const q=e.target.value.trim().toLowerCase();let count=0;document.querySelectorAll('[data-search-text]').forEach(ticket=>{ticket.hidden=!ticket.dataset.searchText.includes(q);if(!ticket.hidden)count++;});document.querySelectorAll('.board-column').forEach(column=>{column.querySelector('.column-count').textContent=[...column.querySelectorAll('.dish-ticket')].filter(t=>!t.hidden).length;});document.querySelector('[data-board-empty]').hidden=count!==0;}
  if(e.target.matches('[name="quantity"]') && e.target.closest('[data-recipe-row]')){const row=e.target.closest('[data-recipe-row]'),present=Number(e.target.value)>0,toggle=row.querySelector('[data-recipe-toggle]');row.classList.toggle('ingredient-in-recipe',present);toggle.textContent=present?'Remove':'Add';toggle.setAttribute('aria-pressed',String(present));}
  if(e.target.matches('[data-servings]')){const n=Number(e.target.value);document.querySelectorAll('[data-recipe-cost]').forEach(el=>{el.textContent=Number.isInteger(n)&&n>0?(Number(el.dataset.recipeCost)*n).toFixed(3):'—';});}
 });
 document.addEventListener('click',e=>{if(e.target.tagName==='DIALOG' && e.target.open){const r=e.target.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom){if(e.target===paper)closePaper();else e.target.close();}}});
})();
