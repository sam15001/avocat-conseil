import crypto from 'node:crypto';
import { parseCookies, cookie } from './http.mjs';
import { IS_HTTPS } from './config.mjs';
import { get } from './store.mjs';

export const SESSION_COOKIE = 'ac_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum)');
  return s;
}

const b64 = buf => Buffer.from(buf).toString('base64url');

export function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return data;
  } catch { return null; }
}

export function sessionCookie(userId) {
  const token = sign({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  return cookie(SESSION_COOKIE, token, { maxAge: MAX_AGE, secure: IS_HTTPS() });
}

export function clearSessionCookie() {
  return cookie(SESSION_COOKIE, '', { maxAge: 0, secure: IS_HTTPS() });
}

// Utilisateur courant + rôle effectif (le plus élevé entre Discord et le site)
export async function currentUser(req) {
  const data = verify(parseCookies(req)[SESSION_COOKIE]);
  if (!data) return null;
  const base = await get('users', data.uid);
  if (!base) return null;
  const lawyer = await get('lawyers', base.id);
  const ref = base.referent_lawyer_id ? await get('lawyers', base.referent_lawyer_id) : null;
  const u = { ...base, role: Math.max(base.discord_role || 0, base.site_role || 0), is_lawyer: !!(lawyer && lawyer.active),
              referent_name: ref?.display_name ?? null, referent_active: !!ref?.active };
  if (!u || u.disabled) return null;
  return u;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    discord_id: u.discord_id,
    username: u.username,
    name: u.global_name || u.username,
    avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png?size=128` : null,
    role: u.role,
    is_lawyer: !!u.is_lawyer,
    rp_name: u.rp_name,
    phone: u.phone,
    referent: u.referent_lawyer_id ? { id: u.referent_lawyer_id, name: u.referent_name, active: !!u.referent_active } : null,
    created_at: u.created_at
  };
}
