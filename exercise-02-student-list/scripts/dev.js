// Watch only backend source. Vite handles frontend updates and its own cache.
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let child;
let timer;
let stopping = false;
let restarting = false;
function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
  child.on('error', error => { console.error(error); shutdown(1); });
  child.on('exit', code => {
    if (stopping) process.exit(code || 0);
    if (restarting) { restarting = false; start(); }
    else shutdown(code || 0);
  });
}
function restart() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (stopping || restarting) return;
    console.log('Backend source changed; restarting…');
    restarting = true;
    child.kill('SIGTERM');
  }, 150);
}
const watchers = [
  watch(root, (_event, filename) => {
    if (['server.js', 'app.js', 'vite.config.js'].includes(String(filename))) restart();
  }),
  ...['controllers', 'routes', 'models', 'validation'].map(path => watch(new URL('../' + path, import.meta.url), (_event, filename) => {
    if (String(filename).endsWith('.js')) restart();
  })),
];
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true; clearTimeout(timer); watchers.forEach(watcher => watcher.close());
  if (child?.exitCode === null) child.kill('SIGTERM');
  else process.exit(code);
}
process.on('SIGINT', () => shutdown()); process.on('SIGTERM', () => shutdown());
start();
