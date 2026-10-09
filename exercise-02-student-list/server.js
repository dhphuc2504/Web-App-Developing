import express from 'express';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const app = createApp({ dataFile: process.env.STUDENTS_FILE });
const server = createServer(app);
const development = process.env.NODE_ENV === 'development';
let vite;
if (development) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'custom' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(fileURLToPath(new URL('./dist', import.meta.url))));
}
app.get(['/', '/Student', '/Classroom'], async (req, res, next) => {
  try {
    const path = new URL(development ? './client/index.html' : './dist/index.html', import.meta.url);
    let html = await readFile(path, 'utf8');
    if (vite) html = await vite.transformIndexHtml(req.originalUrl, html);
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  } catch (error) { next(error); }
});
app.use((_req, res) => res.status(404).send('Page not found. Visit /Student or /Classroom.'));
app.use((error, _req, res, _next) => { console.error(error); res.status(500).send('Unable to load the React app. Run npm run build before starting.'); });
const port = process.env.PORT || 3000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the old server, or set PORT to another port.` : error);
  process.exit(1);
});
server.listen(port, () => console.log(`React Student List: http://localhost:${port}/Student`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  await vite?.close();
  server.close(() => process.exit(0));
});
