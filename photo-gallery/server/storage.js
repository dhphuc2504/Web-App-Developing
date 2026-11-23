import { spawn } from 'node:child_process';

// mc authenticates directly to MinIO. No object keys or bucket credentials go to the browser.
export function minioStore(env = process.env) {
  const url = new URL(env.MINIO_ENDPOINT || 'http://localhost:9000');
  if (!env.MINIO_USER || !env.MINIO_PASSWORD) throw new Error('Set MINIO_USER and MINIO_PASSWORD.');
  url.username = env.MINIO_USER;
  url.password = env.MINIO_PASSWORD;
  const bucket = 'store/' + (env.MINIO_BUCKET || 'stillroom');
  function run(args, input) {
    return new Promise((resolve, reject) => {
      const child = spawn(env.MC_BINARY || 'mc', args, {env:{...process.env, MC_HOST_store:url.href}});
      const output = [];
      child.stdout.on('data', b => output.push(b));
      child.stderr.resume();
      child.once('error', reject);
      child.stdin.on('error', () => {});
      child.once('close', code => code === 0 ? resolve(Buffer.concat(output)) : reject(new Error('MinIO operation failed: ' + args[0])));
      child.stdin.end(input);
    });
  }
  return {
    init: () => run(['mb','--ignore-existing',bucket]),
    put: (key, bytes) => run(['pipe',bucket+'/'+key], bytes),
    get: key => run(['cat',bucket+'/'+key]),
    remove: key => run(['rm','--force',bucket+'/'+key])
  };
}
