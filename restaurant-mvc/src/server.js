import { env } from './config/env.js';
import { createDatabase } from './config/database.js';
import { PrismaSessionStore } from './models/session-store.js';
import { createApp } from './app.js';
import { listenForStartup, startupFailureMessage } from './lib/startup.js';
import { installShutdown } from './lib/shutdown.js';
let db;
try {
 console.log('Starting Santaishi-tei: checking database connectivity...');
 db=createDatabase(env.DATABASE_URL);
 const store=new PrismaSessionStore(db);
 await db.$connect();
 await db.staffUser.count();
 const app=createApp({db,store,config:env});
 const server=await listenForStartup(app,env.PORT);
 console.log(`Restaurant running at http://localhost:${env.PORT}`);
 const cleanup=setInterval(()=>store.prune().catch(()=>{}),60*60*1000);cleanup.unref();
 installShutdown({server,db,cleanup});
} catch(error) {
 console.error(startupFailureMessage(error,env.PORT));
 if(db)await db.$disconnect().catch(()=>{});
 process.exit(1);
}
