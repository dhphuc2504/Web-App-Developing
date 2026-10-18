import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const bootstrap=readFileSync(new URL('../public/js/journey-start.js',import.meta.url),'utf8');
const experience=readFileSync(new URL('../public/js/experience.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function browser({path='/directory',reduced=false,arrival=null,storageBlocked=false}={}){
 const classes=new Set(),bodyAttrs=new Map(),storage=new Map(),documentEvents=new Map(),windowEvents=new Map(),links=[],destinations=[];
 if(arrival!==null)storage.set('santaishi-tei-doors',JSON.stringify(arrival));
 let finish;
 const animation=new Promise(resolve=>{finish=resolve;});
 const panels=[0,1].map(()=>({getBoundingClientRect:()=>({width:640,height:720}),getAnimations:()=>[{finished:animation}]}));
 const overlay={querySelectorAll:()=>panels};
 const classList={add:(...values)=>values.forEach(v=>classes.add(v)),remove:(...values)=>values.forEach(v=>classes.delete(v)),contains:value=>classes.has(value)};
 const document={
  readyState:'complete',documentElement:{classList},
  body:{setAttribute:(k,v)=>bodyAttrs.set(k,v),removeAttribute:k=>bodyAttrs.delete(k)},
  getElementById:()=>null,
  querySelector:selector=>selector==='.journey-overlay'?overlay:null,
  querySelectorAll:selector=>selector==='[data-journey][aria-busy]'?links.filter(l=>l.attrs.has('aria-busy')):[],
  addEventListener:(name,fn)=>documentEvents.set(name,[...(documentEvents.get(name)||[]),fn]),
 };
 const window={addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name)};
 const sessionStorage={getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k),setItem:(k,v)=>{if(storageBlocked)throw new Error('Storage unavailable');storage.set(k,v);}};
 const url=new URL(path,'http://fixture.test');
 const context={document,window,sessionStorage,matchMedia:()=>({matches:reduced}),location:{href:url.href,origin:url.origin,pathname:url.pathname,assign:href=>destinations.push(href)},URL,Image:class{},DOMParser:class{},setTimeout,clearTimeout};
 const click=(href,options={})=>{
  const link={href:new URL(href,url).href,target:'',dataset:{journey:'forward'},attrs:new Map(),hasAttribute:name=>name==='data-journey',setAttribute:(k,v)=>link.attrs.set(k,v),removeAttribute:k=>link.attrs.delete(k)};
  links.push(link);
  const event={button:0,defaultPrevented:false,target:{tagName:'A',closest:selector=>selector==='a'?link:null},preventDefault(){this.defaultPrevented=true;},...options};
  for(const listener of documentEvents.get('click')||[])listener(event);
  return event;
 };
 return {context,classes,bodyAttrs,storage,destinations,finish,click,windowEvents,load:()=>runInNewContext(experience,context)};
}

test('the early bootstrap covers a fresh arrival and consumes its one-use marker',()=>{
 const b=browser({arrival:{at:Date.now()}});
 runInNewContext(bootstrap,b.context);
 assert.ok(b.classes.has('journey-arriving'));
 assert.equal(b.storage.has('santaishi-tei-doors'),false);
 clearTimeout(b.context.window.santaishiDoorWatchdog);
});

test('stale or reduced-motion arrivals stay visible without an overlay',()=>{
 for(const options of [{arrival:{at:Date.now()-60000}},{arrival:{at:Date.now()+60000}},{arrival:{at:Date.now()},reduced:true}]){
  const b=browser(options);runInNewContext(bootstrap,b.context);
  assert.equal(b.classes.size,0);
  assert.equal(b.storage.size,0);
 }
});

test('kitchen subpages and modified clicks retain native navigation',()=>{
 const b=browser({path:'/kitchen'});b.load();
 assert.equal(b.click('/kitchen/ingredients').defaultPrevented,false);
 assert.equal(b.click('/kitchen/stock-history').defaultPrevented,false);
 assert.equal(b.click('/directory',{metaKey:true}).defaultPrevented,false);
 assert.equal(b.classes.size,0);
 assert.equal(b.storage.size,0);
});

test('cross-room navigation waits for both panels and ignores repeated clicks',async()=>{
 const b=browser();b.load();
 assert.equal(b.click('/menu').defaultPrevented,true);
 assert.ok(b.classes.has('journey-closing'));
 assert.deepEqual(b.destinations,[]);
 b.click('/menu');b.finish();await tick();
 assert.deepEqual(b.destinations,['http://fixture.test/menu']);
});

test('browser Back cancels an unfinished journey and clears its marker',async()=>{
 const b=browser();b.load();b.click('/menu');
 b.windowEvents.get('pageshow')({persisted:true});
 b.finish();await tick();
 assert.deepEqual(b.destinations,[]);
 assert.equal(b.classes.size,0);
 assert.equal(b.bodyAttrs.size,0);
 assert.equal(b.storage.size,0);
});

test('reduced motion and unavailable storage cannot trap normal page navigation',async()=>{
 const reduced=browser({reduced:true});reduced.load();
 assert.equal(reduced.click('/menu').defaultPrevented,false);
 const blocked=browser({storageBlocked:true});blocked.load();blocked.click('/menu');await tick();
 assert.deepEqual(blocked.destinations,['http://fixture.test/menu']);
 assert.equal(blocked.classes.size,0);
});
