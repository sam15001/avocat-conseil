import { route } from '../router.mjs';
import { json, readJson, str, int, fail } from '../http.mjs';
import { all, get, insert, update, now, children, addChild, addEvent, nextId, putBlob, getBlob } from '../store.mjs';
import { notify, dm, embeds } from '../discord.mjs';
import { getCase, canManageCase, changeStatus, assignCase, displayName, isClosed } from '../services.mjs';
import { DOMAIN_BY_SLUG } from '../../shared/domains.mjs';
import { validateService } from './services.mjs';

const MAX_FILE = 4 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];

// ── Citoyen : ses dossiers
route('GET', '/api/cases', async ({ user }) => {
  const lawyers = new Map((await all('lawyers')).map(l => [l.user_id, l]));
  const cases = (await all('cases')).filter(c => c.client_id === user.id)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map(c => ({ number: c.number, domain: c.domain, service: c.service, title: c.title, status: c.status, created_at: c.created_at, updated_at: c.updated_at,
                 lawyer_name: lawyers.get(c.lawyer_id)?.display_name ?? null }));
  return json({ cases });
}, { auth: 'user' });

route('POST', '/api/cases', async ({ req, user }) => {
  const b = await readJson(req, 40000);
  const domain = str(b.domain, 'Domaine');
  if (!DOMAIN_BY_SLUG[domain]) fail(400, 'Domaine juridique inconnu.');
  const service = str(b.service, 'Prestation', { max: 120, optional: true });
  await validateService(domain, service);
  const title = str(b.title, 'Objet', { min: 5, max: 140 });
  const description = str(b.description, 'Description', { min: 30, max: 6000 });

  const open = (await all('cases')).filter(c => c.client_id === user.id && !isClosed(c.status)).length;
  if (open >= 10) fail(429, 'Vous avez déjà 10 dossiers ouverts. Attendez la clôture de l’un d’eux.');

  // Portefeuille : un client déjà suivi voit son dossier confié directement à son avocat référent
  const referent = user.referent_lawyer_id && user.referent_active
    ? await (async () => { const l = await get('lawyers', user.referent_lawyer_id); const u = await get('users', user.referent_lawyer_id); return l && { user_id: l.user_id, display_name: l.display_name, discord_id: u?.discord_id }; })() : null;

  const seq = await nextId('case_number');
  const t = now();
  const c = await insert('cases', {
    number: `AC-${t.slice(0, 4)}-${String(seq).padStart(4, '0')}`, client_id: user.id, domain, service, title, description,
    status: referent ? 'attribue' : 'recue', lawyer_id: referent?.user_id ?? null, lawyer_accepted: referent ? true : null, updated_at: t
  });
  await addEvent(c.id, { actor_id: user.id, type: 'created', to_status: 'recue', message: 'Demande déposée depuis l’espace client' });
  if (referent) await addEvent(c.id, { type: 'assign', from_status: 'recue', to_status: 'attribue', message: `Dossier confié à votre avocat référent, ${referent.display_name}` });
  await notify('requests', embeds.newCase({ ...c, auto_lawyer: referent?.display_name }, user));
  await dm(user.discord_id, { title: `Demande enregistrée : ${c.number}`, description: `Votre demande « ${title} » a bien été reçue.${referent ? ` Elle est confiée à votre avocat référent, ${referent.display_name}.` : ''} Suivez son avancement dans votre espace client.` }, [['Voir mon dossier', `/dossier.html?n=${c.number}`], ['Prendre rendez-vous', `/rendez-vous.html?dossier=${c.number}`]]);
  if (referent) await dm(referent.discord_id, { title: `Nouveau dossier de votre client : ${c.number}`, description: `${title}\n\nCe client fait partie de votre portefeuille : le dossier vous est confié directement.` }, [['Ouvrir le dossier', `/dossier.html?n=${c.number}`]]);
  return json({ case: { number: c.number, lawyer_name: referent?.display_name ?? null } }, 201);
}, { auth: 'user' });

route('GET', '/api/cases/:number', async ({ params, user }) => {
  const c = await getCase(params.number);
  const staff = c && canManageCase(user, c);
  if (!c || (c.client_id !== user.id && !staff)) fail(404, 'Dossier introuvable.');
  const [users, lawyers] = await Promise.all([all('users'), all('lawyers')]);
  const U = new Map(users.map(u => [u.id, u])), L = new Map(lawyers.map(l => [l.user_id, l]));
  const who = id => L.get(id)?.display_name || (U.get(id) ? (U.get(id).rp_name || U.get(id).global_name || U.get(id).username) : null);
  const events = (await children('events', c.id)).filter(e => staff || !e.internal)
    .map(e => ({ type: e.type, from_status: e.from_status ?? null, to_status: e.to_status ?? null, message: e.message ?? null, internal: !!e.internal, created_at: e.created_at, actor: who(e.actor_id) }));
  const documents = (await children('documents', c.id)).filter(d => staff || !d.internal)
    .map(d => ({ id: d.id, filename: d.filename, mime: d.mime, size: d.size, internal: !!d.internal, created_at: d.created_at, uploader: who(d.uploader_id) }));
  const appointments = (await all('appointments')).filter(a => a.case_id === c.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map(a => ({ id: a.id, date: a.date, time: a.time, reason: a.reason, service: a.service, status: a.status, lawyer_name: L.get(a.lawyer_id)?.display_name ?? null }));
  const notes = staff ? (await children('notes', c.id)).reverse().map(n => ({ id: n.id, body: n.body, created_at: n.created_at, author: who(n.author_id) })) : undefined;
  const out = {
    number: c.number, domain: c.domain, service: c.service, title: c.title, description: c.description, status: c.status,
    lawyer_id: c.lawyer_id, lawyer_name: c.lawyer_name, lawyer_accepted: c.lawyer_accepted,
    created_at: c.created_at, updated_at: c.updated_at, closed_at: c.closed_at,
    client_name: c.client_name, is_owner: c.client_id === user.id, can_manage: staff
  };
  if (staff) Object.assign(out, { archived: c.archived, client_id: c.client_id, client_discord_id: c.client_discord_id, notes,
    client_referent_id: c.client_referent_id, client_referent_name: c.client_referent_name });
  return json({ case: out, events, documents, appointments });
}, { auth: 'user' });

// ── Documents (citoyen propriétaire ou équipe)
route('POST', '/api/cases/:number/documents', async ({ req, params, user }) => {
  const c = await getCase(params.number);
  const staff = c && canManageCase(user, c);
  if (!c || (c.client_id !== user.id && !staff)) fail(404, 'Dossier introuvable.');
  if (isClosed(c.status) && !staff) fail(400, 'Ce dossier est clôturé.');
  const b = await readJson(req, 6 * 1024 * 1024);
  const filename = str(b.filename, 'Nom du fichier', { max: 160 }).replace(/[^\w.\-() àâäéèêëîïôöùûüç]/gi, '_');
  const mime = str(b.mime, 'Type', { max: 80 });
  if (!ALLOWED.includes(mime)) fail(400, 'Format non accepté. Formats acceptés : PNG, JPG, WEBP, GIF, PDF, TXT.');
  const data = Buffer.from(str(b.data, 'Fichier', { max: 6 * 1024 * 1024 }), 'base64');
  if (!data.length) fail(400, 'Fichier vide.');
  if (data.length > MAX_FILE) fail(413, 'Fichier trop lourd (4 Mo maximum).');
  const internal = staff && b.internal === true;
  const count = (await children('documents', c.id)).length;
  if (count >= 30) fail(400, 'Limite de 30 documents par dossier atteinte.');
  const meta = await addChild('documents', c.id, { uploader_id: user.id, filename, mime, size: data.length, internal });
  await putBlob(`documents/${meta.id}`, data.toString('base64'));
  await update('documents_index', meta.id, { case_id: c.id });
  await addEvent(c.id, { actor_id: user.id, type: 'document', message: `Document ajouté : ${filename}`, internal });
  await update('cases', c.id, { updated_at: now() });
  const doc = { id: meta.id, filename };
  return json({ document: doc }, 201);
}, { auth: 'user' });

route('GET', '/api/documents/:id', async ({ params, user, query }) => {
  const docId = int(params.id, 'id');
  const idx = await get('documents_index', docId);
  const kase = idx ? await get('cases', idx.case_id) : null;
  const meta = kase ? (await children('documents', kase.id)).find(x => x.id === docId) : null;
  const d = meta && { ...meta, client_id: kase.client_id, lawyer_id: kase.lawyer_id };
  const staff = d && canManageCase(user, d);
  if (!d || (!staff && (d.client_id !== user.id || d.internal))) fail(404, 'Document introuvable.');
  const inline = query.get('inline') === '1' && (d.mime.startsWith('image/') || d.mime === 'application/pdf');
  const data = await getBlob(`documents/${d.id}`);
  if (!data) fail(404, 'Document introuvable.');
  return new Response(Buffer.from(data, 'base64'), { headers: {
    'content-type': d.mime,
    'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.filename)}`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'cache-control': 'private, no-store'
  } });
}, { auth: 'user' });

// ── Équipe : actions sur un dossier
route('POST', '/api/cases/:number/status', async ({ req, params, user }) => {
  const c = await getCase(params.number);
  if (!c || !canManageCase(user, c)) fail(404, 'Dossier introuvable.');
  const b = await readJson(req, 10000);
  const updated = await changeStatus(c, str(b.status, 'Statut', { max: 20 }), user, str(b.message, 'Commentaire', { max: 1000, optional: true }));
  return json({ case: { number: updated.number, status: updated.status } });
}, { auth: 1 });

route('POST', '/api/cases/:number/notes', async ({ req, params, user }) => {
  const c = await getCase(params.number);
  if (!c || !canManageCase(user, c)) fail(404, 'Dossier introuvable.');
  const b = await readJson(req, 10000);
  const n = await addChild('notes', c.id, { author_id: user.id, body: str(b.body, 'Note', { max: 4000 }) });
  const note = { id: n.id, body: n.body, created_at: n.created_at };
  return json({ note }, 201);
}, { auth: 1 });

route('POST', '/api/cases/:number/accept', async ({ params, user }) => {
  const c = await getCase(params.number);
  if (!c || c.lawyer_id !== user.id) fail(404, 'Dossier introuvable.');
  if (c.lawyer_accepted !== null) fail(400, 'Vous avez déjà répondu pour ce dossier.');
  const next = c.status === 'attribue' ? 'en_cours' : c.status;
  await update('cases', c.id, { lawyer_accepted: true, status: next, updated_at: now() });
  await addEvent(c.id, { actor_id: user.id, type: 'accept', from_status: c.status, to_status: next, message: 'Prise en charge acceptée par l’avocat' });
  if (c.status === 'attribue') await notify('active', embeds.statusChange(c, 'attribue', 'en_cours', c.lawyer_name, displayName(user), 'Prise en charge acceptée'));
  return json({ ok: true });
}, { auth: 1 });

route('POST', '/api/cases/:number/refuse', async ({ req, params, user }) => {
  const c = await getCase(params.number);
  if (!c || c.lawyer_id !== user.id) fail(404, 'Dossier introuvable.');
  if (c.lawyer_accepted === true) fail(400, 'Vous avez déjà accepté ce dossier. Demandez une réattribution à un responsable.');
  const b = await readJson(req, 5000);
  const reason = str(b.reason, 'Motif', { max: 500, optional: true });
  await update('cases', c.id, { lawyer_id: null, lawyer_accepted: null, status: 'attente', updated_at: now() });
  await addEvent(c.id, { actor_id: user.id, type: 'refuse', from_status: c.status, to_status: 'attente', message: `Prise en charge refusée${reason ? ' : ' + reason : ''}`, internal: true });
  await addEvent(c.id, { type: 'status', from_status: c.status, to_status: 'attente', message: 'Le dossier est en cours de réattribution' });
  await notify('admin', embeds.lawyerRefused(c, c.lawyer_name, reason));
  return json({ ok: true });
}, { auth: 1 });

route('POST', '/api/cases/:number/assign', async ({ req, params, user }) => {
  const c = await getCase(params.number);
  if (!c) fail(404, 'Dossier introuvable.');
  const b = await readJson(req, 2000);
  const updated = await assignCase(c, int(b.lawyer_id, 'Avocat'), user);
  return json({ case: { number: updated.number, status: updated.status, lawyer_name: updated.lawyer_name } });
}, { auth: 2 });
