import express from 'express';
import multer from 'multer';
import { randomBytes, randomUUID, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { photoSelect, photoService, view } from './photos.js';
import { displayVariants, fail } from './images.js';
import { requestVerification, tokenDigest, validEmail, verificationMailer } from './verification.js';
const scrypt = promisify(derive);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const upload = multer({limits:{fileSize:10*1024*1024,files:5,fields:1,parts:7}, defParamCharset:'utf8'}).array('files',5);
const cookie = {httpOnly:true,sameSite:'lax',path:'/',secure:process.env.COOKIE_SECURE === 'true'};

async function passwordMatches(password,user) {
  const [salt,secret] = (user?.password_hash || 'anonymous:').split(':');
  const actual = await scrypt(password,salt,64);
  return Boolean(secret) && timingSafeEqual(actual,Buffer.from(secret,'hex'));
}

export function appFor(db,store,sendVerification = verificationMailer()) {
  const app = express(), photos = photoService(db,store);
  app.disable('x-powered-by');
  app.use('/api', (req,res,next) => {
    res.set('Cache-Control','private, no-store');
    res.set('X-Content-Type-Options','nosniff');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin) {
      if (new URL(req.headers.origin).host !== req.get('host')) return res.status(403).json({error:'Origin mismatch.'});
    }
    next();
  },express.json({limit:'32kb'}),async (req,res,next) => {
    const token = req.headers.cookie?.match(/(?:^|;\s*)still_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    req.user = null;
    if (token) {
      req.digest = tokenDigest(token);
      req.user = (await db.query(`SELECT a.id,a.username FROM stillroom.accounts a JOIN stillroom.sessions s
        ON s.account_id=a.id WHERE s.digest=$1 AND s.expires>now() AND a.email_verified_at IS NOT NULL`,[req.digest])).rows[0] ?? null;
    }
    next();
  });
  async function session(res,user) {
    const token = randomBytes(32).toString('hex');
    await db.query("INSERT INTO stillroom.sessions VALUES ($1,$2,now()+interval '14 days')",[tokenDigest(token),user.id]);
    res.cookie('still_session',token,{...cookie,maxAge:14*86400000}).json({id:user.id,username:user.username});
  }
  function signed(req,res,next) {
    if (!req.user) fail(401,'Sign in to open your gallery.');
    next();
  }
  app.get('/api/me',(req,res) => res.json(req.user));
  async function pending(res,user) {
    await requestVerification(db,user,sendVerification);
    res.status(202).json({verificationRequired:true,email:user.email});
  }
  app.post('/api/register',async (req,res) => {
    const {username,email,password} = req.body ?? {};
    if (!/^[\w.-]{3,32}$/.test(typeof username === 'string' ? username : '') ||
      !validEmail(email) ||
      typeof password !== 'string' || password.length < 8 || password.length > 128)
      fail(400,'Use a 3–32 character username (letters, numbers, dot, dash or underscore), a valid email, and an 8–128 character password.');
    const salt = randomBytes(16).toString('hex'), id = randomUUID();
    const secret = salt + ':' + (await scrypt(password,salt,64)).toString('hex');
    try { await db.query('INSERT INTO stillroom.accounts(id,username,email,password_hash) VALUES ($1,$2,$3,$4)',[id,username,email.toLowerCase(),secret]); }
    catch(e) { if (e.code === '23505') fail(409,'That email or username is already in use.'); throw e; }
    await pending(res,{id,email:email.toLowerCase()});
  });
  app.post('/api/login',async (req,res) => {
    const {identifier,password} = req.body ?? {};
    if (typeof identifier !== 'string' || typeof password !== 'string' || password.length > 128) fail(400,'Enter your username or email and password.');
    const user = (await db.query('SELECT * FROM stillroom.accounts WHERE lower(username)=lower($1) OR lower(email)=lower($1)',[identifier])).rows[0];
    if (!await passwordMatches(password,user)) fail(401,'Incorrect account or password.');
    if (!user.email_verified_at) return pending(res,user);
    await session(res,user);
  });
  app.post('/api/verify-email',async(req,res)=>{
    const {token,password} = req.body ?? {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof password !== 'string' || password.length > 128)
      fail(400,'Open the link from your email and enter your account password.');
    const digest = tokenDigest(token);
    const valid = "verification_digest=$1 AND email_verified_at IS NULL AND verification_sent_at > now() - interval '24 hours'";
    const expired = 'This link has expired or was already used. Sign in to continue or request a fresh link.';
    const user = (await db.query('SELECT id,username,password_hash FROM stillroom.accounts WHERE '+valid,[digest])).rows[0];
    if (!user) fail(410,expired);
    if (!await passwordMatches(password,user)) fail(401,'Incorrect account password.');
    await db.transaction(async tx=>{
      const used = await tx.query(`UPDATE stillroom.accounts SET email_verified_at=now(), verification_digest=NULL,
        verification_sent_at=NULL WHERE `+valid+' RETURNING id',[digest]);
      if (!used.rows.length) fail(410,expired);
      await tx.query('DELETE FROM stillroom.sessions WHERE account_id=$1',[user.id]);
    });
    await session(res,user);
  });
  app.post('/api/logout',signed,async(req,res) => {
    await db.query('DELETE FROM stillroom.sessions WHERE digest=$1',[req.digest]);
    res.clearCookie('still_session',cookie).sendStatus(204);
  });
  app.get('/api/discover',async(req,res) => {
    // Mix photographers before taking a second frame from any one public collection.
    const {rows} = await db.query('SELECT * FROM ('+photoSelect.replace('SELECT p.*, a.username','SELECT p.*, a.username, row_number() OVER (PARTITION BY owner_id ORDER BY random()) AS frame')+' WHERE public) picks ORDER BY frame, random() LIMIT 9');
    res.json(rows.map(r=>view(r,req.user?.id)));
  });
  app.get('/api/search',async(req,res) => {
    const term = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const offset = Number(req.query.offset ?? 0);
    if (!term || term.length > 160 || term.includes('\0')) fail(400,'Enter a search term of 1–160 characters.');
    if (!Number.isSafeInteger(offset) || offset < 0) fail(400,'Invalid search offset.');
    const limit = 12;
    const usernameTerm = term.replace(/^@/, '');
    const {rows} = await db.query(`
      WITH matches AS (
        SELECT 'user' AS kind, id, username AS name, username,
               NULL::uuid AS revision, NULL::jsonb AS variant_widths, lower($2) AS needle
        FROM stillroom.accounts
        WHERE $2 <> '' AND strpos(lower(username),lower($2)) > 0
        UNION ALL
        SELECT 'photo', p.id, p.title, a.username, p.revision, p.variant_widths, lower($1)
        FROM stillroom.photos p JOIN stillroom.accounts a ON a.id=p.owner_id
        WHERE (p.public OR p.owner_id=$3) AND strpos(lower(p.title),lower($1)) > 0
      )
      SELECT kind,id,name,username,revision,variant_widths FROM matches
      ORDER BY (lower(name)=needle) DESC, strpos(lower(name),needle), lower(name), kind, id
      LIMIT $4 OFFSET $5`,[term,usernameTerm,req.user?.id ?? null,limit+1,offset]);
    res.json({items:rows.slice(0,limit),hasMore:rows.length>limit});
  });
  app.get('/api/photos',async(req,res) => {
    const mine = req.query.scope === 'mine';
    if (mine && !req.user) fail(401,'Sign in to open your gallery.');
    const owner = mine ? req.user.id : req.query.owner;
    if (!uuid.test(owner || '')) fail(400,'Choose a gallery.');
    const args = [owner];
    let clause = ' WHERE p.owner_id=$1' + (mine ? '' : ' AND public');
    if (req.query.cursor) {
      const [time,id] = String(req.query.cursor).split('|');
      if (!uuid.test(id) || !Number.isFinite(Date.parse(time))) fail(400,'Invalid page cursor.');
      args.push(time,id);
      clause += ' AND (p.created_at,p.id)<($2,$3)';
    }
    const {rows} = await db.query(photoSelect+clause+' ORDER BY p.created_at DESC,p.id DESC LIMIT 25',args);
    const page = rows.slice(0,24), last = page.at(-1);
    const username = page[0]?.username ?? (await db.query('SELECT username FROM stillroom.accounts WHERE id=$1',[owner])).rows[0]?.username;
    res.json({username,items:page.map(r=>view(r,req.user?.id)), next:rows.length>24 ? new Date(last.created_at).toISOString()+'|'+last.id : null});
  });
  app.post('/api/draw',signed,async(req,res)=>{
    const day = new Date().toISOString().slice(0,10);
    await db.query(`INSERT INTO stillroom.daily_picks (account_id,day,photo_id)
      SELECT owner_id,$2,id FROM stillroom.photos WHERE owner_id=$1 ORDER BY random() LIMIT 1
      ON CONFLICT (account_id,day) DO NOTHING`,[req.user.id,day]);
    const {rows} = await db.query(photoSelect+' JOIN stillroom.daily_picks d ON d.photo_id=p.id WHERE d.account_id=$1 AND d.day=$2 AND p.owner_id=$1',[req.user.id,day]);
    res.json(rows.length ? view(rows[0],req.user.id) : null);
  });
  app.post('/api/photos',signed,upload,async(req,res)=>{
    if (!['true','false',undefined].includes(req.body?.public)) fail(400,'Choose public or private.');
    res.status(201).json({ids:await photos.upload(req.user.id,req.files,req.body?.public === 'true')});
  });
  app.param('id',(req,res,next,id)=>{ if (!uuid.test(id)) fail(404,'Photo unavailable.'); next(); });
  app.get('/api/photos/:id',async(req,res)=>res.json(view(await photos.read(req.params.id,req.user?.id ?? null),req.user?.id)));
  app.get('/api/photos/:id/media/:variant',async(req,res)=>{
    const v = req.params.variant;
    if (v !== 'source' && !displayVariants.some(({name})=>name===v)) fail(404,'Image unavailable.');
    const row = await photos.read(req.params.id,req.user?.id ?? null,v==='source');
    res.type('image/webp').send(await photos.bytes(row,v));
  });
  app.patch('/api/photos/:id',signed,async(req,res)=>{
    const row = await photos.read(req.params.id,req.user.id,true);
    if (typeof req.body?.public === 'boolean') await db.query('UPDATE stillroom.photos SET public=$1 WHERE id=$2',[req.body.public,row.id]);
    else await photos.save(row,req.body ?? {});
    res.json(view(await photos.read(row.id,req.user.id,true),req.user.id));
  });
  app.delete('/api/photos/:id',signed,async(req,res)=>{
    await photos.remove(await photos.read(req.params.id,req.user.id,true));
    res.sendStatus(204);
  });
  app.use('/api',(req,res)=>res.status(404).json({error:'Unknown endpoint.'}));
  app.use((err,req,res,next)=>{
    const status = err instanceof multer.MulterError ? 400 : err.status || 500;
    if (status >= 500) console.error(err.message);
    res.status(status).json({error:err instanceof multer.MulterError ? 'Choose up to 5 files, at most 10 MB each.' : status>=500 && !err.mailUnavailable ? 'The gallery service is unavailable. Please try again.' : err.message});
  });
  return app;
}
