// Small self-hosted server: serves the app from public/ and, when
// APP_PASSWORD is set, a sync API that keeps tasks in a JSON file.
// No dependencies beyond Node itself.

import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanData, isValidVersion, validateData } from '../public/js/state.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY_BYTES = 1024 * 1024;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

function sha256(text) {
  return createHash('sha256').update(text).digest();
}

// Stores state in one JSON file, written atomically (temp file + rename).
// Writes are serialized so concurrent requests can't interleave.
export function createFileStore(file) {
  let queue = Promise.resolve();

  async function read() {
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'));
      if (validateData(parsed) === null && isValidVersion(parsed.version)) {
        return { ...cleanData(parsed), version: parsed.version };
      }
      console.error(`Ignoring malformed data in ${file}`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return { tasks: [], history: [], version: 0 };
  }

  async function write(state) {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, file);
  }

  return {
    read,
    // Runs `fn(current)` under the write lock; if it returns a state, that is saved.
    update(fn) {
      const run = queue.then(async () => {
        const current = await read();
        const result = await fn(current);
        if (result?.save) await write(result.save);
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

export function createApp({ password, dataFile, publicDir = path.join(ROOT, 'public') }) {
  const store = createFileStore(dataFile);
  const passwordHash = password ? sha256(password) : null;

  function isAuthorized(req) {
    const header = req.headers.authorization ?? '';
    if (!passwordHash || !header.startsWith('Bearer ')) return false;
    // Compare hashes so the check takes the same time whatever the input length.
    return timingSafeEqual(sha256(header.slice('Bearer '.length)), passwordHash);
  }

  function send(res, status, body, headers = {}) {
    const isJson = typeof body !== 'string';
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    });
    res.end(isJson ? JSON.stringify(body) : body);
  }

  async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Body too large'), { status: 413 });
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw Object.assign(new Error('Invalid JSON'), { status: 400 });
    }
  }

  async function handleApi(req, res, route) {
    if (route === 'health' && req.method === 'GET') {
      return send(res, 200, { ok: true, sync: Boolean(passwordHash) });
    }
    if (route !== 'state') return send(res, 404, { error: 'Not found' });
    if (!passwordHash) return send(res, 503, { error: 'Sync is off. Set APP_PASSWORD to turn it on.' });
    if (!isAuthorized(req)) return send(res, 401, { error: 'Unauthorized' }, { 'WWW-Authenticate': 'Bearer' });

    if (req.method === 'GET') return send(res, 200, await store.read());

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const error = validateData(body);
      if (error) return send(res, 400, { error });
      if (!isValidVersion(body.baseVersion)) return send(res, 400, { error: 'baseVersion must be a non-negative integer' });

      const result = await store.update(current => {
        if (current.version !== body.baseVersion) return { conflict: current };
        return { save: { ...cleanData(body), version: current.version + 1 } };
      });
      if (result.conflict) return send(res, 409, { error: 'Conflict', state: result.conflict });
      return send(res, 200, { version: result.save.version });
    }

    return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, PUT' });
  }

  async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    let relative;
    try {
      relative = decodeURIComponent(pathname);
    } catch {
      return send(res, 400, 'Bad request');
    }
    if (relative.endsWith('/')) relative += 'index.html';
    const filePath = path.resolve(publicDir, `.${relative}`);
    if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) return send(res, 404, 'Not found');

    let info;
    try {
      info = await stat(filePath);
    } catch {
      return send(res, 404, 'Not found');
    }
    if (!info.isFile()) return send(res, 404, 'Not found');

    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // Always revalidate so updates show up straight away.
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(filePath).pipe(res);
  }

  return createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname.slice('/api/'.length));
      return await serveStatic(req, res, pathname);
    } catch (err) {
      if (err.status) return send(res, err.status, { error: err.message });
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'Internal error' });
      else res.destroy();
    }
  });
}

// Run directly: `node server/server.js`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '127.0.0.1';
  const dataFile = path.resolve(process.env.DATA_FILE ?? path.join(ROOT, 'data', 'state.json'));
  const password = process.env.APP_PASSWORD ?? '';

  if (!password) console.warn('APP_PASSWORD is not set: serving the app without sync.');
  else if (password.length < 12) console.warn('APP_PASSWORD is short; use at least 12 characters.');

  createApp({ password, dataFile }).listen(port, host, () => {
    console.log(`Decision Randomizer on http://${host}:${port} (data: ${dataFile})`);
  });
}
