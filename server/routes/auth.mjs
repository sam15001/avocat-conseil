import crypto from 'node:crypto';
import { route } from '../router.mjs';
import { json, redirect, parseCookies, cookie, readJson, str } from '../http.mjs';
import { DISCORD_AUTHORIZE, SITE_URL, IS_HTTPS, getSettings, roleFromDiscordRoles } from '../config.mjs';
import { discordFetch } from '../discord.mjs';
import { sessionCookie, clearSessionCookie, publicUser } from '../session.mjs';
import { all, insert, update, now } from '../store.mjs';

const STATE_COOKIE = 'ac_oauth';
const redirectUri = () => `${SITE_URL()}/api/auth/callback`;
const safeNext = n => (typeof n === 'string' && /^\/[a-zA-Z0-9\-_./?=&%#]*$/.test(n) && !n.startsWith('//')) ? n : '/espace-client.html';

route('GET', '/api/auth/login', async ({ query }) => {
  const state = crypto.randomBytes(24).toString('base64url');
  const next = safeNext(query.get('next'));
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_APPLICATION_ID || '',
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: 'identify guilds.members.read',
    state,
    prompt: 'none'
  });
  return redirect(`${DISCORD_AUTHORIZE()}?${params}`, [
    cookie(STATE_COOKIE, JSON.stringify({ state, next }), { maxAge: 600, secure: IS_HTTPS() })
  ]);
});

route('GET', '/api/auth/callback', async ({ req, query }) => {
  const fail = reason => redirect(`/connexion.html?erreur=${reason}`, [cookie(STATE_COOKIE, '', { maxAge: 0, secure: IS_HTTPS() })]);
  let saved = {};
  try { saved = JSON.parse(parseCookies(req)[STATE_COOKIE] || '{}'); } catch { /* ignore */ }

  if (query.get('error')) return fail('annule');
  const code = query.get('code');
  if (!code || !saved.state || query.get('state') !== saved.state) return fail('etat');

  const tokenRes = await discordFetch('/oauth2/token', {
    method: 'POST', bot: false,
    form: {
      client_id: process.env.DISCORD_APPLICATION_ID || '',
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri()
    }
  });
  if (!tokenRes.ok) { console.error('[oauth] token', tokenRes.status, tokenRes.data); return fail('discord'); }
  const accessToken = tokenRes.data.access_token;

  const me = await discordFetch('/users/@me', { bot: false, token: accessToken });
  if (!me.ok) return fail('discord');

  const settings = await getSettings({ fresh: true });
  let discordRole = 0, nick = null;
  if (process.env.DISCORD_GUILD_ID) {
    const member = await discordFetch(`/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, { bot: false, token: accessToken });
    if (member.ok) {
      discordRole = roleFromDiscordRoles(member.data.roles || [], settings);
      nick = typeof member.data.nick === 'string' && member.data.nick.trim() ? member.data.nick.trim().slice(0, 80) : null;
    } else if (process.env.DISCORD_REQUIRE_MEMBER !== 'false') {
      return fail('serveur');
    }
  }

  const d = me.data;
  const users = await all('users');
  const existing = users.find(u => u.discord_id === d.id);
  const fields = { discord_id: d.id, username: d.username, global_name: d.global_name || null, avatar: d.avatar || null, discord_role: discordRole, last_login: now() };
  let user;
  // Pseudo sur le serveur du cabinet = nom RP, tant que la personne n'a pas choisi le sien sur le site
  if (nick && !existing?.rp_name) fields.rp_name = nick;
  if (existing) { await update('users', existing.id, fields); user = { ...existing, ...fields }; }
  else user = await insert('users', fields);

  if (user.disabled) return fail('desactive');

  // Premier compte du site : direction automatique (permet de configurer le site)
  if (!existing && !users.some(u => !String(u.discord_id).startsWith('sans-discord-')) && user.site_role < 3) {
    await update('users', user.id, { site_role: 3 });
  }

  return redirect(safeNext(saved.next), [
    sessionCookie(user.id),
    cookie(STATE_COOKIE, '', { maxAge: 0, secure: IS_HTTPS() })
  ]);
});

route('POST', '/api/auth/logout', async () => json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() }));

route('GET', '/api/me', async ({ user }) => json({ user: publicUser(user) }));

route('PATCH', '/api/me', async ({ req, user }) => {
  const b = await readJson(req);
  const rp = str(b.rp_name, 'Nom RP', { max: 80, optional: true });
  const phone = str(b.phone, 'Téléphone', { max: 30, optional: true });
  await update('users', user.id, { rp_name: rp, phone });
  return json({ ok: true });
}, { auth: 'user' });
