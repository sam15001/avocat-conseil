import { json, HttpError, fail } from './http.mjs';
import { currentUser } from './session.mjs';
import { withCache } from './store.mjs';
import { ensureSeeded } from './seed.mjs';

const routes = [];

// auth : null (public), 'user' (connecté), ou un niveau de rôle minimum (1, 2, 3)
export function route(method, path, handler, { auth = null } = {}) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handler, auth });
}

export const handle = req => withCache(() => handleInner(req));

async function handleInner(req) {
  const url = new URL(req.url);
  // Normalise /.netlify/functions/api/xxx et /api/xxx
  let path = url.pathname.replace(/^\/\.netlify\/functions\/api/, '/api');
  if (!path.startsWith('/api')) path = '/api' + path;

  try {
    // Protection CSRF : les requêtes qui modifient des données doivent venir du site (fetch avec en-tête dédié)
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('x-requested-with') !== 'avocat-conseil') {
      fail(403, 'Requête refusée.');
    }
    await ensureSeeded();
    let matchedPath = false;
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      matchedPath = true;
      if (r.method !== req.method) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      let user = null;
      if (r.auth !== null || path === '/api/me') user = await currentUser(req);
      else user = await currentUser(req).catch(() => null);
      if (r.auth !== null) {
        if (!user) fail(401, 'Connexion requise.');
        if (typeof r.auth === 'number' && user.role < r.auth) fail(403, "Vous n'avez pas accès à cette section.");
      }
      return await r.handler({ req, url, params, user, query: url.searchParams });
    }
    fail(matchedPath ? 405 : 404, matchedPath ? 'Méthode non autorisée.' : 'Route inconnue.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('[api]', req.method, path, e);
    return json({ error: 'Erreur interne. Réessayez dans un instant.' }, 500);
  }
}
