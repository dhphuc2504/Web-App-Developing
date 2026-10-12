// Capture CLI output so connection strings and engine errors never reach the terminal.
import { spawn } from 'node:child_process';
const args=process.argv.slice(2);
const child=spawn(process.execPath,['node_modules/prisma/build/index.js',...args],{stdio:['ignore','pipe','pipe'],env:{...process.env,DOTENV_CONFIG_QUIET:'true'}});
let output='';
child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
child.on('error',()=>{console.error('Unable to start Prisma. Install dependencies first.');process.exitCode=1;});
child.on('close',code=>{
 if(code===0)console.log(`Prisma ${args.join(' ')} completed.`);
 else {const codeOnly=output.match(/\bP\d{4}\b/)?.[0];console.error(`Prisma command failed${codeOnly?` (${codeOnly})`:''}. Check configuration, connectivity, and schema. Detailed output is suppressed to protect credentials.`);}
 process.exitCode=code || 0;
});
