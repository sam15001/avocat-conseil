import { route } from '../router.mjs';
import { json, readJson, str, int, fail } from '../http.mjs';
import { all, get, insert, update, now, availabilityOf, setAvailability, putBlob, delBlob } from '../store.mjs';
import { isClosed } from '../services.mjs';
import { DOMAIN_BY_SLUG } from '../../shared/domains.mjs';

// Crée la fiche avocat au premier accès d'un membre ayant le rôle Avocat sur Discord
export async function ensureLawyer(user) {
  let l = await get('lawyers', user.id);
  if (!l) l = await insert('lawyers', { display_name: user.rp_name || user.global_name || user.username, updated_at: now() }, { id: user.id });
  const { photo_mime, ...rest } = l;
  return { ...rest, has_photo: !!photo_mime, photo: photoUrl({ ...l, has_photo: !!photo_mime }) };
}

export function cleanSpecialties(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(s => DOMAIN_BY_SLUG[s]))];
}

export function cleanPhoto(v) {
  const url = str(v, 'Photo', { max: 500, optional: true });
  if (url && !/^https:\/\/[^\s"'<>]+$/.test(url)) fail(400, 'La photo doit être une adresse https://');
  return url;
}

// Photo envoyée depuis le site : undefined = inchangée, null = supprimée, { mime, data(base64) } = nouvelle
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export function cleanPhotoUpload(p, maxBytes = 2 * 1024 * 1024) {
  if (p === undefined) return undefined;
  if (p === null) return null;
  if (!p || !PHOTO_TYPES.includes(p.mime)) fail(400, 'Photo : formats acceptés PNG, JPG ou WEBP.');
  const data = Buffer.from(String(p.data || ''), 'base64');
  if (!data.length) fail(400, 'Photo vide.');
  if (data.length > maxBytes) fail(413, `Photo trop lourde (${Math.round(maxBytes / 1048576)} Mo maximum).`);
  const head = data.subarray(0, 4).toString('hex');
  const valid = (p.mime === 'image/png' && head === '89504e47') || (p.mime === 'image/jpeg' && head.startsWith('ffd8ff'))
    || (p.mime === 'image/webp' && data.subarray(8, 12).toString() === 'WEBP');
  if (!valid) fail(400, "Le fichier envoyé n'est pas une image valide.");
  return { data, mime: p.mime };
}

export async function savePhoto(userId, photo) {
  if (photo === undefined) return;
  if (photo) await putBlob(`photos/${userId}`, photo.data.toString('base64'));
  else await delBlob(`photos/${userId}`);
  await update('lawyers', userId, { photo_mime: photo?.mime ?? null, updated_at: now() });
}

// Identité et coordonnées
export function cleanIdentity(b, fallbackName = '') {
  const first = str(b.first_name, 'Prénom', { max: 40, optional: true });
  const last = str(b.last_name, 'Nom', { max: 40, optional: true });
  const display = [first, last].filter(Boolean).join(' ') || str(b.display_name, 'Nom RP', { max: 80, optional: true }) || fallbackName;
  if (!display) fail(400, 'Le prénom et le nom sont obligatoires.');
  const email = str(b.email, 'E-mail', { max: 120, optional: true });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Adresse e-mail invalide.');
  return {
    first_name: first, last_name: last, display_name: display,
    title: str(b.title, 'Titre', { max: 60, optional: true }) || 'Avocat',
    phone: str(b.phone, 'Téléphone', { max: 30, optional: true }),
    email, show_contact: b.show_contact !== false
  };
}

// URL publique de la photo (photo envoyée en priorité, sinon ancienne adresse https)
export const photoUrl = l => l.has_photo ? `/api/public/lawyers/${l.user_id ?? l.id}/photo?v=${new Date(l.updated_at).getTime()}` : (l.photo_url || null);

export async function saveAvailability(lawyerId, slots) {
  if (!Array.isArray(slots) || slots.length > 50) fail(400, 'Disponibilités invalides.');
  const clean = slots.map(s => {
    const weekday = int(s.weekday, 'Jour');
    if (weekday < 0 || weekday > 6) fail(400, 'Jour invalide.');
    if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end) || s.end <= s.start) fail(400, 'Horaires invalides : la fin doit être après le début.');
    const slot = int(s.slot_minutes ?? 30, 'Durée');
    if (slot < 10 || slot > 240) fail(400, 'Durée de créneau invalide.');
    return { weekday, start: s.start, end: s.end, slot_minutes: slot };
  });
  await setAvailability(lawyerId, clean);
}

export const getAvailability = lawyerId => availabilityOf(lawyerId);

route('GET', '/api/lawyer/profile', async ({ user }) => {
  const l = await ensureLawyer(user);
  const mine = (await all('cases')).filter(c => c.lawyer_id === user.id);
  const counts = { closed: mine.filter(c => c.status === 'cloture').length, active: mine.filter(c => !isClosed(c.status)).length };
  return json({ profile: { ...l, ...counts }, availability: await getAvailability(user.id) });
}, { auth: 1 });

route('PUT', '/api/lawyer/profile', async ({ req, user }) => {
  const current = await ensureLawyer(user);
  const b = await readJson(req, 4 * 1024 * 1024);
  const id = cleanIdentity(b, current.display_name);
  const photo = cleanPhotoUpload(b.photo);
  await update('lawyers', user.id, { display_name: id.display_name, first_name: id.first_name, last_name: id.last_name, title: id.title,
    phone: id.phone, email: id.email, show_contact: id.show_contact, specialties: cleanSpecialties(b.specialties),
    bio: str(b.bio, 'Présentation', { max: 1500, optional: true }) || '', accepts_appointments: b.accepts_appointments !== false, updated_at: now() });
  await savePhoto(user.id, photo);
  return json({ ok: true });
}, { auth: 1 });

route('PUT', '/api/lawyer/availability', async ({ req, user }) => {
  await ensureLawyer(user);
  const b = await readJson(req, 20000);
  await saveAvailability(user.id, b.slots);
  return json({ availability: await getAvailability(user.id) });
}, { auth: 1 });

route('GET', '/api/lawyer/cases', async ({ user, query }) => {
  const history = query.get('history') === '1';
  const users = new Map((await all('users')).map(u => [u.id, u]));
  const cases = (await all('cases'))
    .filter(c => c.lawyer_id === user.id && isClosed(c.status) === history)
    .sort((a, b) => (b.lawyer_accepted === null) - (a.lawyer_accepted === null) || String(b.updated_at).localeCompare(String(a.updated_at)))
    .map(c => { const u = users.get(c.client_id); return { number: c.number, domain: c.domain, title: c.title, status: c.status, lawyer_accepted: c.lawyer_accepted,
      created_at: c.created_at, updated_at: c.updated_at, client_name: u ? (u.rp_name || u.global_name || u.username) : '—' }; });
  return json({ cases });
}, { auth: 1 });

// Portefeuille : les clients suivis par l'avocat connecté
route('GET', '/api/lawyer/portfolio', async ({ user }) => {
  const [users, cases, appts] = await Promise.all([all('users'), all('cases'), all('appointments')]);
  const today = new Date().toISOString().slice(0, 10);
  const clients = users.filter(u => u.referent_lawyer_id === user.id).map(u => {
    const theirs = cases.filter(c => c.client_id === u.id).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const next = appts.filter(a => a.client_id === u.id && a.status === 'confirme' && a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    return {
      id: u.id, discord_id: u.discord_id, username: u.username, name: u.rp_name || u.global_name || u.username, phone: u.phone,
      cases_total: theirs.length, cases_open: theirs.filter(c => !isClosed(c.status)).length,
      last_activity: theirs[0]?.updated_at ?? null, next_appointment: next ? `${next.date} ${next.time}` : null,
      cases: theirs.map(c => ({ number: c.number, title: c.title, status: c.status, domain: c.domain, client_id: c.client_id, updated_at: c.updated_at }))
    };
  }).sort((a, b) => b.cases_open - a.cases_open || String(b.last_activity || '').localeCompare(String(a.last_activity || '')));
  return json({ clients });
}, { auth: 1 });
