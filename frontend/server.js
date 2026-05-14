/**
 * server.js — Минималист Node.js static file server
 *
 * Railway-ийн $PORT env-г уншиж static файлуудыг буцаана.
 * Node 20 native (хамаарал байхгүй).
 *
 * Хэрэглэх:
 *   node server.js
 *   PORT=8080 node server.js
 */

// Эртхэн lifecycle лог (stdout-р буфферээс зайлсхийнэ)
process.stdout.write(`[boot] server.js loaded, node=${process.version}, pid=${process.pid}\n`);
process.stdout.write(`[boot] env.PORT=${process.env.PORT}, cwd=${process.cwd()}\n`);

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

process.stdout.write(`[boot] __dirname=${__dirname}, PORT=${PORT}, HOST=${HOST}\n`);

// Crash-уудыг log хийгээд exit
process.on('uncaughtException', (err) => {
  process.stderr.write(`[fatal] uncaughtException: ${err.stack || err}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  process.stderr.write(`[fatal] unhandledRejection: ${err?.stack || err}\n`);
  process.exit(1);
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePath(reqUrl) {
  const urlPath = decodeURIComponent(reqUrl.split('?')[0] || '/');
  const normalized = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  return normalized === '/' ? '/index.html' : normalized;
}

const server = createServer(async (req, res) => {
  const path = safePath(req.url || '/');
  const filePath = join(__dirname, path);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${path}`);
    } else {
      process.stderr.write(`[req error] ${err.stack || err}\n`);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  }
});

server.on('error', (err) => {
  process.stderr.write(`[server error] ${err.stack || err}\n`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`[ready] Frontend server listening on http://${HOST}:${PORT}\n`);
});
