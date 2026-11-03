// Accès à Firebase Realtime Database par son API REST (aucune librairie).
// Arborescence :
//   /tables/<table>/<id>        lignes (users, lawyers, cases, appointments, services, news, applications, contact_messages)
//   /tables/settings/<clé>      paramètres Discord modifiables
//   /availability/<avocat>      plages de réception d'un avocat
//   /events/<dossier>/<id>      historique d'un dossier
//   /notes/<dossier>/<id>       notes internes (jamais renvoyées à un citoyen)
//   /documents/<dossier>/<id>   métadonnées des pièces jointes
//   /blobs/documents/<id>       contenu des pièces jointes (base64)
//   /blobs/photos/<avocat>      photos des avocats (base64)
//   /counters/<nom>             compteurs (identifiants, numéros de dossier)
//   /locks/slots/<clé>          un créneau = un seul rendez-vous actif
// Règles Firebase à appliquer : { "rules": { ".read": false, ".write": false } } — seul le serveur y accède.
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const env = k => (process.env[k] || '').trim();
const baseUrl = () => {
  const u = env('FIREBASE_DATABASE_URL').replace(/\/$/, '');
  if (!u) throw new Error('FIREBASE_DATABASE_URL manquant');
  return u;
};

// ── Authentification : secret de base de données (le plus simple) ou compte de service
let token = null, tokenExp = 0;
async function authParam() {
  if (env('FIREBASE_DATABASE_SECRET')) return 'auth=' + encodeURIComponent(env('FIREBASE_DATABASE_SECRET'));
  const email = env('FIREBASE_CLIENT_EMAIL'), key = env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('FIREBASE_DATABASE_SECRET, ou FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, manquant');
  if (token && Date.now() < tokenExp - 60000) return 'access_token=' + token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
  })}`;
  const jwt = `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
  const res = await fetch(process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('Connexion Firebase refusée : vérifiez FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY');
  token = data.access_token; tokenExp = Date.now() + (data.expires_in || 3600) * 1000;
  return 'access_token=' + token;
}

const clean = p => String(p).split('/').filter(Boolean).map(s => encodeURIComponent(s)).join('/');
const urlFor = async path => `${baseUrl()}/${clean(path)}${clean(path) ? '' : ''}.json?${await authParam()}`;

async function call(method, path, { body, headers = {} } = {}) {
  const url = await urlFor(path);
  const res = await fetch(url, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 412) return { conflict: true, etag: res.headers.get('etag'), value: await res.json().catch(() => null) };
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Firebase a refusé l’accès : vérifiez FIREBASE_DATABASE_SECRET (ou le compte de service) et FIREBASE_DATABASE_URL');
    if (res.status === 404) throw new Error('Base Firebase introuvable : vérifiez FIREBASE_DATABASE_URL');
    throw new Error(`Firebase ${method} ${path} → ${res.status} ${t.slice(0, 200)}`);
  }
  return { etag: res.headers.get('etag'), value: res.status === 204 ? null : await res.json() };
}

export const rtdb = {
  get: async path => (await call('GET', path)).value,
  put: (path, value) => call('PUT', path, { body: value, headers: { 'x-firebase-etag': 'true' } }).then(() => value),
  // Plusieurs chemins d'un coup, relatifs à `path` : { 'tables/cases/4/status': 'rdv', ... }. null supprime.
  patch: (path, values) => call('PATCH', path, { body: values }),
  del: path => call('DELETE', path),
  // Transaction optimiste : fn(valeurActuelle) → nouvelle valeur, ou undefined pour abandonner
  async txn(path, fn, tries = 30) {
    let { etag, value } = await call('GET', path, { headers: { 'x-firebase-etag': 'true' } });
    for (let i = 0; i < tries; i++) {
      const next = fn(value);
      if (next === undefined) return { committed: false, value };
      const r = await call('PUT', path, { body: next, headers: { 'if-match': etag } });
      if (!r.conflict) return { committed: true, value: next };
      etag = r.etag; value = r.value;
      await new Promise(ok => setTimeout(ok, 10 + Math.random() * 40 * Math.min(i + 1, 5)));
    }
    throw new Error('Trop de modifications simultanées, réessayez.');
  }
};

// ── Cache par requête (une table lue une fois par appel d'API)
const als = new AsyncLocalStorage();
export const withCache = fn => als.run(new Map(), fn);
const cache = () => als.getStore();
const forget = key => { const c = cache(); if (!c) return; for (const k of [...c.keys()]) if (k === key || k.startsWith(key + '/')) c.delete(k); };

// Firebase renvoie un tableau quand les clés sont des entiers consécutifs : on normalise.
export const list = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(x => x && typeof x === 'object');

async function cachedGet(path) {
  const c = cache();
  if (c?.has(path)) return c.get(path);
  const v = await rtdb.get(path);
  c?.set(path, v);
  return v;
}

export const now = () => new Date().toISOString();

export async function nextId(name) {
  const r = await rtdb.txn(`counters/${name}`, v => (Number(v) || 0) + 1);
  return r.value;
}

// ── Tables
const TABLE_DEFAULTS = {
  users: { username: '', global_name: null, avatar: null, discord_role: 0, site_role: 0, disabled: false, rp_name: null, phone: null, referent_lawyer_id: null, last_login: null },
  lawyers: { title: 'Avocat', photo_url: null, specialties: [], bio: '', active: true, accepts_appointments: true, sort_order: 100, first_name: null, last_name: null, phone: null, email: null, show_contact: true, photo_mime: null },
  cases: { service: null, lawyer_id: null, lawyer_accepted: null, archived: false, closed_at: null },
  appointments: { case_id: null, service: null, duration: 30, status: 'confirme' },
  services: { group_name: 'Prestations', description: '', price: null, price_unit: '', sort_order: 100, active: true },
  news: { category: 'Actualité', excerpt: '', body: '', published: true, author_id: null },
  applications: { user_id: null, experience: '', status: 'nouvelle' },
  contact_messages: { user_id: null, handled: false }
};
const withDefaults = (table, row) => row && ({ ...TABLE_DEFAULTS[table], ...row, ...(table === 'lawyers' ? { specialties: list2(row.specialties) } : {}) });
const list2 = v => Array.isArray(v) ? v.filter(x => x != null) : Object.values(v || {});

export async function all(table) {
  return list(await cachedGet(`tables/${table}`)).map(r => withDefaults(table, r));
}
export async function get(table, id) {
  if (id === null || id === undefined || id === '') return null;
  const c = cache(), whole = c?.get(`tables/${table}`);
  if (whole !== undefined) return withDefaults(table, list(whole).find(r => String(r.id ?? r.user_id) === String(id)) || null);
  const v = await rtdb.get(`tables/${table}/${id}`);
  return v ? withDefaults(table, v) : null;
}
export async function insert(table, row, { id } = {}) {
  const rid = id ?? await nextId(table);
  const full = { ...TABLE_DEFAULTS[table], ...row, ...(table === 'lawyers' ? { user_id: rid } : { id: rid }), created_at: row.created_at || now() };
  await rtdb.put(`tables/${table}/${rid}`, strip(full));
  forget(`tables/${table}`);
  return withDefaults(table, full);
}
// Modifie des champs ; une valeur null efface le champ (lu ensuite avec sa valeur par défaut)
export async function update(table, id, fields) {
  const body = {};
  for (const [k, v] of Object.entries(fields)) body[k] = v === undefined ? null : v;
  await rtdb.patch(`tables/${table}/${id}`, body);
  forget(`tables/${table}`);
}
export async function remove(table, id) {
  await rtdb.del(`tables/${table}/${id}`);
  forget(`tables/${table}`);
}
const strip = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

// ── Sous-collections par dossier (historique, notes, documents)
export async function children(kind, caseId) {
  return list(await cachedGet(`${kind}/${caseId}`)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id);
}
export async function addChild(kind, caseId, row) {
  const id = await nextId(kind);
  const full = { ...row, id, case_id: caseId, created_at: now() };
  await rtdb.put(`${kind}/${caseId}/${id}`, strip(full));
  forget(`${kind}/${caseId}`);
  return full;
}
export const addEvent = (caseId, e) => addChild('events', caseId, { internal: false, ...e });

// ── Disponibilités
export async function availabilityOf(lawyerId) {
  return list(await cachedGet(`availability/${lawyerId}`)).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}
export async function allAvailability() {
  const v = await cachedGet('availability');
  const out = {};
  for (const [k, slots] of Object.entries(Array.isArray(v) ? Object.assign({}, v) : (v || {}))) if (slots) out[k] = list(slots);
  return out;
}
export async function setAvailability(lawyerId, slots) {
  await rtdb.put(`availability/${lawyerId}`, slots.length ? slots : null);
  forget('availability');
}

// ── Fichiers (base64)
export const getBlob = path => rtdb.get(`blobs/${path}`);
export const putBlob = (path, value) => rtdb.put(`blobs/${path}`, value);
export const delBlob = path => rtdb.del(`blobs/${path}`);

// ── Verrou d'un créneau : renvoie true si on a pu le prendre
export async function lockSlot(key, apptId) {
  const r = await rtdb.txn(`locks/slots/${key}`, cur => (cur ? undefined : apptId));
  return r.committed;
}
export const unlockSlot = key => rtdb.del(`locks/slots/${key}`);
