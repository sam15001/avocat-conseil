// Page dossier : vue citoyen et vue équipe (avocat, responsable, direction)
import { api, $, $$, esc, toast, requireRole, statusPill, domainName, fmtDate, fmtDateTime, fmtDay, fmtSize, withLoading, modal, confirmModal, dropzone, uploadFiles, ICON_DOC, ymd } from './app.mjs';
import { STATUSES, STATUS_BY_KEY, DOMAINS } from './domains.mjs';

const app = $('#app');
const number = new URLSearchParams(location.search).get('n');
const me = await requireRole(0, app);
if (me) load();

async function load() {
  if (!number) { app.innerHTML = '<div class="wrap gate"><h1>Dossier introuvable</h1><a class="btn" href="/espace-client.html">Mes dossiers</a></div>'; return; }
  let data;
  try { data = await api(`/cases/${encodeURIComponent(number)}`); }
  catch (e) { app.innerHTML = `<div class="wrap gate"><h1 style="font-size:2.4rem">Dossier introuvable</h1><p>${esc(e.message)}</p><a class="btn" href="/espace-client.html#dossiers">Mes dossiers</a></div>`; return; }
  render(data);
}

function progress(status) {
  const s = STATUS_BY_KEY[status];
  const labels = ['Demande reçue', 'Avocat attribué', 'En traitement', status === 'refuse' ? 'Demande refusée' : 'Dossier clôturé'];
  return `<ol class="progress ${status === 'refuse' ? 'refused' : ''}" aria-label="Avancement du dossier">${labels.map((l, i) => {
    const step = i + 1;
    const cls = step < s.step || (step === s.step && step === 4 && status === 'cloture') ? 'done' : step === s.step ? 'current' : '';
    return `<li class="${cls}"${step === s.step ? ' aria-current="step"' : ''}>${esc(l)}</li>`;
  }).join('')}</ol>`;
}

const eventText = e => {
  if (e.type === 'status' || e.type === 'appointment' || e.type === 'assign' || e.type === 'accept') {
    const st = e.to_status && e.from_status !== e.to_status ? ` — ${STATUS_BY_KEY[e.to_status]?.label}` : '';
    return `${esc(e.message || STATUS_BY_KEY[e.to_status]?.label || '')}${e.type === 'status' && e.message ? st : ''}`;
  }
  return esc(e.message || e.type);
};

function render({ case: c, events, documents, appointments }) {
  document.title = `${c.number} — Dominion Law Firm - Avocat & Conseil`;
  const closed = ['cloture', 'refuse'].includes(c.status);
  const staff = c.can_manage;
  const pendingMine = c.lawyer_id === me.id && c.lawyer_accepted === null;
  const isNew = new URLSearchParams(location.search).get('nouveau');
  app.innerHTML = `
  <header class="app-head"><div class="wrap" style="align-items:flex-start">
    <div>
      <nav class="breadcrumb" style="margin-bottom:14px"><a href="${staff && !c.is_owner ? (me.role >= 2 ? '/administration.html#dossiers' : '/espace-avocat.html') : '/espace-client.html#dossiers'}">${staff && !c.is_owner ? 'Dossiers du cabinet' : 'Mes dossiers'}</a><span>/</span><span>${esc(c.number)}</span></nav>
      <h1 style="max-width:24ch">${esc(c.title)}</h1>
      <div class="sub" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px"><span class="num" style="color:var(--bronze-hi);font-weight:500">${esc(c.number)}</span>${statusPill(c.status)}${c.archived ? '<span class="pill neutral">Archivé</span>' : ''}</div>
    </div>
  </div></header>
  <div class="wrap" style="padding:32px var(--gutter) 80px">
    ${isNew ? `<div class="card" style="border-color:var(--bronze-lo);margin-bottom:24px"><b>Demande enregistrée.</b> Conservez votre numéro de dossier <b>${esc(c.number)}</b>. Le cabinet l'attribue à un avocat ; vous serez prévenu sur Discord à chaque étape.</div>` : ''}
    ${pendingMine ? `<div class="card" style="border-color:var(--bronze);margin-bottom:24px"><div class="card-head" style="margin:0"><div><h3 style="margin:0 0 4px">Ce dossier vous a été attribué</h3><span class="muted">Acceptez-vous la prise en charge ?</span></div>
      <div style="display:flex;gap:10px"><button class="btn btn-sm" id="accept">Accepter le dossier</button><button class="btn btn-danger btn-sm" id="refuse">Refuser</button></div></div></div>` : ''}
    <div class="card" style="margin-bottom:24px">${progress(c.status)}</div>
    <div class="grid-main">
      <div>
        <div class="card"><h2>Exposé de la situation</h2><p style="white-space:pre-wrap;max-width:none;color:var(--paper-dim)">${esc(c.description)}</p></div>
        <div class="card"><div class="card-head"><h2>Documents</h2><span class="muted">${documents.length} pièce${documents.length > 1 ? 's' : ''}</span></div>
          ${documents.length ? `<ul class="list-plain">${documents.map(d => `<li><a class="doc-link" href="/api/documents/${d.id}?inline=1" target="_blank" rel="noopener">${ICON_DOC}<span>${esc(d.filename)}</span></a>
            <span class="muted" style="font-size:.82rem;white-space:nowrap">${d.internal ? '<span class="badge-internal">Interne</span> ' : ''}${esc(d.uploader)} · ${fmtSize(d.size)} · ${fmtDate(d.created_at)}</span></li>`).join('')}</ul>` : '<p class="muted">Aucun document pour le moment.</p>'}
          ${!closed || staff ? `<div style="margin-top:20px"><div id="upload"></div>
            ${staff ? '<label class="check" style="margin-top:12px"><input type="checkbox" id="up-internal"> Document interne (invisible pour le client)</label>' : ''}
            <button class="btn btn-sm" id="up-send" style="margin-top:14px">Ajouter les documents</button></div>` : ''}
        </div>
        <div class="card"><h2>Historique</h2>
          <ol class="timeline">${events.map(e => `<li><div class="when">${fmtDateTime(e.created_at)} · ${esc(e.actor || 'Cabinet')}${e.internal ? '<span class="internal">interne</span>' : ''}</div><div class="what">${eventText(e)}</div></li>`).join('')}</ol>
        </div>
      </div>
      <div>
        <div class="card"><h3>Informations</h3>
          <dl class="recap" style="border:0;margin:0">
            <div><dt>Domaine</dt><dd>${esc(domainName(c.domain))}</dd></div>
            ${c.service ? `<div><dt>Prestation</dt><dd>${esc(c.service)}</dd></div>` : ''}
            <div><dt>Avocat</dt><dd>${esc(c.lawyer_name || 'En cours d’attribution')}${c.lawyer_name && c.lawyer_accepted === null ? ' <span class="muted">(en attente de réponse)</span>' : ''}</dd></div>
            ${staff ? `<div><dt>Client</dt><dd>${esc(c.client_name)}<br><span class="muted" style="font-size:.82rem">Discord ${esc(c.client_discord_id)}</span></dd></div>
            <div><dt>Avocat référent</dt><dd>${esc(c.client_referent_name || 'Aucun')}</dd></div>` : ''}
            <div><dt>Déposé le</dt><dd>${fmtDate(c.created_at)}</dd></div>
            <div><dt>Mis à jour</dt><dd>${fmtDateTime(c.updated_at)}</dd></div>
            ${c.closed_at ? `<div><dt>Clôturé le</dt><dd>${fmtDate(c.closed_at)}</dd></div>` : ''}
          </dl></div>
        <div class="card"><div class="card-head" style="margin-bottom:8px"><h3>Rendez-vous</h3>${!closed ? (staff ? '<button class="btn btn-ghost btn-sm" id="schedule">Programmer</button>' : `<a class="btn btn-ghost btn-sm" href="/rendez-vous.html?dossier=${encodeURIComponent(c.number)}&domaine=${c.domain}${c.lawyer_id ? '&avocat=' + c.lawyer_id : ''}">Prendre rendez-vous</a>`) : ''}</div>
          ${appointments.length ? appointments.map(a => `<div class="appt" style="grid-template-columns:1fr auto"><div class="w"><b>${esc(fmtDay(a.date))} · ${esc(a.time)}</b><small>${esc(a.lawyer_name)} — ${esc(a.reason)}</small></div><span class="pill s-${a.status}">${{ confirme: 'Confirmé', annule: 'Annulé', termine: 'Terminé' }[a.status]}</span></div>`).join('') : '<p class="muted">Aucun rendez-vous lié à ce dossier.</p>'}
        </div>
        ${staff ? staffPanel(c) : ''}
      </div>
    </div>
  </div>`;
  bind(c);
}

function staffPanel(c) {
  return `
  <div class="card"><h3>Gestion du dossier</h3>
    <form class="form" id="status-form" style="gap:14px">
      <div class="field"><label for="st">Statut</label><select class="input" id="st" name="status">${STATUSES.map(s => `<option value="${s.key}" ${s.key === c.status ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="st-msg">Message au client (facultatif)</label><textarea class="input" id="st-msg" name="message" maxlength="1000" style="min-height:80px"></textarea></div>
      <button class="btn btn-sm" type="submit">Mettre à jour le statut</button>
    </form>
    ${me.role >= 2 ? `<div style="border-top:1px solid var(--line);margin-top:22px;padding-top:20px;display:grid;gap:10px">
      <button class="btn btn-ghost btn-sm" id="assign">${c.lawyer_id ? 'Réattribuer le dossier' : 'Attribuer à un avocat'}</button>
      <button class="btn btn-ghost btn-sm" id="edit">Modifier les informations</button>
      <button class="btn btn-quiet btn-sm" id="archive">${c.archived ? 'Désarchiver' : 'Archiver le dossier'}</button></div>` : ''}
  </div>
  <div class="card"><div class="card-head" style="margin-bottom:12px"><h3>Notes internes</h3><span class="badge-internal">Invisible pour le client</span></div>
    <form id="note-form" style="margin-bottom:18px"><textarea class="input" name="body" required maxlength="4000" style="min-height:90px" placeholder="Stratégie, échanges, points à vérifier…"></textarea><button class="btn btn-sm" style="margin-top:10px">Ajouter la note</button></form>
    <div id="notes">${(c.notes || []).map(n => `<div class="note"><div class="meta">${esc(n.author)} · ${fmtDateTime(n.created_at)}</div><p>${esc(n.body)}</p></div>`).join('') || '<p class="muted">Aucune note.</p>'}</div>
  </div>`;
}

function bind(c) {
  const reload = () => load();
  const dz = $('#upload') ? dropzone($('#upload')) : null;
  $('#up-send')?.addEventListener('click', e => withLoading(e.currentTarget, async () => {
    if (!dz.files.length) return toast('Ajoutez au moins un fichier.', 'error');
    try { await uploadFiles(c.number, dz.files, { internal: $('#up-internal')?.checked }); toast('Documents ajoutés.'); reload(); }
    catch (err) { toast(err.message, 'error'); }
  }));

  $('#accept')?.addEventListener('click', e => withLoading(e.currentTarget, async () => {
    try { await api(`/cases/${c.number}/accept`, { method: 'POST' }); toast('Dossier accepté.'); reload(); } catch (err) { toast(err.message, 'error'); }
  }));
  $('#refuse')?.addEventListener('click', async () => {
    const r = await modal({ title: 'Refuser la prise en charge', confirm: 'Refuser le dossier', danger: true,
      body: '<div class="field"><label for="rf">Motif (transmis à la direction)</label><textarea class="input" id="rf" name="reason" maxlength="500" style="min-height:90px"></textarea></div>',
      onSubmit: d => api(`/cases/${c.number}/refuse`, { method: 'POST', body: d }) });
    if (r) { toast('Dossier renvoyé pour réattribution.'); location.href = '/espace-avocat.html'; }
  });

  $('#status-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.status === c.status) return toast('Choisissez un statut différent du statut actuel.', 'error');
    if (['cloture', 'refuse'].includes(d.status) && !await confirmModal(`${STATUS_BY_KEY[d.status].label} ?`, 'Le client sera notifié de ce changement.', { confirm: 'Confirmer' })) return;
    await withLoading($('button', e.target), async () => {
      try { await api(`/cases/${c.number}/status`, { method: 'POST', body: d }); toast(`Statut mis à jour : ${STATUS_BY_KEY[d.status].label}.`); reload(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });

  $('#note-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await withLoading($('button', e.target), async () => {
      try { await api(`/cases/${c.number}/notes`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Note ajoutée.'); reload(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });

  $('#assign')?.addEventListener('click', async () => {
    if (c.client_referent_id && c.client_referent_id === c.lawyer_id) {
      return toast(`Ce client est suivi par ${c.client_referent_name}. Pour changer d'avocat, transférez le client depuis Administration → Clients.`, 'error');
    }
    const { lawyers } = await api('/admin/lawyers');
    const active = lawyers.filter(l => l.active);
    if (!active.length) return toast("Aucun avocat actif. Ajoutez-en depuis l'administration.", 'error');
    const spec = active.filter(l => l.specialties.includes(c.domain)), rest = active.filter(l => !l.specialties.includes(c.domain));
    const lockedTo = c.client_referent_id;
    const opt = l => `<option value="${l.user_id}" ${l.user_id === (lockedTo || c.lawyer_id) ? 'selected' : ''} ${lockedTo && l.user_id !== lockedTo ? 'disabled' : ''}>${esc(l.display_name)} — ${l.active_cases} dossier(s) actif(s)${l.user_id === lockedTo ? ' · avocat référent' : ''}</option>`;
    const r = await modal({ title: `Attribuer ${c.number}`, confirm: 'Attribuer',
      body: `<div class="field"><label for="as">Avocat</label><select class="input" id="as" name="lawyer_id" required>
        ${spec.length ? `<optgroup label="Spécialistes ${esc(domainName(c.domain))}">${spec.map(opt).join('')}</optgroup>` : ''}
        ${rest.length ? `<optgroup label="Autres avocats">${rest.map(opt).join('')}</optgroup>` : ''}</select></div>
        <p class="muted" style="font-size:.88rem">${lockedTo ? `Ce client fait partie du portefeuille de ${esc(c.client_referent_name)} : le dossier lui est réservé.` : "L'avocat reçoit une notification et doit accepter la prise en charge. Le client rejoint son portefeuille."}</p>`,
      onSubmit: d => api(`/cases/${c.number}/assign`, { method: 'POST', body: d }) });
    if (r) { toast(`Dossier attribué à ${r.case.lawyer_name}.`); reload(); }
  });

  $('#edit')?.addEventListener('click', async () => {
    const r = await modal({ title: 'Modifier le dossier', confirm: 'Enregistrer',
      body: `<div class="form" style="gap:16px"><div class="field"><label for="e-t">Objet</label><input class="input" id="e-t" name="title" value="${esc(c.title)}" maxlength="140" required></div>
        <div class="field"><label for="e-d">Domaine</label><select class="input" id="e-d" name="domain">${DOMAINS.map(d => `<option value="${d.slug}" ${d.slug === c.domain ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="e-x">Description</label><textarea class="input" id="e-x" name="description" maxlength="6000">${esc(c.description)}</textarea></div></div>`,
      onSubmit: d => api(`/admin/cases/${c.number}`, { method: 'PATCH', body: d }) });
    if (r) { toast('Dossier modifié.'); reload(); }
  });

  $('#archive')?.addEventListener('click', async () => {
    if (!c.archived && !await confirmModal('Archiver ce dossier ?', "Il disparaîtra des listes actives. Vous pourrez le retrouver dans les archives.", { confirm: 'Archiver' })) return;
    try { await api(`/admin/cases/${c.number}/archive`, { method: 'POST', body: { archived: !c.archived } }); toast(c.archived ? 'Dossier désarchivé.' : 'Dossier archivé.'); reload(); }
    catch (err) { toast(err.message, 'error'); }
  });

  $('#schedule')?.addEventListener('click', () => scheduleModal(c, reload));
}

// Programmation d'un rendez-vous par l'avocat (sur ses propres créneaux, ou ceux de l'avocat du dossier pour un responsable)
let schedLawyer = null;
export async function scheduleModal(c, done) {
  const lawyerId = me.role >= 2 && c.lawyer_id ? c.lawyer_id : me.id;
  schedLawyer = lawyerId;
  const days = [...Array(21)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymd(d); });
  const r = await modal({ title: 'Programmer un rendez-vous', confirm: 'Programmer',
    body: `<div class="form" style="gap:16px">
      <div class="field"><label for="sc-d">Date</label><select class="input" id="sc-d" name="date">${days.map(d => `<option value="${d}">${esc(fmtDay(d))}</option>`).join('')}</select></div>
      <div class="field"><label for="sc-t">Créneau libre</label><select class="input" id="sc-t" name="time" required><option value="">Chargement…</option></select>
        <p class="hint">Les créneaux proviennent des disponibilités de ${me.role >= 2 && c.lawyer_id ? "l'avocat du dossier" : 'votre espace avocat'}.</p></div>
      <div class="field"><label for="sc-r">Motif</label><input class="input" id="sc-r" name="reason" required maxlength="500" value="Point sur le dossier ${esc(c.number)}"></div></div>`,
    onSubmit: d => { if (!d.time) throw new Error('Choisissez un créneau.'); return api('/lawyer/appointments', { method: 'POST', body: { ...d, case_number: c.number, lawyer_id: lawyerId } }); } });
  if (r) { toast('Rendez-vous programmé. Le client est prévenu.'); done(); }
}

// Remplit la liste des créneaux quand la modale de programmation est ouverte
document.addEventListener('change', e => { if (e.target.id === 'sc-d') fillSlots(); });
new MutationObserver(() => { const sel = $('#sc-t'); if (sel && !sel.dataset.init) { sel.dataset.init = '1'; fillSlots(); } }).observe(document.body, { childList: true });

async function fillSlots() {
  const sel = $('#sc-t'), date = $('#sc-d')?.value;
  if (!sel || !date) return;
  const { slots } = await api(`/public/slots?lawyer=${schedLawyer}&date=${date}`);
  sel.innerHTML = slots.length ? slots.map(s => `<option value="${s.time}">${s.time}</option>`).join('') : '<option value="">Aucun créneau libre ce jour</option>';
}
