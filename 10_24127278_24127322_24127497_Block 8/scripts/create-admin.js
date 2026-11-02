import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { env } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { createRepository } from '../src/models/repository.js';
import { createAuthService } from '../src/services/auth-service.js';
let muted=false;
const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk);done();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
const db=createDatabase(env.DATABASE_URL);
try {
 const displayName=await rl.question('Admin name: '),email=await rl.question('Admin email: ');
 process.stdout.write('Password (12+ characters, hidden): ');muted=true;
 const password=await rl.question('');muted=false;process.stdout.write('\n');
 await createAuthService(createRepository(db)).createInitialAdmin({displayName,email,password});
 console.log('Initial admin created.');
} catch { console.error('Admin creation failed. Check inputs and database setup.');process.exitCode=1; }
finally {muted=false;rl.close();await db.$disconnect();}
