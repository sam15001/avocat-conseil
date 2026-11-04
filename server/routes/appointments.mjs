import { route } from '../router.mjs';
import { json, readJson, str, int, fail } from '../http.mjs';
import { all, get, insert, update, nextId, addEvent, now, lockSlot, unlockSlot } from '../store.mjs';
import { notify, dm, embeds, formatDateFr } from '../discord.mjs';
import { freeSlots, getCase, canManageCase, displayName, setReferentIfNone, isClosed } from '../services.mjs';
import { todayInTz, nowTimeInTz } from './public.mjs';
import { DOMAIN_BY_SLUG } from '../../shared/domains.mjs';
import { validateService } from './services.mjs';

// Rendez-vous enrichis : avocat, client, dossier lié
async function apptViews(filter) {
  const [appts, lawyers, users, cases] = await Promise.all([all('appointments'), all('lawyers'), all('users'), all('cases')]);
  const L = new Map(lawyers.map(l => [l.user_id, l])), U = new Map(users.map(u => [u.id, u])), C = new Map(cases.map(c => [c.id, c]));
  return appts.filter(filter).map(a => {
    const u = U.get(a.client_id);
    return { id: a.id, date: a.date, time: a.time, duration: a.duration, domain: a.domain, domains: a.domains || [a.domain], service: a.service, services: a.services || null, reason: a.reason, status: a.status,
      lawyer_name: L.get(a.lawyer_id)?.display_name ?? null, lawyer_id: a.lawyer_id, case_number: C.get(a.case_id)?.number ?? null,
      client_name: displayName(u), client_discord_id: u?.discord_id ?? null, client_id: a.client_id };
  });
}
const byWhen = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
const slotKey = (lawyerId, date, time) => `${lawyerId}_${date}_${time.replace(':', '')}`;

async function book({ user, client, lawyerId, date, time, reason, domain, service = null, picks = null, caseRow, createdBy }) {
  if (picks) for (const x of picks) await validateService(x.domain, x.name); else await validateService(domain, service);
  // Portefeuille : le client ne consulte que son avocat référent
  const fresh = await get('users', client.id);
  const refLawyer = fresh?.referent_lawyer_id ? await get('lawyers', fresh.referent_lawyer_id) : null;
  const ref = fresh?.referent_lawyer_id ? { id: fresh.referent_lawyer_id, display_name: refLawyer?.display_name, active: !!refLawyer?.active } : null;
  if (ref?.id && ref.id !== lawyerId) {
    fail(409, ref.active
      ? `Ce client est suivi par ${ref.display_name}, son avocat référent : le rendez-vous doit être pris avec lui.`
      : `L'avocat référent de ce client n'est plus actif. Le cabinet doit d'abord lui attribuer un nouvel avocat.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) fail(400, 'Date ou heure invalide.');
  const today = todayInTz();
  if (date < today || (date === today && time <= nowTimeInTz())) fail(400, 'Ce créneau est déjà passé.');
  const slot = (await freeSlots(lawyerId, date)).find(s => s.time === time);
  if (!slot) fail(409, "Ce créneau n'est plus disponible. Choisissez-en un autre.");
  const lawyer = { display_name: (await get('lawyers', lawyerId)).display_name, discord_id: (await get('users', lawyerId))?.discord_id };

  // Un créneau ne peut être pris qu'une fois, même si deux personnes réservent à la même seconde
  const id = await nextId('appointments');
  const key = slotKey(lawyerId, date, time);
  if (!await lockSlot(key, id)) fail(409, "Ce créneau vient d'être réservé. Choisissez-en un autre.");
  const appt = await insert('appointments', { case_id: caseRow?.id || null, client_id: client.id, lawyer_id: lawyerId, domain, service, ...(picks?.length ? { services: picks, domains: [...new Set(picks.map(x => x.domain))] } : {}), date, time,
    duration: slot.duration, reason, status: 'confirme', created_by: createdBy.id }, { id });
  await setReferentIfNone(client.id, lawyerId);
  if (caseRow && !isClosed(caseRow.status)) {
    await update('cases', caseRow.id, { status: 'rdv', updated_at: now() });
    await addEvent(caseRow.id, { actor_id: createdBy.id, type: 'appointment', from_status: caseRow.status, to_status: 'rdv', message: `Rendez-vous le ${formatDateFr(date, time)} avec ${lawyer.display_name}` });
  }

  await notify('appointments', embeds.newAppointment({ ...appt, date, time, service, case_number: caseRow?.number }, client, lawyer.display_name));
  await dm(client.discord_id, { title: 'Rendez-vous confirmé', description: `Le ${formatDateFr(date, time)} avec ${lawyer.display_name}.${service ? `\nPrestation : ${service}` : ''}\nMotif : ${reason}` }, [['Mes rendez-vous', '/espace-client.html#rendez-vous']]);
  if (lawyer.discord_id && lawyer.discord_id !== client.discord_id) {
    await dm(lawyer.discord_id, { title: 'Nouveau rendez-vous', description: `${displayName(client)} — ${formatDateFr(date, time)}\n${reason}` }, [['Mon calendrier', '/espace-avocat.html#calendrier']]);
  }
  return appt;
}

// ── Citoyen
route('GET', '/api/appointments', async ({ user }) => {
  return json({ appointments: (await apptViews(a => a.client_id === user.id)).sort(byWhen).reverse() });
}, { auth: 'user' });

route('POST', '/api/appointments', async ({ req, user }) => {
  const b = await readJson(req, 10000);
  const domain = str(b.domain, 'Domaine');
  if (!DOMAIN_BY_SLUG[domain]) fail(400, 'Domaine juridique inconnu.');
  let caseRow = null;
  if (b.case_number) {
    caseRow = await getCase(b.case_number);
    if (!caseRow || caseRow.client_id !== user.id) fail(404, 'Dossier introuvable.');
  }
  const today = todayInTz();
  const upcoming = (await all('appointments')).filter(a => a.client_id === user.id && a.status === 'confirme' && a.date >= today).length;
  if (upcoming >= 3) fail(429, 'Vous avez déjà 3 rendez-vous à venir.');
  // Plusieurs prestations possibles, y compris de domaines différents : [{ domain, name }]
  let picks = Array.isArray(b.services) ? b.services : (b.service ? [{ domain, name: b.service }] : []);
  if (picks.length > 8) fail(400, 'Choisissez 8 prestations au maximum.');
  picks = picks.map(x => ({ domain: str(x?.domain, 'Domaine'), name: str(x?.name, 'Prestation', { max: 120 }) }));
  for (const x of picks) if (!DOMAIN_BY_SLUG[x.domain]) fail(400, 'Domaine juridique inconnu.');
  picks = picks.filter((x, i) => picks.findIndex(y => y.domain === x.domain && y.name === x.name) === i);
  const appt = await book({
    user, client: user, createdBy: user, caseRow, domain: picks[0]?.domain || domain, picks,
    lawyerId: int(b.lawyer_id, 'Avocat'), date: str(b.date, 'Date'), time: str(b.time, 'Créneau'),
    service: picks.map(x => x.name).join(' · ') || null,
    reason: str(b.reason, 'Motif', { min: 5, max: 500 })
  });
  return json({ appointment: { id: appt.id } }, 201);
}, { auth: 'user' });

route('POST', '/api/appointments/:id/cancel', async ({ params, user }) => {
  const aid = int(params.id, 'id');
  const a = (await apptViews(x => x.id === aid))[0];
  const staff = a && (user.role >= 2 || (user.role >= 1 && a.lawyer_id === user.id));
  if (!a || (a.client_id !== user.id && !staff)) fail(404, 'Rendez-vous introuvable.');
  if (a.status !== 'confirme') fail(400, 'Ce rendez-vous ne peut plus être annulé.');
  await update('appointments', a.id, { status: 'annule' });
  await unlockSlot(slotKey(a.lawyer_id, a.date, a.time));
  await notify('appointments', embeds.cancelAppointment(a, displayName(user), a.lawyer_name));
  if (staff && a.client_discord_id) await dm(a.client_discord_id, { title: 'Rendez-vous annulé', description: `Votre rendez-vous du ${formatDateFr(a.date, a.time)} avec ${a.lawyer_name} a été annulé par le cabinet.` }, [['Reprendre rendez-vous', '/rendez-vous.html']]);
  return json({ ok: true });
}, { auth: 'user' });

// ── Avocat
route('GET', '/api/lawyer/appointments', async ({ user, query }) => {
  const everyone = query.get('all') === '1' && user.role >= 2;
  return json({ appointments: (await apptViews(a => everyone || a.lawyer_id === user.id)).sort(byWhen) });
}, { auth: 1 });

route('POST', '/api/lawyer/appointments', async ({ req, user }) => {
  const b = await readJson(req, 10000);
  const caseRow = await getCase(b.case_number);
  if (!caseRow || !canManageCase(user, caseRow)) fail(404, 'Dossier introuvable.');
  const client = await get('users', caseRow.client_id);
  const lawyerId = user.role >= 2 && b.lawyer_id ? int(b.lawyer_id, 'Avocat') : user.id;
  const appt = await book({
    user, client, createdBy: user, caseRow, domain: caseRow.domain, service: caseRow.service, lawyerId,
    date: str(b.date, 'Date'), time: str(b.time, 'Créneau'), reason: str(b.reason, 'Motif', { min: 3, max: 500 })
  });
  return json({ appointment: { id: appt.id } }, 201);
}, { auth: 1 });

route('POST', '/api/appointments/:id/complete', async ({ params, user }) => {
  const a = await get('appointments', int(params.id, 'id'));
  if (!a || (a.lawyer_id !== user.id && user.role < 2)) fail(404, 'Rendez-vous introuvable.');
  if (a.status !== 'confirme') fail(400, 'Ce rendez-vous n’est pas en attente.');
  await update('appointments', a.id, { status: 'termine' });
  return json({ ok: true });
}, { auth: 1 });
