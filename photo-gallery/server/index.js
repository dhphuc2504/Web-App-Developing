import pg from 'pg';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { appFor } from './app.js';
import { minioStore } from './storage.js';
import { seed } from './seed.js';
import { sweep, upgradeDisplayVariants } from './photos.js';

const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const db = {
  query:(...args)=>pool.query(...args),
  async transaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
};
const store = minioStore();
for (let i=0;;i++) {
  try { await db.query('SELECT 1'); await store.init(); break; }
  catch(e) { if (i>=29) throw e; await delay(1000); }
}
await db.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
await upgradeDisplayVariants(db,store);
if (process.env.SEED_DEMO === 'true') await seed(db,store);
const app = appFor(db,store);
const dist = fileURLToPath(new URL('../dist/',import.meta.url));
app.use(express.static(dist));
app.get('/{*path}',(req,res)=>res.sendFile(dist+'index.html'));
app.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('Stillroom is ready.'));
let cleaning = false;
setInterval(async()=>{
  if (cleaning) return;
  cleaning = true;
  try { await sweep(db,store); await db.query('DELETE FROM stillroom.sessions WHERE expires <= now()'); }
  catch(e) { console.error('Cleanup will retry:',e.message); }
  finally { cleaning=false; }
},30000).unref();
