// Espace avocat
import { api, $, $$, esc, toast, tabs, requireRole, statusPill, domainName, fmtDate, fmtDay, withLoading, confirmModal, dashShell, discordBadge, kpiCard } from './app.mjs';
import { lawyerFields, bindPhoto, readLawyerForm } from './lawyer-form.mjs';
import { WEEKDAYS } from './domains.mjs';

const app = $('#app');
const me = await requireRole(1, app);
if (me) render();

function render() {
  app.innerHTML = dashShell({
    label: 'Espace avocat',
    title: `Bonjour Maître ${esc((me.rp_name || me.name).split(/\s+/).slice(-1)[0])},`,
    sub: 'Vos dossiers, votre agenda et votre fiche professionnelle.',
    actions: discordBadge(),
    nav: [
      { key: 'dossiers', icon: 'folder', label: 'Mes dossiers' },
      { key: 'portefeuille', icon: 'users', label: 'Mon portefeuille' },
      { key: 'calendrier', icon: 'calendar', label: 'Calendrier' },
      { key: 'historique', icon: 'history', label: 'Historique' },
      { key: 'disponibilites', icon: 'clock', label: 'Disponibilités' },
      { key: 'fiche', icon: 'user', label: 'Ma fiche' },
      { sep: true },
      { href: '/espace-client.html', icon: 'home', label: 'Espace client' },
      ...(me.role >= 2 ? [{ href: '/administration.html', icon: 'settings', label: 'Administration' }] : [])
    ]
  });
  tabs(app, name => loaders[name]());
}

const panel = n => $(`[data-panel="${n}"]`);
const table = list => `<div class="table-wrap"><table class="data stack"><thead><tr><th>Dossier</th><th>Client</th><th>Objet</th><th>Domaine</th><th>Statut</th><th>Mise à jour</th></tr></thead><tbody>
  ${list.map(c => `<tr class="clickable" data-href="/dossier.html?n=${encodeURIComponent(c.number)}">
    <td data-label="Dossier"><a class="num" href="/dossier.html?n=${encodeURIComponent(c.number)}">${esc(c.number)}</a></td>
    <td data-label="Client">${esc(c.client_name)}</td><td data-label="Objet">${esc(c.title)}</td><td data-label="Domaine">${esc(domainName(c.domain))}</td>
    <td data-label="Statut">${statusPill(c.status)}${c.lawyer_accepted === null ? ' <span class="pill s-attente_docs">À accepter</span>' : ''}</td><td data-label="Mise à jour">${fmtDate(c.updated_at)}</td></tr>`).join('')}</tbody></table></div>`;
document.addEventListener('click', e => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) location.href = tr.dataset.href; });

const loaders = {
  async portefeuille() {
    const p = panel('portefeuille');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { clients } = await api('/lawyer/portfolio');
    const open = clients.reduce((n, c) => n + c.cases_open, 0);
    p.innerHTML = `
      <div class="kpi-cards">${kpiCard('users', clients.length, clients.length > 1 ? 'Clients suivis' : 'Client suivi', true)}${kpiCard('folder', open, 'Dossiers ouverts')}</div>
      <p class="muted" style="max-width:70ch">Vos clients restent avec vous : leurs nouveaux dossiers vous sont confiés automatiquement et ils ne peuvent prendre rendez-vous qu’avec vous. Seule l’administration peut transférer un client à un autre avocat.</p>
      ${clients.length ? clients.map(c => `<div class="portfolio-client">
        <div class="head"><div><h3>${esc(c.name)}</h3><span class="muted" style="font-size:.85rem">@${esc(c.username)}${c.phone ? ` · Tél. ${esc(c.phone)}` : ''}</span></div>
          <div class="muted" style="font-size:.88rem;text-align:right">${c.cases_open} dossier${c.cases_open > 1 ? 's' : ''} ouvert${c.cases_open > 1 ? 's' : ''} · ${c.cases_total} au total<br>${c.next_appointment ? `Prochain RDV : ${esc(fmtDay(c.next_appointment.slice(0, 10)))} à ${esc(c.next_appointment.slice(11))}` : 'Aucun rendez-vous prévu'}</div></div>
        ${c.cases.length ? `<ul>${c.cases.map(k => `<li><a class="num" href="/dossier.html?n=${encodeURIComponent(k.number)}">${esc(k.number)}</a><span style="flex:1;min-width:140px">${esc(k.title)}</span>${statusPill(k.status)}</li>`).join('')}</ul>` : ''}
      </div>`).join('') : '<div class="empty"><h3>Aucun client pour le moment</h3><p>Un citoyen rejoint votre portefeuille à son premier rendez-vous avec vous ou à la première attribution d’un de ses dossiers.</p></div>'}`;
  },

  async dossiers() {
    const p = panel('dossiers');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const [{ cases }, { profile }] = await Promise.all([api('/lawyer/cases'), api('/lawyer/profile')]);
    const pending = cases.filter(c => c.lawyer_accepted === null);
    const active = cases.filter(c => c.lawyer_accepted !== null);
    p.innerHTML = `
      <div class="kpi-cards">
        ${kpiCard('inbox', pending.length, 'À accepter', true)}
        ${kpiCard('folder', active.length, 'Dossiers suivis')}
        ${kpiCard('clock', active.filter(c => c.status === 'attente_docs').length, 'En attente de documents')}
        ${kpiCard('check', profile.closed, 'Dossiers clôturés')}
      </div>
      ${pending.length ? `<h2 style="font-size:1.6rem">Nouvelles attributions</h2><p class="muted">Ouvrez le dossier pour accepter ou refuser la prise en charge.</p>${table(pending)}<div style="height:40px"></div>` : ''}
      <h2 style="font-size:1.6rem">Dossiers en cours</h2>
      ${active.length ? table(active) : '<div class="empty"><h3>Aucun dossier en cours</h3><p>Les dossiers qui vous sont attribués apparaissent ici.</p></div>'}`;
  },

  async calendrier() {
    const p = panel('calendrier');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { appointments } = await api('/lawyer/appointments');
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = appointments.filter(a => a.status === 'confirme' && a.date >= today);
    const past = appointments.filter(a => !(a.status === 'confirme' && a.date >= today)).reverse().slice(0, 30);
    const byDay = upcoming.reduce((m, a) => ((m[a.date] ||= []).push(a), m), {});
    const row = (a, actions) => `<div class="appt"><div class="t">${esc(a.time)}</div>
      <div class="w"><b>${esc(a.client_name)}</b>${a.case_number ? ` · <a href="/dossier.html?n=${a.case_number}">${esc(a.case_number)}</a>` : ''}<small>${(a.domains || [a.domain]).map(domainName).map(esc).join(' + ')}${a.service ? ` · ${esc(a.service)}` : ''} — ${esc(a.reason)}</small></div>
      <div style="display:flex;gap:6px">${actions ? `<button class="btn btn-ghost btn-sm" data-done="${a.id}">Terminé</button><button class="btn btn-quiet btn-sm" data-cancel="${a.id}">Annuler</button>` : `<span class="pill s-${a.status}">${{ confirme: 'Non clôturé', annule: 'Annulé', termine: 'Terminé' }[a.status]}</span>`}</div></div>`;
    p.innerHTML = `<div class="grid-main"><div>
        <h2 style="font-size:1.6rem">À venir</h2>
        ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) => `<div class="agenda-day"><h4>${esc(fmtDay(d))}</h4>${list.map(a => row(a, true)).join('')}</div>`).join('') : '<p class="muted">Aucun rendez-vous à venir.</p>'}
        <h2 style="font-size:1.6rem;margin-top:40px">Passés</h2>${past.length ? past.map(a => `<div style="opacity:.75">${row(a, a.status === 'confirme')}</div>`).join('') : '<p class="muted">Aucun.</p>'}
      </div>
      <aside class="card"><h3>Programmer un rendez-vous</h3><p class="muted">Ouvrez un dossier et utilisez « Programmer ». Les créneaux proposés sont ceux de l'onglet Disponibilités.</p></aside></div>`;
    $$('[data-done]', p).forEach(b => b.onclick = async () => { try { await api(`/appointments/${b.dataset.done}/complete`, { method: 'POST' }); toast('Rendez-vous marqué comme terminé.'); loaders.calendrier(); } catch (e) { toast(e.message, 'error'); } });
    $$('[data-cancel]', p).forEach(b => b.onclick = async () => {
      if (!await confirmModal('Annuler ce rendez-vous ?', 'Le client sera prévenu sur Discord.', { confirm: 'Annuler le rendez-vous', cancel: 'Garder', danger: true })) return;
      try { await api(`/appointments/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Rendez-vous annulé.'); loaders.calendrier(); } catch (e) { toast(e.message, 'error'); }
    });
  },

  async historique() {
    const p = panel('historique');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { cases } = await api('/lawyer/cases?history=1');
    p.innerHTML = cases.length ? table(cases) : '<div class="empty"><h3>Aucun dossier clôturé</h3></div>';
  },

  async disponibilites() {
    const p = panel('disponibilites');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { availability, profile } = await api('/lawyer/profile');
    const rows = availability.length ? availability : [];
    const rowHtml = r => `<div class="avail-row">
      <select class="input" name="weekday" aria-label="Jour">${WEEKDAYS.map((w, i) => `<option value="${i}" ${+r.weekday === i ? 'selected' : ''}>${w}</option>`).join('')}</select>
      <input class="input" type="time" name="start" value="${r.start}" aria-label="Début">
      <input class="input" type="time" name="end" value="${r.end}" aria-label="Fin">
      <select class="input" name="slot_minutes" aria-label="Durée d'un créneau">${[15, 20, 30, 45, 60].map(m => `<option value="${m}" ${+r.slot_minutes === m ? 'selected' : ''}>${m} min</option>`).join('')}</select>
      <button type="button" class="btn btn-quiet btn-sm" data-del aria-label="Supprimer cette plage">×</button></div>`;
    p.innerHTML = `<div class="grid-main"><form class="card" id="avail-form">
        <div class="card-head"><h2>Plages de réception</h2><button type="button" class="btn btn-ghost btn-sm" id="add-row">Ajouter une plage</button></div>
        <p class="muted">Les citoyens réservent dans ces plages, découpées en créneaux. Un créneau réservé n'est plus proposé.</p>
        <div class="avail-grid" id="avail-rows">${rows.map(rowHtml).join('') || ''}</div>
        <p class="muted" id="avail-empty" ${rows.length ? 'hidden' : ''}>Aucune plage : vous n'apparaissez pas dans la prise de rendez-vous.</p>
        <label class="check" style="margin:20px 0"><input type="checkbox" id="accepts" ${profile.accepts_appointments ? 'checked' : ''}> J'accepte les rendez-vous en ligne</label>
        <button class="btn" type="submit">Enregistrer les disponibilités</button></form>
      <aside class="card"><h3>Exemple</h3><p class="muted">Mardi, 19:00 à 22:00, créneaux de 30 min : six rendez-vous possibles. Les heures sont celles du cabinet.</p></aside></div>`;
    const box = $('#avail-rows');
    $('#add-row').onclick = () => { box.insertAdjacentHTML('beforeend', rowHtml({ weekday: 1, start: '19:00', end: '22:00', slot_minutes: 30 })); $('#avail-empty').hidden = true; };
    box.onclick = e => { if (e.target.closest('[data-del]')) e.target.closest('.avail-row').remove(); };
    $('#avail-form').onsubmit = async e => {
      e.preventDefault();
      const slots = $$('.avail-row', box).map(r => ({ weekday: +$('[name=weekday]', r).value, start: $('[name=start]', r).value, end: $('[name=end]', r).value, slot_minutes: +$('[name=slot_minutes]', r).value }));
      await withLoading($('button[type=submit]', e.target), async () => {
        try {
          await api('/lawyer/availability', { method: 'PUT', body: { slots } });
          const prof = (await api('/lawyer/profile')).profile;
          await api('/lawyer/profile', { method: 'PUT', body: { ...prof, photo: undefined, accepts_appointments: $('#accepts').checked } });
          toast('Disponibilités enregistrées.');
        } catch (err) { toast(err.message, 'error'); }
      });
    };
  },

  async fiche() {
    const p = panel('fiche');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { profile: l } = await api('/lawyer/profile');
    p.innerHTML = `<div class="grid-main"><form class="card" id="fiche-form" novalidate>
        <h2>Fiche professionnelle</h2>
        <p class="muted">Affichée sur les pages Accueil, Équipe et Prise de rendez-vous.</p>
        ${lawyerFields(l)}
        <div style="margin-top:22px"><button class="btn" type="submit">Enregistrer ma fiche</button></div></form>
      <aside class="card"><h3>Statistiques</h3>
        <div class="kpi-cards" style="grid-template-columns:1fr;margin:12px 0 0">${kpiCard('folder', l.active, 'Dossiers en cours')}${kpiCard('check', l.closed, 'Dossiers traités', true)}</div>
        <p class="muted" style="margin-top:16px">Rendez-vous en ligne : ${l.accepts_appointments ? 'ouverts' : 'fermés'} (onglet Disponibilités).</p></aside></div>`;
    const form = $('#fiche-form');
    const photo = bindPhoto(form);
    form.onsubmit = async e => {
      e.preventDefault();
      await withLoading($('button[type=submit]', form), async () => {
        try {
          await api('/lawyer/profile', { method: 'PUT', body: { ...readLawyerForm(form, photo), accepts_appointments: l.accepts_appointments } });
          toast('Fiche enregistrée.'); loaders.fiche();
        } catch (err) { toast(err.message, 'error'); }
      });
    };
  }
};
