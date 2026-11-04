import { json, HttpError, fail } from './http.mjs';
import { currentUser } from './session.mjs';
import { withCache, rtdb } from './store.mjs';
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
    if (path === '/api/diagnostic' && req.method === 'GET') return await diagnostic();
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

// Page de diagnostic publique : indique ce qui manque, sans jamais afficher de secret
async function diagnostic() {
  const E = k => Boolean((process.env[k] || '').trim());
  const out = { variables: {}, tests: {} };
  for (const k of ['SITE_URL', 'SESSION_SECRET', 'FIREBASE_DATABASE_URL', 'DISCORD_APPLICATION_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_PUBLIC_KEY', 'DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID'])
    out.variables[k] = E(k) ? 'ok' : 'MANQUANTE';
  out.variables.FIREBASE_AUTH = E('FIREBASE_DATABASE_SECRET') ? 'secret ok' : (E('FIREBASE_CLIENT_EMAIL') && E('FIREBASE_PRIVATE_KEY')) ? 'compte de service ok' : 'MANQUANTE (FIREBASE_DATABASE_SECRET)';
  const ss = process.env.SESSION_SECRET || '';
  if (ss && ss.length < 32) out.variables.SESSION_SECRET = `TROP COURTE (${ss.length} caractères, 32 minimum)`;
  const su = (process.env.SITE_URL || '').trim();
  if (su && !/^https:\/\/[^/]+\/?$/.test(su)) out.variables.SITE_URL = `INCORRECTE (« ${su} ») : mettez https://votre-site.netlify.app sans rien après`;
  const fu = ((process.env.FIREBASE_DATABASE_URL || '').match(/https?:\/\/[^\s"'\/]+/) || [''])[0];
  if (!fu && E('FIREBASE_DATABASE_URL')) out.variables.FIREBASE_DATABASE_URL = 'INCORRECTE : la valeur doit commencer par https://';
  if (fu && !/^https:\/\/[^/]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(fu)) out.variables.FIREBASE_DATABASE_URL = `INCORRECTE (« ${fu} ») : copiez l'URL affichée en haut de Realtime Database`;
  try { await rtdb.get('meta/seeded'); out.tests.firebase = 'ok'; }
  catch (e) { out.tests.firebase = 'ÉCHEC : ' + String(e.message).replace(/(auth|access_token)=[^&\s"']+/g, '$1=***'); }
  // Discord : application, clé publique et adresse des commandes (sans jamais afficher de secret)
  if (E('DISCORD_BOT_TOKEN')) {
    try {
      const r = await fetch(`${process.env.DISCORD_API_BASE || 'https://discord.com/api/v10'}/applications/@me`, { headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
      const app = await r.json().catch(() => ({}));
      if (!r.ok) out.tests.discord_bot = `ÉCHEC (${r.status}) : DISCORD_BOT_TOKEN refusé par Discord`;
      else {
        const expected = (su.replace(/\/$/, '') || '') + '/api/discord/interactions';
        out.tests.discord_bot = `ok (${app.name})`;
        out.tests.discord_application_id = app.id === (process.env.DISCORD_APPLICATION_ID || '').trim() ? 'ok' : 'DIFFÉRENT : le bot et DISCORD_APPLICATION_ID ne viennent pas de la même application';
        out.tests.discord_public_key = (app.verify_key || '') === (process.env.DISCORD_PUBLIC_KEY || '').trim() ? 'ok' : 'DIFFÉRENTE : copiez la Public Key de General Information dans DISCORD_PUBLIC_KEY';
        out.tests.discord_interactions_url = !app.interactions_endpoint_url ? `MANQUANTE : collez ${expected} dans General Information → Interactions Endpoint URL`
          : app.interactions_endpoint_url === expected ? 'ok' : `DIFFÉRENTE (« ${app.interactions_endpoint_url} ») : mettez ${expected}`;
      }
    } catch (e) { out.tests.discord_bot = 'ÉCHEC : Discord injoignable'; }
  }
  out.redirect_uri_a_declarer_dans_discord = (su.replace(/\/$/, '') || '(SITE_URL manquante)') + '/api/auth/callback';
  return json(out, 200, { 'cache-control': 'no-store' });
}
