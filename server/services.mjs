// Règles métier partagées par le site et les commandes Discord.
import { all, get, update, addEvent, now, availabilityOf } from './store.mjs';
import { fail } from './http.mjs';
import { notify, dm, embeds, channelForStatus } from './discord.mjs';
import { STATUS_BY_KEY, CLOSED_STATUSES } from '../shared/domains.mjs';

export const displayName = u => u ? (u.rp_name || u.global_name || u.username) : '—';
export const isClosed = s => CLOSED_STATUSES.includes(s);
export const byId = (rows, key = 'id') => new Map(rows.map(r => [r[key], r]));
export const newestFirst = (k = 'updated_at') => (a, b) => String(b[k] || '').localeCompare(String(a[k] || ''));

// Dossier enrichi : avocat, client, avocat référent du client
export async function caseView(c) {
  if (!c) return null;
  const [lawyer, client] = await Promise.all([get('lawyers', c.lawyer_id), get('users', c.client_id)]);
  const ref = client?.referent_lawyer_id ? await get('lawyers', client.referent_lawyer_id) : null;
  return {
    ...c,
    lawyer_name: lawyer?.display_name ?? null,
    client_discord_id: client?.discord_id ?? null,
    client_name: displayName(client),
    client_referent_id: client?.referent_lawyer_id ?? null,
    client_referent_name: ref?.display_name ?? null
  };
}

export async function getCase(number) {
  const n = String(number || '').trim().toUpperCase();
  if (!n) return null;
  const c = (await all('cases')).find(x => x.number === n);
  return caseView(c);
}

export async function getLawyer(userId) {
  const l = await get('lawyers', userId);
  if (!l) return null;
  const u = await get('users', userId);
  return { ...l, discord_id: u?.discord_id ?? null };
}

// Peut-on agir sur ce dossier ? avocat attribué, ou responsable/direction
export function canManageCase(user, c) {
  if (!user) return false;
  if (user.role >= 2) return true;
  return user.role >= 1 && c.lawyer_id === user.id;
}

export async function changeStatus(c, to, actor, message = null) {
  if (!STATUS_BY_KEY[to]) fail(400, 'Statut inconnu.');
  if (c.status === to) fail(400, 'Le dossier a déjà ce statut.');
  const from = c.status;
  const t = now();
  await update('cases', c.id, { status: to, updated_at: t, closed_at: isClosed(to) ? t : null });
  await addEvent(c.id, { actor_id: actor.id, type: 'status', from_status: from, to_status: to, message });
  const updated = { ...c, status: to, updated_at: t };
  await notify(channelForStatus(to), embeds.statusChange(updated, from, to, c.lawyer_name, displayName(actor), message));
  if (c.client_discord_id) {
    await dm(c.client_discord_id, {
      title: `Votre dossier ${c.number}`,
      description: `Nouveau statut : **${STATUS_BY_KEY[to].label}**${message ? `\n\n${message}` : ''}`
    });
  }
  return updated;
}

export async function assignCase(c, lawyerId, actor) {
  if (isClosed(c.status)) fail(400, 'Ce dossier est clôturé.');
  const lawyer = await getLawyer(lawyerId);
  if (!lawyer || !lawyer.active) fail(400, 'Avocat introuvable ou inactif.');
  // Portefeuille : un client reste avec son avocat référent
  if (c.client_referent_id && c.client_referent_id !== lawyerId) {
    fail(409, `Ce client est suivi par ${c.client_referent_name}, son avocat référent. Pour confier ce dossier à un autre avocat, transférez d'abord le client depuis Administration → Clients.`);
  }
  const newStatus = ['recue', 'attente'].includes(c.status) ? 'attribue' : c.status;
  await update('cases', c.id, { lawyer_id: lawyerId, lawyer_accepted: null, status: newStatus, updated_at: now() });
  await addEvent(c.id, { actor_id: actor.id, type: 'assign', from_status: c.status, to_status: newStatus, message: `Dossier confié à ${lawyer.display_name}` });
  await setReferentIfNone(c.client_id, lawyerId);
  const updated = { ...c, lawyer_id: lawyerId, status: newStatus };
  await notify('active', embeds.assign(updated, lawyer.display_name, displayName(actor)));
  if (lawyer.discord_id) {
    await dm(lawyer.discord_id, { title: `Nouveau dossier attribué : ${c.number}`, description: `${c.title}\n\nAcceptez ou refusez la prise en charge depuis votre espace avocat.` });
  }
  return { ...updated, lawyer_name: lawyer.display_name };
}

// Date du jour et lundi d'une semaine (UTC, comme les dates enregistrées)
const ymd = d => d.toISOString().slice(0, 10);
const monday = d => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };

export async function stats() {
  const [cases, appts, lawyers] = await Promise.all([all('cases'), all('appointments'), all('lawyers')]);
  const live = cases.filter(c => !c.archived);
  const count = (arr, f) => arr.filter(f).length;
  const today = ymd(new Date());
  const totals = {
    total: live.length,
    pending: count(live, c => ['recue', 'attente'].includes(c.status)),
    active: count(live, c => ['attribue', 'rdv', 'en_cours', 'attente_docs'].includes(c.status)),
    closed: count(live, c => c.status === 'cloture'),
    refused: count(live, c => c.status === 'refuse'),
    unassigned: count(live, c => !c.lawyer_id && !isClosed(c.status))
  };
  const validAppts = appts.filter(a => a.status !== 'annule');
  const appointments = { total: validAppts.length, upcoming: count(validAppts, a => a.status === 'confirme' && a.date >= today) };
  const group = (arr, key) => Object.entries(arr.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {})).map(([k, n]) => ({ [key]: k, n }));
  const byStatus = group(live, 'status');
  const byDomain = group(cases, 'domain').sort((a, b) => b.n - a.n);
  const lawyerStats = lawyers.map(l => ({
    user_id: l.user_id, display_name: l.display_name, active: l.active,
    active_cases: count(cases, c => c.lawyer_id === l.user_id && !isClosed(c.status)),
    closed_cases: count(cases, c => c.lawyer_id === l.user_id && c.status === 'cloture'),
    appointments: count(validAppts, a => a.lawyer_id === l.user_id)
  })).sort((a, b) => b.active_cases - a.active_cases || a.display_name.localeCompare(b.display_name));
  const start = monday(new Date());
  start.setUTCDate(start.getUTCDate() - 7 * 11);
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const w = new Date(start); w.setUTCDate(w.getUTCDate() + 7 * i);
    const key = ymd(w);
    return { week: key, n: count(cases, c => ymd(monday(new Date(c.created_at))) === key) };
  });
  return { totals, appointments, byStatus, byDomain, lawyers: lawyerStats, weekly };
}

// Créneaux libres d'un avocat pour une date (YYYY-MM-DD)
export async function freeSlots(lawyerId, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Date invalide.');
  const lawyer = await get('lawyers', lawyerId);
  if (!lawyer || !lawyer.active || !lawyer.accepts_appointments) return [];
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const ranges = (await availabilityOf(lawyerId)).filter(r => r.weekday === weekday);
  const taken = new Set((await all('appointments')).filter(a => a.lawyer_id === lawyerId && a.date === date && a.status !== 'annule').map(a => a.time));
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const fmt = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const out = [];
  for (const r of ranges) {
    for (let m = toMin(r.start); m + r.slot_minutes <= toMin(r.end); m += r.slot_minutes) {
      const t = fmt(m);
      if (!taken.has(t)) out.push({ time: t, duration: r.slot_minutes });
    }
  }
  return out;
}

// Rattache le client au portefeuille de l'avocat s'il n'a pas encore d'avocat référent.
// Ses dossiers encore en attente d'attribution rejoignent aussi le portefeuille.
export async function setReferentIfNone(clientId, lawyerId) {
  const client = await get('users', clientId);
  if (!client || client.referent_lawyer_id) return;
  await update('users', clientId, { referent_lawyer_id: lawyerId });
  const waiting = (await all('cases')).filter(c => c.client_id === clientId && !c.lawyer_id && ['recue', 'attente'].includes(c.status));
  for (const c of waiting) {
    await update('cases', c.id, { lawyer_id: lawyerId, lawyer_accepted: true, status: 'attribue', updated_at: now() });
    await addEvent(c.id, { type: 'assign', to_status: 'attribue', message: 'Dossier confié à votre avocat référent' });
  }
}
