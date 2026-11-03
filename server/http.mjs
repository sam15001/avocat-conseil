// Outils HTTP communs (Web Request/Response, Node 20+)

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const fail = (status, message) => { throw new HttpError(status, message); };

export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (Array.isArray(v)) v.forEach(x => headers.append(k, x)); else headers.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function redirect(location, cookies = []) {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  cookies.forEach(c => headers.append('set-cookie', c));
  return new Response(null, { status: 302, headers });
}

export function parseCookies(req) {
  const out = {};
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, httpOnly = true, secure = true, sameSite = 'Lax', path = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  return c;
}

export async function readJson(req, maxBytes = 26 * 1024 * 1024) {
  const text = await req.text();
  if (text.length > maxBytes) fail(413, 'Requête trop volumineuse.');
  if (!text) return {};
  try { return JSON.parse(text); } catch { fail(400, 'Corps de requête invalide.'); }
}

// Validation simple
export function str(v, field, { min = 1, max = 2000, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    fail(400, `Le champ « ${field} » est obligatoire.`);
  }
  if (typeof v !== 'string') fail(400, `Le champ « ${field} » est invalide.`);
  const s = v.trim();
  if (s.length < min) fail(400, `Le champ « ${field} » est trop court.`);
  if (s.length > max) fail(400, `Le champ « ${field} » dépasse ${max} caractères.`);
  return s;
}

export function int(v, field, { optional = false } = {}) {
  if ((v === undefined || v === null || v === '') && optional) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) fail(400, `Le champ « ${field} » est invalide.`);
  return n;
}
