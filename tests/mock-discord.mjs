// Faux serveur Discord pour les tests locaux (OAuth2, membres, messages du bot).
import http from 'node:http';

const PORT = 9999;
const SITE = process.env.SITE_URL || 'http://localhost:8888';
const R = { avocat: '400000000000000001', responsable: '400000000000000002', direction: '400000000000000003' };
const USERS = {
  direction:   { id: '500000000000000001', username: 'directrice', global_name: 'Eleanor Vance', roles: [R.direction] },
  citoyen:     { id: '500000000000000002', username: 'tony_m', global_name: 'Tony Moretti', roles: [] },
  citoyen2:    { id: '500000000000000003', username: 'lucia', global_name: 'Lucia Reyes', nick: 'Lucia Castellano', roles: [] },
  avocat1:     { id: '500000000000000004', username: 'harvey', global_name: 'Harvey Collins', roles: [R.avocat] },
  avocat2:     { id: '500000000000000005', username: 'nadia', global_name: 'Nadia Okafor', roles: [R.avocat] },
  responsable: { id: '500000000000000006', username: 'marcus', global_name: 'Marcus Hale', roles: [R.responsable] },
  citoyen3:    { id: '500000000000000008', username: 'jade', global_name: 'Jade Morel', roles: [] },
  outsider:    { id: '500000000000000007', username: 'random', global_name: 'Random', roles: null }
};
let nextUser = 'citoyen';
const messages = [];

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const userFromAuth = req => USERS[(req.headers.authorization || '').replace('Bearer ', '')];

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  for await (const c of req) body += c;
  const p = url.pathname.replace('/api/v10', '');

  if (p === '/mock/next-user' && req.method === 'POST') { nextUser = JSON.parse(body).user; return send(res, 200, { ok: true }); }
  if (p === '/mock/messages') { if (req.method === 'DELETE') messages.length = 0; return send(res, 200, messages); }
  if (p === '/oauth2/authorize') {
    const state = url.searchParams.get('state');
    res.writeHead(302, { location: `${url.searchParams.get('redirect_uri')}?code=${nextUser}&state=${state}` });
    return res.end();
  }
  if (p === '/oauth2/token' && req.method === 'POST') {
    const f = new URLSearchParams(body);
    if (f.get('client_secret') !== 'test-secret' || !USERS[f.get('code')]) return send(res, 400, { error: 'invalid_grant' });
    if (f.get('redirect_uri') !== `${SITE}/api/auth/callback`) return send(res, 400, { error: 'invalid_redirect' });
    return send(res, 200, { access_token: f.get('code'), token_type: 'Bearer' });
  }
  if (p === '/users/@me' && req.method === 'GET') {
    const u = userFromAuth(req); if (!u) return send(res, 401, {});
    return send(res, 200, { id: u.id, username: u.username, global_name: u.global_name, avatar: null });
  }
  if (/^\/users\/@me\/guilds\/\d+\/member$/.test(p)) {
    const u = userFromAuth(req); if (!u) return send(res, 401, {});
    if (!u.roles) return send(res, 404, { message: 'Unknown Guild' });
    return send(res, 200, { roles: u.roles, nick: u.nick ?? null, user: { id: u.id } });
  }
  // Réponse différée d'une interaction (aucune authentification, comme chez Discord)
  const wh = p.match(/^\/webhooks\/\d+\/([\w-]+)\/messages\/@original$/);
  if (wh && req.method === 'PATCH') { messages.push({ channel: 'webhook:' + wh[1], ...JSON.parse(body) }); return send(res, 200, { id: 'orig' }); }
  if (req.headers.authorization !== 'Bot test-bot-token') return send(res, 401, { message: '401: Unauthorized' });
  if (p === '/applications/@me') return send(res, 200, { id: process.env.MOCK_APP_ID || '100000000000000001', name: 'Bot de test', verify_key: process.env.MOCK_VERIFY_KEY || '', interactions_endpoint_url: `${SITE}/api/discord/interactions` });
  if (p === '/users/@me/channels' && req.method === 'POST') return send(res, 200, { id: 'dm-' + JSON.parse(body).recipient_id });
  if (/^\/applications\/\d+\/guilds\/\d+\/commands$/.test(p) && req.method === 'PUT') return send(res, 200, JSON.parse(body).map((c, i) => ({ id: String(900 + i), ...c })));
  const m = p.match(/^\/channels\/([\w-]+)\/messages$/);
  if (m && req.method === 'POST') {
    if (String(req.headers['content-type'] || '').startsWith('multipart/form-data')) {
      // Message avec fichier : payload_json + fichier joint
      const pj = body.match(/name="payload_json"\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([\s\S]*?)\r\n--/);
      const fn = body.match(/name="files\[0\]"; filename="([^"]+)"/);
      const file = { filename: fn?.[1] || null, pdf: body.includes('%PDF-'), size: body.length };
      messages.push({ channel: m[1], ...JSON.parse(pj ? pj[1] : '{}'), file });
    } else messages.push({ channel: m[1], ...JSON.parse(body) });
    return send(res, 200, { id: String(messages.length) });
  }
  send(res, 404, { message: 'not mocked ' + p });
}).listen(PORT, () => console.log('mock discord :' + PORT));
