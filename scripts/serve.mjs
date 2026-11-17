// A tiny static file server for trying the app locally: npm run serve, then open http://localhost:5173/app/?emulator
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// root: the folder to serve (default: the repository). prefix: serve it under a path such as '/lifecentre-app' (like GitHub Pages does).
export function serve(port = 5173, { root = ROOT, prefix = '' } = {}) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (prefix) {
        path = path.replaceAll('\\', '/');
        if (path !== prefix && !path.startsWith(prefix + '/')) throw new Error('outside the prefix');
        path = path.slice(prefix.length) || '/';
      }
      if (path.endsWith('\\') || path.endsWith('/')) path = join(path, 'index.html');
      const file = join(base, path);
      if (!file.startsWith(base) || /node_modules|[\\/]\.git[\\/]/.test(file)) throw new Error('blocked');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((done) => server.listen(port, '127.0.0.1', () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serve();
  console.log('Serving http://localhost:5173/app/?emulator');
}
