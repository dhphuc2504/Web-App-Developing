import { env } from './config/env.js';
import { createDatabase } from './config/database.js';
import { PrismaSessionStore } from './models/session-store.js';
import { createApp } from './app.js';
const db=createDatabase(env.DATABASE_URL),store=new PrismaSessionStore(db);
try {
 await db.$connect();
 await db.staffUser.count();
 const app=createApp({db,store,config:env});
 const server=app.listen(env.PORT,'127.0.0.1',()=>console.log(`Restaurant running at http://localhost:${env.PORT}`));
 const cleanup=setInterval(()=>store.prune().catch(()=>{}),60*60*1000);cleanup.unref();
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{clearInterval(cleanup);await db.$disconnect();process.exit(0);}));
} catch { console.error('Startup failed. Check database connectivity and run npm run db:deploy. Credentials are never printed.');await db.$disconnect();process.exit(1); }
