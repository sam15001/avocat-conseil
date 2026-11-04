import { route } from '../router.mjs';
import { json, readJson, str, int, fail } from '../http.mjs';
import { all, get, insert, update, remove, rtdb, addEvent, now, allAvailability, putBlob, delBlob } from '../store.mjs';
import { stats, displayName, isClosed } from '../services.mjs';
import { notify, discordFetch, postMessage, welcomeMessage } from '../discord.mjs';
import { SETTING_KEYS, getSettings, invalidateSettings } from '../config.mjs';
import crypto from 'node:crypto';
import { cleanSpecialties, saveAvailability, getAvailability, cleanIdentity, cleanPhotoUpload, savePhoto, photoUrl } from './lawyer.mjs';
import { DOMAIN_BY_SLUG, STATUS_BY_KEY, SITE_PHOTOS } from '../../shared/domains.mjs';
import { newsImage } from './public.mjs';
import { listContracts, getContract, contractPdf, CONTRACT_TYPES, contractStatus } from '../contracts.mjs';
import site from '../../site.config.mjs';

// ── Dossiers
route('GET', '/api/admin/cases', async ({ query }) => {
  const [cases, users, lawyers] = await Promise.all([all('cases'), all('users'), all('lawyers')]);
  const U = new Map(users.map(u => [u.id, u])), L = new Map(lawyers.map(l => [l.user_id, l]));
  const archived = query.get('archived') === '1';
  const q = (query.get('q') || '').trim().toLowerCase();
  const lawyerF = query.get('lawyer'), domainF = query.get('domain'), statusF = query.get('status');
  const lawyerId = lawyerF && lawyerF !== 'none' ? int(lawyerF, 'avocat') : null;
  const out = cases.filter(c => {
    const u = U.get(c.client_id) || {};
    if (!!c.archived !== archived) return false;
    if (domainF && c.domain !== domainF) return false;
    if (statusF && c.status !== statusF) return false;
    if (lawyerF === 'none' && c.lawyer_id) return false;
    if (lawyerId !== null && c.lawyer_id !== lawyerId) return false;
    if (q && ![c.number, c.title, u.username, u.rp_name, u.global_name, u.discord_id].some(v => String(v || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 300).map(c => {
    const u = U.get(c.client_id);
    return { number: c.number, domain: c.domain, title: c.title, status: c.status, archived: !!c.archived, lawyer_id: c.lawyer_id, lawyer_accepted: c.lawyer_accepted,
      created_at: c.created_at, updated_at: c.updated_at, lawyer_name: L.get(c.lawyer_id)?.display_name ?? null, client_name: displayName(u),
      client_discord_id: u?.discord_id ?? null, client_referent_id: u?.referent_lawyer_id ?? null };
  });
  return json({ cases: out });
}, { auth: 2 });

const caseByNumber = async n => (await all('cases')).find(c => c.number === String(n || '').toUpperCase()) || null;

route('PATCH', '/api/admin/cases/:number', async ({ req, params }) => {
  const b = await readJson(req, 20000);
  const domain = str(b.domain, 'Domaine');
  if (!DOMAIN_BY_SLUG[domain]) fail(400, 'Domaine inconnu.');
  const c = await caseByNumber(params.number);
  if (!c) fail(404, 'Dossier introuvable.');
  await update('cases', c.id, { title: str(b.title, 'Objet', { max: 140 }), domain, description: str(b.description, 'Description', { max: 6000 }), updated_at: now() });
  return json({ ok: true });
}, { auth: 2 });

route('POST', '/api/admin/cases/:number/archive', async ({ req, params, user }) => {
  const b = await readJson(req, 1000);
  const c = await caseByNumber(params.number);
  if (!c) fail(404, 'Dossier introuvable.');
  await update('cases', c.id, { archived: b.archived !== false });
  await addEvent(c.id, { actor_id: user.id, type: 'archive', message: b.archived !== false ? 'Dossier archivé' : 'Dossier désarchivé', internal: true });
  return json({ ok: true });
}, { auth: 2 });

// ── Avocats
const SYNTHETIC = 'sans-discord-';
export const isRealDiscordId = id => /^\d{15,22}$/.test(id || '');

route('GET', '/api/admin/lawyers', async () => {
  const [lawyers, users, cases, avail] = await Promise.all([all('lawyers'), all('users'), all('cases'), allAvailability()]);
  const U = new Map(users.map(u => [u.id, u]));
  const out = lawyers.map(l => {
    const u = U.get(l.user_id) || {};
    const { photo_mime, ...rest } = l;
    return { ...rest, has_photo: !!photo_mime, photo: photoUrl({ ...l, has_photo: !!photo_mime }),
      discord_linked: isRealDiscordId(u.discord_id), discord_id: isRealDiscordId(u.discord_id) ? u.discord_id : null,
      username: u.username, disabled: !!u.disabled, last_login: u.last_login ?? null,
      role: Math.max(u.discord_role || 0, u.site_role || 0), site_role: u.site_role || 0, discord_role: u.discord_role || 0,
      active_cases: cases.filter(c => c.lawyer_id === l.user_id && !isClosed(c.status)).length,
      closed_cases: cases.filter(c => c.lawyer_id === l.user_id && c.status === 'cloture').length,
      portfolio: users.filter(x => x.referent_lawyer_id === l.user_id).length,
      availability: (avail[l.user_id] || []).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)) };
  }).sort((a, b) => (b.active - a.active) || a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));
  return json({ lawyers: out });
}, { auth: 2 });

const userByDiscord = async id => (await all('users')).find(u => u.discord_id === id) || null;

function checkRoleChange(actor, newRole, target) {
  if (newRole < 0 || newRole > 3) fail(400, 'Rôle invalide.');
  if (actor.role < 3 && (newRole >= 2 || (target && target.site_role >= 2))) fail(403, 'Seule la direction peut attribuer ou retirer les rôles Responsable et Direction.');
  if (target && target.id === actor.id && newRole < actor.role) fail(400, 'Vous ne pouvez pas réduire votre propre rôle.');
}

// Ajouter un avocat : identité, coordonnées, photo. L'identifiant Discord est facultatif :
// sans lui, la fiche existe sur le site ; avec lui, la personne retrouve sa fiche en se connectant.
route('POST', '/api/admin/lawyers', async ({ req, user }) => {
  const b = await readJson(req, 4 * 1024 * 1024);
  const idn = cleanIdentity(b);
  if (!idn.first_name || !idn.last_name) fail(400, 'Le prénom et le nom sont obligatoires.');
  const photo = cleanPhotoUpload(b.photo);
  const role = Math.max(1, int(b.role ?? 1, 'Rôle'));
  const discordId = str(b.discord_id, 'Identifiant Discord', { max: 25, optional: true });
  if (discordId && !isRealDiscordId(discordId)) fail(400, 'Identifiant Discord invalide (17 à 20 chiffres).');

  let target = discordId ? await userByDiscord(discordId) : null;
  checkRoleChange(user, role, target);
  if (target && await get('lawyers', target.id)) fail(409, 'Ce compte Discord a déjà une fiche avocat.');
  if (!target) {
    target = await insert('users', { discord_id: discordId || SYNTHETIC + crypto.randomUUID(), username: idn.display_name, global_name: idn.display_name, site_role: role });
  } else {
    await update('users', target.id, { site_role: Math.max(target.site_role || 0, role) });
  }
  const created = await insert('lawyers', { display_name: idn.display_name, first_name: idn.first_name, last_name: idn.last_name, title: idn.title,
    phone: idn.phone, email: idn.email, show_contact: idn.show_contact, specialties: cleanSpecialties(b.specialties),
    bio: str(b.bio, 'Présentation', { max: 1500, optional: true }) || '', updated_at: now() }, { id: target.id });
  await savePhoto(target.id, photo || undefined);
  return json({ lawyer: { user_id: created.user_id } }, 201);
}, { auth: 2 });

route('PATCH', '/api/admin/lawyers/:id', async ({ req, params, user }) => {
  const id = int(params.id, 'id');
  const lawyerRow = await get('lawyers', id);
  const target = lawyerRow && { ...(await get('users', id)), display_name: lawyerRow.display_name };
  if (!target) fail(404, 'Avocat introuvable.');
  const b = await readJson(req, 4 * 1024 * 1024);
  const idn = cleanIdentity(b, target.display_name);
  const photo = cleanPhotoUpload(b.photo);
  await update('lawyers', id, { display_name: idn.display_name, first_name: idn.first_name, last_name: idn.last_name, title: idn.title,
    phone: idn.phone, email: idn.email, show_contact: idn.show_contact, specialties: cleanSpecialties(b.specialties),
    bio: str(b.bio, 'Présentation', { max: 1500, optional: true }) || '', active: b.active !== false, sort_order: int(b.sort_order ?? 100, 'Ordre'),
    accepts_appointments: b.accepts_appointments !== false, updated_at: now() });
  await savePhoto(id, photo);
  if (b.site_role !== undefined) {
    const role = int(b.site_role, 'Rôle');
    if (role !== target.site_role) { checkRoleChange(user, role, target); await update('users', id, { site_role: role }); }
  }
  // Lier un compte Discord à une fiche créée sans identifiant
  const newDiscord = str(b.discord_id, 'Identifiant Discord', { max: 25, optional: true });
  if (newDiscord && newDiscord !== target.discord_id) {
    if (!isRealDiscordId(newDiscord)) fail(400, 'Identifiant Discord invalide (17 à 20 chiffres).');
    if (isRealDiscordId(target.discord_id)) fail(400, 'Cette fiche est déjà liée à un compte Discord.');
    if (await userByDiscord(newDiscord)) fail(409, "Ce compte Discord s'est déjà connecté au site avec un autre profil. Supprimez ce doublon ou ajoutez l'avocat depuis son compte existant.");
    await update('users', id, { discord_id: newDiscord });
  }
  if (Array.isArray(b.availability)) await saveAvailability(id, b.availability);
  return json({ ok: true });
}, { auth: 2 });

// ── Clients
const clientRow = (u, L) => ({ id: u.id, discord_id: u.discord_id, username: u.username, global_name: u.global_name, rp_name: u.rp_name, phone: u.phone,
  disabled: !!u.disabled, created_at: u.created_at, last_login: u.last_login ?? null, site_role: u.site_role || 0, discord_role: u.discord_role || 0,
  role: Math.max(u.discord_role || 0, u.site_role || 0), documents_access: !!u.documents_access, referent_lawyer_id: u.referent_lawyer_id ?? null, referent_name: L.get(u.referent_lawyer_id)?.display_name ?? null });

route('GET', '/api/admin/clients', async ({ query }) => {
  const s = (query.get('q') || '').trim().toLowerCase();
  const [users, lawyers, cases] = await Promise.all([all('users'), all('lawyers'), all('cases')]);
  const L = new Map(lawyers.map(l => [l.user_id, l]));
  const clients = users.filter(u => !String(u.discord_id).startsWith(SYNTHETIC))
    .filter(u => !s || [u.username, u.global_name, u.rp_name].some(v => String(v || '').toLowerCase().includes(s)) || u.discord_id === s)
    .sort((a, b) => String(b.last_login || '').localeCompare(String(a.last_login || ''))).slice(0, 300)
    .map(u => ({ ...clientRow(u, L), cases_count: cases.filter(c => c.client_id === u.id).length, open_cases: cases.filter(c => c.client_id === u.id && !isClosed(c.status)).length }));
  return json({ clients });
}, { auth: 2 });

route('GET', '/api/admin/clients/:id', async ({ params }) => {
  const id = int(params.id, 'id');
  const [users, lawyers, cases, appts] = await Promise.all([all('users'), all('lawyers'), all('cases'), all('appointments')]);
  const L = new Map(lawyers.map(l => [l.user_id, l]));
  const u = users.find(x => x.id === id);
  if (!u) fail(404, 'Compte introuvable.');
  return json({
    client: clientRow(u, L),
    cases: cases.filter(c => c.client_id === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(c => ({ number: c.number, domain: c.domain, title: c.title, status: c.status, created_at: c.created_at, lawyer_name: L.get(c.lawyer_id)?.display_name ?? null })),
    appointments: appts.filter(a => a.client_id === id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
      .map(a => ({ id: a.id, date: a.date, time: a.time, status: a.status, reason: a.reason, lawyer_name: L.get(a.lawyer_id)?.display_name ?? null }))
  });
}, { auth: 2 });

// Avocat référent d'un client (portefeuille). transfer = confier aussi ses dossiers en cours au nouvel avocat.
route('PUT', '/api/admin/clients/:id/referent', async ({ req, params, user }) => {
  const id = int(params.id, 'id');
  const client = await get('users', id);
  if (!client) fail(404, 'Compte introuvable.');
  const old = client.referent_lawyer_id ? await get('lawyers', client.referent_lawyer_id) : null;
  const b = await readJson(req, 2000);
  const lawyerId = b.lawyer_id === null || b.lawyer_id === '' ? null : int(b.lawyer_id, 'Avocat');
  let lawyer = null;
  if (lawyerId !== null) {
    lawyer = await get('lawyers', lawyerId);
    if (!lawyer || !lawyer.active) fail(400, 'Avocat introuvable ou inactif.');
  }
  await update('users', id, { referent_lawyer_id: lawyerId });
  const moved = [];
  if (lawyer && b.transfer) {
    for (const c of (await all('cases')).filter(c => c.client_id === id && !isClosed(c.status) && c.lawyer_id !== lawyerId)) {
      await update('cases', c.id, { lawyer_id: lawyerId, lawyer_accepted: true, status: ['recue', 'attente'].includes(c.status) ? 'attribue' : c.status, updated_at: now() });
      await addEvent(c.id, { actor_id: user.id, type: 'assign', message: `Dossier transféré à ${lawyer.display_name}, nouvel avocat référent` });
      moved.push(c);
    }
  }
  await notify('admin', { title: 'Portefeuille modifié', fields: [
    { name: 'Client', value: displayName(client), inline: true },
    { name: 'Ancien référent', value: old?.display_name || '—', inline: true },
    { name: 'Nouveau référent', value: lawyer?.display_name || 'Aucun', inline: true },
    ...(moved.length ? [{ name: 'Dossiers transférés', value: moved.map(c => c.number).join(', ') }] : [])] });
  return json({ ok: true, moved: moved.map(c => c.number) });
}, { auth: 2 });

// Désactiver un compte ou changer le rôle site (direction)
route('PATCH', '/api/admin/users/:id', async ({ req, params, user }) => {
  const id = int(params.id, 'id');
  const target = await get('users', id);
  if (!target) fail(404, 'Compte introuvable.');
  const b = await readJson(req, 2000);
  if (b.disabled !== undefined) {
    if (id === user.id) fail(400, 'Vous ne pouvez pas désactiver votre propre compte.');
    if (target.site_role >= 2 && user.role < 3) fail(403, 'Seule la direction peut désactiver ce compte.');
    await update('users', id, { disabled: !!b.disabled });
  }
  if (b.site_role !== undefined) {
    const role = int(b.site_role, 'Rôle');
    checkRoleChange(user, role, target);
    await update('users', id, { site_role: role });
  }
  if (b.documents_access !== undefined) await update('users', id, { documents_access: !!b.documents_access });
  return json({ ok: true });
}, { auth: 2 });

// ── Contrats générés depuis Discord
route('GET', '/api/admin/contracts', async () => json({ contracts: (await listContracts()).slice(0, 300).map(c => ({
  id: c.id, ref: c.ref, type: c.type, type_label: CONTRACT_TYPES[c.type], company: c.company, employer_name: c.employer_name, position: c.position,
  employee_name: `${c.employee?.first_name || ''} ${c.employee?.last_name || ''}`.trim(), status: c.status, status_label: contractStatus[c.status],
  signatures: c.signatures || {}, refused_by: c.refused_by || null, created_at: c.created_at })) }), { auth: 1 });

route('GET', '/api/admin/contracts/:id/pdf', async ({ params }) => {
  const c = await getContract(int(params.id, 'id'));
  if (!c) fail(404, 'Contrat introuvable.');
  return new Response(await contractPdf(c), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${c.ref}.pdf"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}, { auth: 1 });

// ── Statistiques
route('GET', '/api/admin/stats', async () => json(await stats()), { auth: 2 });

// ── Candidatures et messages
const newest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));

route('GET', '/api/admin/applications', async () => {
  const [apps, users] = await Promise.all([all('applications'), all('users')]);
  const U = new Map(users.map(u => [u.id, u]));
  return json({ applications: apps.sort(newest).slice(0, 200).map(a => ({ ...a, discord_id: U.get(a.user_id)?.discord_id ?? null })) });
}, { auth: 2 });

route('PATCH', '/api/admin/applications/:id', async ({ req, params }) => {
  const b = await readJson(req, 1000);
  if (!['nouvelle', 'entretien', 'acceptee', 'refusee'].includes(b.status)) fail(400, 'Statut invalide.');
  const id = int(params.id, 'id');
  if (!await get('applications', id)) fail(404, 'Candidature introuvable.');
  await update('applications', id, { status: b.status });
  return json({ ok: true });
}, { auth: 2 });

route('GET', '/api/admin/messages', async () => json({ messages: (await all('contact_messages')).sort((a, b) => (a.handled - b.handled) || newest(a, b)).slice(0, 200) }), { auth: 2 });

route('PATCH', '/api/admin/messages/:id', async ({ req, params }) => {
  const b = await readJson(req, 1000);
  const id = int(params.id, 'id');
  if (!await get('contact_messages', id)) fail(404, 'Message introuvable.');
  await update('contact_messages', id, { handled: !!b.handled });
  return json({ ok: true });
}, { auth: 2 });

// ── Actualités
const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const newsRow = n => ({ id: n.id, slug: n.slug, title: n.title, category: n.category, excerpt: n.excerpt, body: n.body, published: n.published, created_at: n.created_at,
  image: n.image_mime ? `/api/admin/news/${n.id}/image?v=${n.image_v || 1}` : null });
const IMG_MAX = 3 * 1024 * 1024;
// Image d'article : undefined = inchangée, null = retirée, { mime, data } = nouvelle
async function saveNewsImage(id, image) {
  const img = cleanPhotoUpload(image, IMG_MAX);
  if (img === undefined) return;
  if (img === null) { await delBlob(`news/${id}`); await update('news', id, { image_mime: null, image_v: null }); return; }
  await putBlob(`news/${id}`, img.data.toString('base64'));
  await update('news', id, { image_mime: img.mime, image_v: Date.now() });
}

// Aperçu dans l'administration (y compris pour un article non publié)
route('GET', '/api/admin/news/:id/image', async ({ params }) => {
  const n = await get('news', int(params.id, 'id'));
  const data = n?.image_mime ? await rtdb.get(`blobs/news/${n.id}`) : null;
  if (!data) fail(404, 'Image introuvable.');
  return new Response(Buffer.from(data, 'base64'), { headers: { 'content-type': n.image_mime, 'cache-control': 'private, max-age=31536000', 'x-content-type-options': 'nosniff' } });
}, { auth: 2 });

route('GET', '/api/admin/news', async () => json({ news: (await all('news')).sort(newest).map(newsRow) }), { auth: 2 });

route('POST', '/api/admin/news', async ({ req, user }) => {
  const b = await readJson(req, 5 * 1024 * 1024);
  const title = str(b.title, 'Titre', { max: 160 });
  const n = await insert('news', { slug: slugify(title) + '-' + Date.now().toString(36).slice(-4), title, category: str(b.category, 'Catégorie', { max: 60 }),
    excerpt: str(b.excerpt, 'Résumé', { max: 300 }), body: str(b.body, 'Contenu', { max: 20000 }), published: b.published !== false, author_id: user.id });
  await saveNewsImage(n.id, b.image ?? undefined);
  return json({ news: { id: n.id, slug: n.slug } }, 201);
}, { auth: 2 });

route('PATCH', '/api/admin/news/:id', async ({ req, params }) => {
  const b = await readJson(req, 5 * 1024 * 1024);
  const id = int(params.id, 'id');
  if (!await get('news', id)) fail(404, 'Article introuvable.');
  await update('news', id, { title: str(b.title, 'Titre', { max: 160 }), category: str(b.category, 'Catégorie', { max: 60 }), excerpt: str(b.excerpt, 'Résumé', { max: 300 }),
    body: str(b.body, 'Contenu', { max: 20000 }), published: b.published !== false });
  await saveNewsImage(id, b.image);
  return json({ ok: true });
}, { auth: 2 });

route('DELETE', '/api/admin/news/:id', async ({ params }) => {
  await remove('news', int(params.id, 'id'));
  await delBlob(`news/${int(params.id, 'id')}`);
  return json({ ok: true });
}, { auth: 2 });

// ── Photos du site (locaux, bureaux, tribunal…)
route('GET', '/api/admin/site-photos', async () => {
  const meta = (await rtdb.get('site_photos')) || {};
  return json({ photos: SITE_PHOTOS.map(p => ({ ...p, custom: !!meta[p.key],
    url: meta[p.key] ? `/api/public/site-photo/${p.key}?v=${meta[p.key].v}` : site.photos[p.key] })) });
}, { auth: 2 });

route('PUT', '/api/admin/site-photos/:key', async ({ req, params }) => {
  if (!SITE_PHOTOS.some(p => p.key === params.key)) fail(404, 'Photo inconnue.');
  const img = cleanPhotoUpload((await readJson(req, 5 * 1024 * 1024)).image, IMG_MAX);
  if (!img) fail(400, 'Choisissez une image.');
  await putBlob(`site/${params.key}`, img.data.toString('base64'));
  const v = Date.now();
  await rtdb.put(`site_photos/${params.key}`, { mime: img.mime, v });
  return json({ ok: true, url: `/api/public/site-photo/${params.key}?v=${v}` });
}, { auth: 2 });

route('DELETE', '/api/admin/site-photos/:key', async ({ params }) => {
  if (!SITE_PHOTOS.some(p => p.key === params.key)) fail(404, 'Photo inconnue.');
  await rtdb.del(`site_photos/${params.key}`);
  await delBlob(`site/${params.key}`);
  return json({ ok: true, url: site.photos[params.key] });
}, { auth: 2 });

// ── Paramètres Discord (direction)
route('GET', '/api/admin/settings', async () => {
  const values = await getSettings({ fresh: true });
  return json({
    settings: Object.entries(SETTING_KEYS).map(([key, d]) => ({ key, label: d.label, value: values[key] || '', env: d.env })),
    status: {
      oauth: !!(process.env.DISCORD_APPLICATION_ID && process.env.DISCORD_CLIENT_SECRET),
      bot: !!process.env.DISCORD_BOT_TOKEN,
      interactions: !!process.env.DISCORD_PUBLIC_KEY,
      guild: !!process.env.DISCORD_GUILD_ID
    },
    statuses: Object.values(STATUS_BY_KEY)
  });
}, { auth: 3 });

route('PUT', '/api/admin/settings', async ({ req }) => {
  const b = await readJson(req, 10000);
  for (const [key, value] of Object.entries(b.settings || {})) {
    if (!(key in SETTING_KEYS)) continue;
    const v = String(value || '').trim();
    if (v && !/^\d{15,22}(\s*,\s*\d{15,22})*$/.test(v)) fail(400, `${SETTING_KEYS[key].label} : identifiant Discord invalide.`);
    await rtdb.put(`tables/settings/${key}`, v || null);
  }
  invalidateSettings();
  return json({ ok: true });
}, { auth: 3 });

// ── Outils Discord (direction) : installer les commandes slash et tester les salons, sans rien installer en local
route('POST', '/api/admin/discord/commands', async () => {
  const { DISCORD_APPLICATION_ID: app, DISCORD_GUILD_ID: guild, DISCORD_BOT_TOKEN: token } = process.env;
  if (!app || !guild || !token) fail(400, 'DISCORD_APPLICATION_ID, DISCORD_GUILD_ID et DISCORD_BOT_TOKEN doivent être renseignés dans Netlify.');
  const { COMMANDS } = await import('../interactions.mjs');
  const r = await discordFetch(`/applications/${app}/guilds/${guild}/commands`, { method: 'PUT', body: COMMANDS });
  if (!r.ok) fail(502, `Discord a refusé l'installation (${r.status}). Vérifiez le token du bot, l'identifiant d'application et que le bot est bien sur le serveur.`);
  return json({ ok: true, commands: r.data.map(c => '/' + c.name) });
}, { auth: 3 });

route('POST', '/api/admin/discord/test', async ({ user }) => {
  if (!process.env.DISCORD_BOT_TOKEN) fail(400, 'DISCORD_BOT_TOKEN manquant dans Netlify.');
  const settings = await getSettings({ fresh: true });
  const results = [];
  for (const key of ['requests', 'appointments', 'active', 'closed', 'admin']) {
    if (!settings[`channel_${key}`]) { results.push({ key, label: SETTING_KEYS[`channel_${key}`].label, ok: false, error: 'Identifiant non renseigné' }); continue; }
    const r = await notify(key, { title: 'Test de connexion', description: `Message de test envoyé depuis l'administration par ${user.rp_name || user.global_name || user.username}. Ce salon est bien relié au site.` });
    results.push({ key, label: SETTING_KEYS[`channel_${key}`].label, ok: !!r?.ok, error: r?.ok ? null : (r?.status === 403 ? 'Le bot n’a pas accès à ce salon' : r?.status === 404 ? 'Salon introuvable' : r?.status === 401 ? 'Token du bot invalide' : 'Envoi impossible') });
  }
  return json({ results });
}, { auth: 3 });

route('POST', '/api/admin/discord/welcome', async () => {
  const settings = await getSettings({ fresh: true });
  if (!settings.channel_welcome) fail(400, "Renseignez d'abord le « Salon d’accueil des clients » ci-dessus, puis enregistrez.");
  const r = await postMessage(settings.channel_welcome, welcomeMessage());
  if (!r.ok) fail(502, r.status === 403 ? 'Le bot n’a pas le droit d’écrire dans ce salon.' : r.status === 404 ? 'Salon introuvable : vérifiez l’identifiant.' : 'Envoi impossible : vérifiez le token du bot.');
  return json({ ok: true, message_id: r.data?.id });
}, { auth: 3 });
