import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { appFor } from '../server/app.js';
import { sweep, upgradeDisplayVariants } from '../server/photos.js';
import { seed } from '../server/seed.js';
import { inspect, render, originalEdit } from '../server/images.js';
import { tokenDigest, verificationMailer } from '../server/verification.js';

// Exercise Express, its HTTP parser and the multipart middleware without binding a port.
async function request(server, path, {method='GET', data, cookie}={}) {
  const body = data instanceof FormData ? new Response(data) :
    new Response(data === undefined ? null : JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  const bytes = Buffer.from(await body.arrayBuffer());
  const headers = [method+' /api'+path+' HTTP/1.1','Host: localhost','Connection: close','Content-Length: '+bytes.length];
  if (data !== undefined) headers.push('Content-Type: '+body.headers.get('Content-Type'));
  if (cookie) headers.push('Cookie: '+cookie);
  const chunks=[];
  const socket=new Duplex({read(){},write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
  const done=new Promise((resolve,reject)=>{socket.once('finish',resolve);socket.once('error',reject);});
  server.emit('connection',socket);
  socket.push(Buffer.concat([Buffer.from(headers.join('\r\n')+'\r\n\r\n'),bytes]));
  await done;
  const response=Buffer.concat(chunks), split=response.indexOf('\r\n\r\n');
  const head=response.subarray(0,split).toString(), raw=response.subarray(split+4);
  return {status:Number(head.split(' ')[1]),cookie:head.match(/set-cookie: ([^;]+)/i)?.[1],
    value:head.includes('application/json') ? JSON.parse(raw.toString()) : raw};
}
const fixture=name=>readFile(new URL('../fixtures/'+name+'.jpg',import.meta.url));
test('verification uses the configured SMTP sender and the gallery origin',async()=>{
  for(const secure of [false,true]) {
    let message,closed=false;
    const send=verificationMailer({
      APP_ORIGIN:'https://photos.example.test',SMTP_HOST:'smtp.example.test',SMTP_PORT:secure?'465':'587',
      SMTP_SECURE:String(secure),SMTP_USER:'sender',SMTP_PASSWORD:'test-only',SMTP_FROM:'sender@example.test'
    },options=>{
      assert.equal(options.host,'smtp.example.test');
      assert.equal(options.secure,secure);
      assert.equal(options.requireTLS,!secure);
      assert.equal(options.auth.user,'sender');
      return {sendMail:async value=>{message=value;},close:()=>{closed=true;}};
    });
    await send('reader@example.test','abc');
    assert.ok(closed);
    assert.equal(message.to.address,'reader@example.test');
    assert.equal(message.from,'sender@example.test');
    assert.match(message.text,/https:\/\/photos\.example\.test\/#\/verify-email\/abc/);
  }
});
function upload(bytes,count=1,visible=false) {
  const form=new FormData();
  form.set('public',String(visible));
  for(let i=0;i<count;i++)form.append('files',new Blob([bytes],{type:'image/jpeg'}),'Demo '+i+'.jpg');
  return form;
}

test('the supplied JPEG fixtures carry simulated signed GPS coordinates and a missing-GPS control',async()=>{
  const north=await inspect(await fixture('Alpine stillness'));
  assert.equal(north.latitude,10.775);assert.equal(north.longitude,106.7);
  const south=await inspect(await fixture('Tide line'));
  assert.ok(Math.abs(south.latitude+33.87)<1e-8);assert.ok(Math.abs(south.longitude+70.68)<1e-8);
  assert.equal((await inspect(await fixture('Blue hour'))).latitude,null);
});
test('large portraits have three WebP files with accurate intrinsic width descriptors',async()=>{
  const original=await sharp({create:{width:1200,height:2400,channels:3,background:'navy'}}).png().toBuffer();
  const {files,widths}=await render(original,originalEdit);
  assert.deepEqual(widths,{thumb:240,medium:480,preview:800});
  for(const [name,width] of Object.entries(widths)) {
    const info=await sharp(files[name]).metadata();
    assert.equal(info.width,width);
    assert.equal(info.height,width*2);
    assert.equal(info.format,'webp');
  }
});
test('two-account gallery from registration to object cleanup',async t=>{
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const objects=new Map(),store={put:async(k,b)=>objects.set(k,b),get:async k=>objects.get(k),remove:async k=>objects.delete(k)};
  const inbox=new Map();
  let failDelivery=false;
  const server=http.createServer(appFor(pg,store,async(email,token)=>{
    if(failDelivery)throw new Error('SMTP unavailable');
    inbox.set(email,[...(inbox.get(email)||[]),token]);
  }));
  const call=(path,options)=>request(server,path,options);
  let alice,bob,photo,revision;
  const bytes=await fixture('Alpine stillness');
  const post=(path,data)=>call(path,{method:'POST',data});
  await t.test('accounts verify by email before signing in by email or username',async()=>{
    const data={username:'Alice',email:'alice@example.test',password:'GalleryPass123'};
    let r=await call('/register',{method:'POST',data});
    assert.equal(r.status,202,JSON.stringify(r.value));assert.equal(r.cookie,undefined);
    assert.deepEqual(r.value,{verificationRequired:true,email:data.email});
    assert.equal((await call('/photos?scope=mine')).status,401);
    assert.equal((await post('/login',{identifier:data.username,password:'incorrect'})).status,401);
    assert.equal((await post('/login',{identifier:data.username,password:data.password})).status,202);
    assert.equal(inbox.get(data.email).length,1);
    const token=inbox.get(data.email)[0];
    assert.equal((await pg.query('SELECT verification_digest FROM stillroom.accounts WHERE username=$1',[data.username])).rows[0].verification_digest,tokenDigest(token));
    assert.equal((await post('/verify-email',{token,password:'incorrect'})).status,401);
    const attempts=await Promise.all([1,2].map(()=>post('/verify-email',{token,password:data.password})));
    assert.deepEqual(attempts.map(r=>r.status).sort(),[200,410]);
    alice=attempts.find(r=>r.status===200).cookie;
    assert.equal((await call('/me',{cookie:alice})).value.username,'Alice');
    assert.equal((await call('/logout',{method:'POST',cookie:alice})).status,204);
    assert.equal((await call('/me',{cookie:alice})).value,null);
    for(const identifier of [data.email,'alice']){
      r=await call('/login',{method:'POST',data:{identifier,password:data.password}});
      assert.equal(r.status,200);alice=r.cookie;
    }
    await post('/register',{...data,username:'Bob',email:'bob@example.test'});
    bob=(await post('/verify-email',{token:inbox.get('bob@example.test')[0],password:data.password})).cookie;
    assert.ok(bob);
  });
  await t.test('legacy accounts verify once, recover from mail failure and replace expired links',async()=>{
    const identifier='legacy@example.test', password='GalleryPass123', oldSession='b'.repeat(64);
    const {rows:[{id}]}=await pg.query(`INSERT INTO stillroom.accounts(id,username,email,password_hash)
      SELECT gen_random_uuid(),'Legacy',$1,password_hash FROM stillroom.accounts WHERE username='Alice' RETURNING id`,[identifier]);
    await pg.query("INSERT INTO stillroom.sessions VALUES ($1,$2,now()+interval '1 day')",[tokenDigest(oldSession),id]);
    const cookie='still_session='+oldSession;
    assert.equal((await call('/photos?scope=mine',{cookie})).status,401);
    failDelivery=true;
    assert.equal((await post('/login',{identifier,password})).status,503);
    failDelivery=false;
    const first=await post('/login',{identifier,password});
    assert.equal(first.status,202);assert.equal(first.cookie,undefined);
    const firstToken=inbox.get(identifier)[0];
    await pg.query("UPDATE stillroom.accounts SET verification_sent_at=now()-interval '2 minutes' WHERE id=$1",[id]);
    assert.equal((await post('/login',{identifier,password})).status,202);
    const nextToken=inbox.get(identifier)[1];
    assert.equal((await post('/verify-email',{token:firstToken,password})).status,410);
    await pg.query("UPDATE stillroom.accounts SET verification_sent_at=now()-interval '25 hours' WHERE id=$1",[id]);
    assert.equal((await post('/verify-email',{token:nextToken,password})).status,410);
    await post('/login',{identifier,password});
    assert.equal((await post('/verify-email',{token:inbox.get(identifier)[2],password})).status,200);
    assert.equal((await call('/me',{cookie})).value,null);
    assert.equal((await post('/login',{identifier,password})).status,200);
    assert.equal(inbox.get(identifier).length,3);
  });
  await t.test('batch limits and private upload',async()=>{
    for(const n of [0,6])assert.equal((await call('/photos',{method:'POST',cookie:alice,data:upload(bytes,n)})).status,400);
    assert.equal((await call('/photos',{method:'POST',cookie:alice,data:upload(Buffer.from('invalid'))})).status,400);
    const r=await call('/photos',{method:'POST',cookie:alice,data:upload(bytes)});
    assert.equal(r.status,201,JSON.stringify(r.value));[photo]=r.value.ids;
    const p=(await call('/photos/'+photo,{cookie:alice})).value;
    assert.equal(p.latitude,10.775);assert.equal(p.public,false);revision=p.revision;
    assert.equal(objects.size,4);
    for(const path of ['/photos/'+photo,'/photos/'+photo+'/media/thumb','/photos/'+photo+'/media/medium','/photos/'+photo+'/media/preview','/photos/'+photo+'/media/source'])
      assert.equal((await call(path,{cookie:bob})).status,404);
    assert.deepEqual((await call('/discover')).value,[]);
  });
  await t.test('existing two-file photos gain three selectable files on upgrade without re-uploading',async()=>{
    const oldRevision=revision;
    await pg.query('UPDATE stillroom.photos SET variant_widths=NULL WHERE id=$1',[photo]);
    objects.delete(photo+'/'+oldRevision+'/medium');
    await upgradeDisplayVariants(pg,store);
    const result=(await call('/photos/'+photo,{cookie:alice})).value;
    revision=result.revision;
    assert.notEqual(revision,oldRevision);
    assert.deepEqual(result.variant_widths,{thumb:153,medium:306,preview:510});
    for(const [name,width] of Object.entries(result.variant_widths)) {
      const response=await call('/photos/'+photo+'/media/'+name,{cookie:alice});
      assert.equal(response.status,200);
      assert.equal((await sharp(response.value).metadata()).width,width);
    }
    await upgradeDisplayVariants(pg,store);
    await sweep(pg,store);
    assert.equal(objects.size,4);
    assert.deepEqual(objects.get(photo+'/original'),bytes);
  });
  await t.test('public discovery and owner-only edits',async()=>{
    const route='/photos/'+photo;
    const publish=await call(route,{method:'PATCH',cookie:alice,data:{public:true}});
    assert.equal(publish.value.public,true);
    assert.equal((await call('/discover',{cookie:bob})).value[0].id,photo);
    assert.equal((await call('/photos?owner='+publish.value.owner_id,{cookie:bob})).value.items.length,1);
    assert.equal((await call(route,{cookie:bob})).value.latitude,undefined);
    assert.equal((await call(route+'/media/preview',{cookie:bob})).status,200);
    assert.equal((await call(route+'/media/source',{cookie:bob})).status,404);
    for(const method of ['PATCH','DELETE'])assert.equal((await call(route,{method,cookie:bob,data:{public:false}})).status,404);
    const edit={crop:{left:10,top:12,width:130,height:80},rotation:90};
    const r=await call(route,{method:'PATCH',cookie:alice,data:{edit,revision}});
    assert.equal(r.status,200);assert.equal(r.value.width,80);assert.equal(r.value.height,130);
    assert.deepEqual(r.value.variant_widths,{thumb:24,medium:48,preview:80});
    const img=await sharp((await call(route+'/media/preview',{cookie:alice})).value).metadata();
    assert.equal(img.width,80);assert.equal(img.height,130);assert.equal(img.exif,undefined);
    assert.equal((await call(route,{method:'PATCH',cookie:alice,data:{edit,revision}})).status,409);
    const reset=await call(route,{method:'PATCH',cookie:alice,data:{edit:{crop:null,rotation:0},revision:r.value.revision}});
    assert.equal(reset.value.width,510);assert.equal(reset.value.height,337);
  });
  await t.test('daily draw, unpublishing, deletion and object cleanup',async()=>{
    for(let i=0;i<2;i++)assert.equal((await call('/draw',{method:'POST',cookie:alice})).value.id,photo);
    assert.equal((await call('/draw',{method:'POST',cookie:bob})).value,null);
    await call('/photos/'+photo,{method:'PATCH',cookie:alice,data:{public:false}});
    assert.equal((await call('/photos/'+photo+'/media/preview',{cookie:bob})).status,404);
    assert.equal((await call('/photos/'+photo,{method:'DELETE',cookie:alice})).status,204);
    assert.equal((await call('/draw',{method:'POST',cookie:alice})).value,null);
    await sweep(pg,store);assert.equal(objects.size,0);
  });
  await t.test('five-photo uploads and cursor pagination return every photo exactly once',async()=>{
    for(let i=0;i<5;i++){
      const r=await call('/photos',{method:'POST',cookie:alice,data:upload(bytes,5)});
      assert.equal(r.status,201);assert.equal(r.value.ids.length,5);
    }
    const path='/photos?scope=mine',first=(await call(path,{cookie:alice})).value;
    assert.equal(first.items.length,24);
    const last=(await call(path+'&cursor='+encodeURIComponent(first.next),{cookie:alice})).value;
    assert.equal(last.items.length,1);assert.equal(last.next,null);
    assert.equal(new Set([...first.items,...last.items].map(p=>p.id)).size,25);
  });
  await t.test('search finds users and visible photo titles, and pages through private results for their owner',async()=>{
    const users=(await call('/search?q=%40aLi')).value.items;
    assert.deepEqual(users.map(item=>[item.kind,item.username]),[['user','Alice']]);
    assert.equal(users[0].email,undefined);
    const emptyGallery=(await call('/photos?owner='+users[0].id)).value;
    assert.equal(emptyGallery.username,'Alice');
    assert.deepEqual(emptyGallery.items,[]);
    for(const cookie of [undefined,bob]) {
      assert.deepEqual((await call('/search?q=dEmO',{cookie})).value.items,[]);
    }
    const ids=[];
    for(const offset of [0,12,24]) {
      const page=(await call('/search?q=dEmO&offset='+offset,{cookie:alice})).value;
      assert.equal(page.hasMore,offset<24);
      ids.push(...page.items.map(item=>item.id));
    }
    assert.equal(new Set(ids).size,25);
    assert.deepEqual((await call('/search?q=%25',{cookie:alice})).value.items,[]);
    assert.equal((await call('/search?q=%20')).status,400);
    await call('/photos/'+ids[0],{method:'PATCH',cookie:alice,data:{public:true}});
    assert.deepEqual((await call('/search?q=demo',{cookie:bob})).value.items.map(item=>item.id),[ids[0]]);
    await call('/photos/'+ids[0],{method:'PATCH',cookie:alice,data:{public:false}});
  });
  await t.test('seeded public roll contains nine frames from three photographers',async()=>{
    await seed(pg,store);await seed(pg,store);
    const roll=(await call('/discover')).value;
    assert.equal(roll.length,9);assert.equal(new Set(roll.map(p=>p.username)).size,3);
    assert.equal((await pg.query('SELECT count(*) AS n FROM stillroom.photos WHERE public')).rows[0].n,9);
  });
});
