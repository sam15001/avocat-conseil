// Faux Firebase Realtime Database (API REST) pour les tests locaux.
// Reproduit : GET/PUT/PATCH/DELETE en .json, ?auth=, ETag + if-match (412),
// suppression des null, et conversion en tableau des clés entières consécutives.
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_FIREBASE_PORT || 9998);
const SECRET = process.env.MOCK_FIREBASE_SECRET || 'test-firebase-secret';
let root = {};

const seg = p => p.replace(/\.json$/, '').split('/').filter(Boolean).map(decodeURIComponent);
const isObj = v => v && typeof v === 'object';

function prune(v) {
  if (Array.isArray(v)) v = Object.fromEntries(v.map((x, i) => [i, x]));
  if (!isObj(v)) return v === undefined ? null : v;
  const out = {};
  for (const [k, x] of Object.entries(v)) { const p = prune(x); if (p !== null && !(isObj(p) && !Object.keys(p).length)) out[k] = p; }
  return Object.keys(out).length ? out : null;
}
// Firebase renvoie un tableau si toutes les clés sont des entiers et que plus de la moitié des cases 0..max sont remplies
function render(v) {
  if (!isObj(v)) return v;
  const keys = Object.keys(v);
  const out = Object.fromEntries(keys.map(k => [k, render(v[k])]));
  if (keys.every(k => /^(0|[1-9]\d*)$/.test(k))) {
    const max = Math.max(...keys.map(Number));
    if (keys.length > max / 2) { const arr = Array(max + 1).fill(null); for (const k of keys) arr[k] = out[k]; return arr; }
  }
  return out;
}
const getAt = path => path.reduce((n, k) => (isObj(n) ? n[k] : undefined), root) ?? null;
function setAt(path, value) {
  value = prune(value);
  if (!path.length) { root = value || {}; return; }
  let n = root;
  for (const k of path.slice(0, -1)) { if (!isObj(n[k])) n[k] = {}; n = n[k]; }
  if (value === null) delete n[path.at(-1)]; else n[path.at(-1)] = value;
  root = prune(root) || {};
}
const etag = v => crypto.createHash('sha1').update(JSON.stringify(v ?? null)).digest('base64');

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  for await (const c of req) body += c;
  const send = (status, v, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(v ?? null)); };

  if (url.pathname === '/__reset' && req.method === 'POST') { root = {}; return send(200, { ok: true }); }
  if (url.pathname === '/__dump') return send(200, root);
  if (!url.pathname.endsWith('.json')) return send(404, { error: '404 Not Found' });
  if (url.searchParams.get('auth') !== SECRET && url.searchParams.get('access_token') !== 'mock-access-token') return send(401, { error: 'Permission denied' });

  const path = seg(url.pathname);
  const current = getAt(path);
  const ifMatch = req.headers['if-match'];
  if (ifMatch && ifMatch !== etag(render(current))) return send(412, render(current), { etag: etag(render(current)) });

  if (req.method === 'GET') return send(200, render(current), req.headers['x-firebase-etag'] ? { etag: etag(render(current)) } : {});
  const data = body ? JSON.parse(body) : null;
  if (req.method === 'PUT') { setAt(path, data); return send(200, data); }
  if (req.method === 'PATCH') {
    for (const [k, v] of Object.entries(data || {})) setAt([...path, ...k.split('/').filter(Boolean)], v);
    return send(200, data);
  }
  if (req.method === 'DELETE') { setAt(path, null); return send(200, null); }
  send(405, { error: 'method' });
}).listen(PORT, () => console.log('mock firebase :' + PORT));
