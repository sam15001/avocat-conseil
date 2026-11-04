// Administration du cabinet (responsable juridique et direction)
import { api, $, $$, esc, toast, resizeImage, tabs, requireRole, roleName, statusPill, domainName, fmtDate, fmtDateTime, fmtDay, fmtShort, withLoading, modal, confirmModal, dashShell, discordBadge, kpiCard, initials, ICONS } from './app.mjs';
import { lawyerFields, bindPhoto, readLawyerForm } from './lawyer-form.mjs';
import { DOMAINS, STATUSES, WEEKDAYS, ROLES, PRICE_UNITS, fmtPrice, SITE_PHOTOS } from './domains.mjs';

const app = $('#app');
const me = await requireRole(2, app);

const TABS = [['tableau', 'Tableau de bord', 'dashboard'], ['dossiers', 'Dossiers', 'folder'], ['rendez-vous', 'Rendez-vous', 'calendar'], ['avocats', 'Avocats', 'scales'], ['prestations', 'Prestations', 'briefcase'], ['contrats', 'Contrats', 'folder'],
  ['clients', 'Clients', 'users'], ['candidatures', 'Candidatures', 'inbox'], ['messages', 'Messages', 'message'], ['actualites', 'Actualités', 'news'], ['photos', 'Photos du site', 'camera'],
  ...(me?.role >= 3 ? [['parametres', 'Paramètres', 'settings']] : [])];

function render() {
  app.innerHTML = dashShell({
    label: 'Administration',
    title: 'Tableau de bord',
    sub: `Vue d'ensemble du cabinet · ${esc(roleName(me.role))}`,
    actions: `${discordBadge()}<a class="btn btn-ghost btn-sm" href="/espace-avocat.html">Espace avocat</a>`,
    nav: TABS.map(([key, label, icon]) => ({ key, label, icon }))
  });
  const titles = Object.fromEntries(TABS.map(([k, l]) => [k, l]));
  const subs = { tableau: "Vue d'ensemble du cabinet", dossiers: 'Recherche, filtres et attribution', 'rendez-vous': 'Agenda de tous les avocats', avocats: 'Fiches, coordonnées, photos et accès', prestations: 'Catalogue et tarifs, par module',
    clients: 'Comptes citoyens et historique', candidatures: 'Candidatures reçues depuis la page Recrutement', messages: 'Messages du formulaire de contact', actualites: 'Articles publiés sur le site', contrats: 'Contrats de travail rédigés et signés sur Discord (/contrat)', photos: 'Locaux, bureaux, tribunal : vos propres photos', parametres: 'Salons et rôles Discord' };
  tabs(app, name => { $('.dash-head h1').textContent = titles[name]; $('.dash-head .sub').textContent = subs[name]; return loaders[name](); });
}

const panel = n => $(`[data-panel="${n}"]`);
const setCount = (k, n) => { const el = $(`[data-count="${k}"]`); if (el) { el.textContent = n; el.hidden = !n; } };
document.addEventListener('click', e => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button,select,input')) location.href = tr.dataset.href; });

// ── Graphiques (une seule série : teinte bronze unique, valeurs étiquetées, info-bulle au survol)
const bars = (rows, label) => {
  const max = Math.max(1, ...rows.map(r => r.n));
  return rows.length ? rows.map(r => `<div class="bar-row" title="${esc(label(r))} : ${r.n}"><span>${esc(label(r))}</span><div class="track"><div class="fill" style="width:${(r.n / max) * 100}%"></div></div><b>${r.n}</b></div>`).join('') : '<p class="muted">Pas encore de données.</p>';
};
function lineChart(weeks) {
  const W = 680, H = 230, L = 34, R = 16, T = 18, B = 30;
  const max = Math.max(4, ...weeks.map(w => w.n));
  const step = Math.ceil(max / 4), top = step * 4;
  const x = i => L + (i * (W - L - R)) / (weeks.length - 1);
  const y = v => T + (H - T - B) * (1 - v / top);
  const pts = weeks.map((w, i) => [x(i), y(w.n)]);
  const curve = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const peak = weeks.reduce((m, w, i) => (w.n > weeks[m].n ? i : m), 0);
  const label = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `<svg class="chart line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nouvelles demandes par semaine, 12 dernières semaines">
    <defs><linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C5A16B" stop-opacity=".32"/><stop offset="1" stop-color="#C5A16B" stop-opacity="0"/></linearGradient></defs>
    <g class="grid">${[0, 1, 2, 3, 4].map(k => `<line x1="${L}" x2="${W - R}" y1="${y(k * step)}" y2="${y(k * step)}"/><text x="${L - 8}" y="${y(k * step) + 4}" text-anchor="end">${k * step}</text>`).join('')}</g>
    <path class="area" d="${curve} L${x(weeks.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z"/>
    <path class="curve" d="${curve}"/>
    ${weeks.map((w, i) => `<g><title>Semaine du ${label(w.week)} : ${w.n} demande${w.n > 1 ? 's' : ''}</title>
      <rect class="hit" x="${x(i) - 22}" y="${T}" width="44" height="${H - T - B}" fill="transparent"/>
      <circle class="pt" cx="${pts[i][0]}" cy="${pts[i][1]}" r="4"/>
      ${(i === peak && w.n) || i === weeks.length - 1 ? `<text class="val" x="${pts[i][0]}" y="${pts[i][1] - 10}" text-anchor="middle">${w.n}</text>` : ''}
      ${i % 2 === 1 || weeks.length < 8 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${label(w.week)}</text>` : ''}</g>`).join('')}
  </svg>`;
}

const face = (photo, name) => `<span class="face">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(name))}</span>`;

let lawyersCache = null;
const getLawyers = async (fresh) => (lawyersCache && !fresh) ? lawyersCache : (lawyersCache = (await api('/admin/lawyers')).lawyers);

const loaders = {
  async tableau() {
    const p = panel('tableau');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const [s, { appointments }, { cases }, lawyers] = await Promise.all([api('/admin/stats'), api('/lawyer/appointments?all=1'), api('/admin/cases'), getLawyers(true)]);
    setCount('dossiers', s.totals.unassigned);
    const photos = Object.fromEntries(lawyers.map(l => [l.user_id, l.photo]));
    const today = new Date().toISOString().slice(0, 10);
    const next = appointments.filter(a => a.status === 'confirme' && a.date >= today).slice(0, 5);
    p.innerHTML = `
      <div class="kpi-cards">
        ${kpiCard('folder', s.totals.total, 'Total dossiers')}
        ${kpiCard('clock', s.totals.pending, 'En attente', true)}
        ${kpiCard('play', s.totals.active, 'En cours')}
        ${kpiCard('check', s.totals.closed, 'Terminés')}
        ${kpiCard('calendar', s.appointments.upcoming, 'Rendez-vous à venir')}
      </div>
      ${s.totals.unassigned ? `<div class="card" style="border-color:var(--bronze-lo);margin-bottom:24px"><div class="card-head" style="margin:0"><span><b>${s.totals.unassigned} dossier${s.totals.unassigned > 1 ? 's' : ''}</b> sans avocat attribué.</span><button class="btn btn-sm" data-unassigned>Attribuer les dossiers</button></div></div>` : ''}
      <div class="grid-main">
        <div>
          <div class="card"><div class="card-head"><h3>Activité du cabinet</h3><span class="muted" style="font-size:.85rem">Nouvelles demandes, 12 dernières semaines</span></div>${lineChart(s.weekly)}</div>
          <div class="card"><div class="card-head"><h3>Dernières demandes</h3><a class="link-more" style="margin:0" href="#dossiers">Voir tout${ICONS.arrow}</a></div>
            ${cases.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Dossier</th><th>Domaine</th><th>Client</th><th>Statut</th><th>Mise à jour</th></tr></thead><tbody>
            ${cases.slice(0, 6).map(c => `<tr class="clickable" data-href="/dossier.html?n=${encodeURIComponent(c.number)}"><td data-label="Dossier"><a class="num" href="/dossier.html?n=${encodeURIComponent(c.number)}">${esc(c.number)}</a></td><td data-label="Domaine">${esc(domainName(c.domain))}</td><td data-label="Client">${esc(c.client_name)}</td><td data-label="Statut">${statusPill(c.status)}</td><td data-label="Mise à jour" class="nowrap">${fmtShort(c.updated_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune demande pour le moment.</p>'}
          </div>
        </div>
        <div class="card"><div class="card-head"><h3>Prochains rendez-vous</h3><a class="link-more" style="margin:0" href="#rendez-vous">Voir tout${ICONS.arrow}</a></div>
          ${next.length ? `<ul class="upnext">${next.map(a => `<li>${face(photos[a.lawyer_id], a.lawyer_name)}<div><span class="when">${esc(a.date === today ? "Aujourd'hui" : fmtDay(a.date))} · ${esc(a.time)}</span><b style="display:block">${esc(a.lawyer_name)}</b><small>${esc(a.client_name)} — ${esc(domainName(a.domain))}</small></div></li>`).join('')}</ul>` : '<p class="muted">Aucun rendez-vous à venir.</p>'}
        </div>
      </div>
      <div class="grid-2" style="margin-top:24px">
        <div class="card"><h3>Dossiers par statut</h3>${bars(STATUSES.map(st => ({ label: st.label, n: s.byStatus.find(b => b.status === st.key)?.n || 0 })).filter(r => r.n), r => r.label)}</div>
        <div class="card"><h3>Dossiers par domaine</h3>${bars(s.byDomain, r => domainName(r.domain))}</div>
      </div>
      <div class="card" style="margin-top:24px"><h3>Activité des avocats</h3>
        ${s.lawyers.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Avocat</th><th>En cours</th><th>Clôturés</th><th>Rendez-vous</th></tr></thead><tbody>
          ${s.lawyers.map(l => `<tr><td data-label="Avocat"><span class="lawyer-row">${face(photos[l.user_id], l.display_name).replace('class="face"', 'class="face" style="width:34px;height:42px"')}${esc(l.display_name)}${l.active ? '' : ' <span class="pill neutral">Inactif</span>'}</span></td><td data-label="En cours">${l.active_cases}</td><td data-label="Clôturés">${l.closed_cases}</td><td data-label="RDV">${l.appointments}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun avocat enregistré.</p>'}</div>`;
    $('[data-unassigned]', p)?.addEventListener('click', () => { filters.lawyer = 'none'; location.hash = 'dossiers'; });
  },

  async 'rendez-vous'() {
    const p = panel('rendez-vous');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { appointments } = await api('/lawyer/appointments?all=1');
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = appointments.filter(a => a.status === 'confirme' && a.date >= today);
    const past = appointments.filter(a => !(a.status === 'confirme' && a.date >= today)).reverse().slice(0, 40);
    const byDay = upcoming.reduce((m, a) => ((m[a.date] ||= []).push(a), m), {});
    const row = (a, act) => `<div class="appt"><div class="t">${esc(a.time)}</div>
      <div class="w"><b>${esc(a.client_name)}</b> avec ${esc(a.lawyer_name)}${a.case_number ? ` · <a href="/dossier.html?n=${a.case_number}">${esc(a.case_number)}</a>` : ''}<small>${(a.domains || [a.domain]).map(domainName).map(esc).join(' + ')}${a.service ? ` · ${esc(a.service)}` : ''} — ${esc(a.reason)}</small></div>
      <div style="display:flex;gap:6px">${act ? `<button class="btn btn-ghost btn-sm" data-done="${a.id}">Terminé</button><button class="btn btn-quiet btn-sm" data-cancel="${a.id}">Annuler</button>` : `<span class="pill s-${a.status}">${{ confirme: 'Non clôturé', annule: 'Annulé', termine: 'Terminé' }[a.status]}</span>`}</div></div>`;
    p.innerHTML = `<div class="card"><h2>À venir</h2>${Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) => `<div class="agenda-day"><h4>${esc(d === today ? "Aujourd'hui" : fmtDay(d))}</h4>${list.map(a => row(a, true)).join('')}</div>`).join('') : '<p class="muted">Aucun rendez-vous à venir.</p>'}</div>
      <div class="card"><h2>Passés et annulés</h2>${past.length ? past.map(a => row(a, false)).join('') : '<p class="muted">Aucun.</p>'}</div>`;
    $$('[data-done]', p).forEach(b => b.onclick = async () => { try { await api(`/appointments/${b.dataset.done}/complete`, { method: 'POST' }); toast('Rendez-vous marqué comme terminé.'); loaders['rendez-vous'](); } catch (e) { toast(e.message, 'error'); } });
    $$('[data-cancel]', p).forEach(b => b.onclick = async () => {
      if (!await confirmModal('Annuler ce rendez-vous ?', 'Le client sera prévenu sur Discord.', { confirm: 'Annuler le rendez-vous', cancel: 'Garder', danger: true })) return;
      try { await api(`/appointments/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Rendez-vous annulé.'); loaders['rendez-vous'](); } catch (e) { toast(e.message, 'error'); }
    });
  },

  async dossiers() {
    const p = panel('dossiers');
    const lawyers = await getLawyers();
    if (!p.dataset.ready) {
      p.dataset.ready = '1';
      p.innerHTML = `<div class="toolbar">
        <input class="input search" type="search" name="q" placeholder="Rechercher : numéro, objet, client, identifiant Discord" aria-label="Rechercher un dossier">
        <select class="input" name="domain" aria-label="Domaine"><option value="">Tous les domaines</option>${DOMAINS.map(d => `<option value="${d.slug}">${esc(d.name)}</option>`).join('')}</select>
        <select class="input" name="status" aria-label="Statut"><option value="">Tous les statuts</option>${STATUSES.map(s => `<option value="${s.key}">${esc(s.label)}</option>`).join('')}</select>
        <select class="input" name="lawyer" aria-label="Avocat"><option value="">Tous les avocats</option><option value="none">Non attribués</option>${lawyers.map(l => `<option value="${l.user_id}">${esc(l.display_name)}</option>`).join('')}</select>
        <select class="input" name="archived" aria-label="Archives"><option value="">Dossiers actifs</option><option value="1">Archives</option></select>
      </div><div id="case-results"></div>`;
      let t;
      $$('.toolbar [name]', p).forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { clearTimeout(t); t = setTimeout(() => { filters[el.name] = el.value; loadCases(); }, 250); }));
    }
    for (const [k, v] of Object.entries(filters)) { const el = $(`.toolbar [name=${k}]`, p); if (el) el.value = v; }
    loadCases();
  },

  async prestations() {
    const p = panel('prestations');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { services } = await api('/admin/services');
    serviceCache = services;
    const shown = svcFilter ? services.filter(s => s.domain === svcFilter) : services;
    const byDomain = DOMAINS.filter(d => shown.some(s => s.domain === d.slug));
    p.innerHTML = `<div class="toolbar" style="align-items:center">
        <select class="input" id="svc-filter" aria-label="Module" style="flex:0 1 280px"><option value="">Tous les modules (${services.length})</option>
          ${DOMAINS.map(d => `<option value="${d.slug}" ${svcFilter === d.slug ? 'selected' : ''}>${esc(d.name)} (${services.filter(s => s.domain === d.slug).length})</option>`).join('')}</select>
        <span style="flex:1"></span><button class="btn" id="add-svc">${ICONS.plus}Ajouter une prestation</button></div>
      ${byDomain.map(d => `<div class="card"><div class="card-head"><h2>Module ${esc(d.name.replace(/^Droit /, '').replace(/^d'/, ''))}</h2>
          <button class="btn btn-ghost btn-sm" data-add-in="${d.slug}">${ICONS.plus}Ajouter dans ce module</button></div>
        <div class="table-wrap"><table class="data stack"><thead><tr><th>Prestation</th><th>Rubrique</th><th>Prix</th><th>Utilisée</th><th>État</th><th></th></tr></thead><tbody>
        ${shown.filter(s => s.domain === d.slug).map(s => `<tr${s.active ? '' : ' style="opacity:.55"'}>
          <td data-label="Prestation"><b style="font-weight:500">${esc(s.name)}</b>${s.description ? `<br><span class="muted" style="font-size:.84rem">${esc(s.description)}</span>` : ''}</td>
          <td data-label="Rubrique" style="font-size:.88rem">${esc(s.group_name)}</td>
          <td data-label="Prix"><span class="price-tag${s.price === 0 ? ' free' : ''}">${esc(fmtPrice(s.price, s.price_unit))}</span></td>
          <td data-label="Utilisée" class="nowrap" style="font-size:.85rem">${s.cases} dossier${s.cases > 1 ? 's' : ''} · ${s.appointments} RDV</td>
          <td data-label="État"><label class="check" style="font-size:.85rem"><input type="checkbox" data-toggle="${s.id}" ${s.active ? 'checked' : ''}> Visible</label></td>
          <td class="nowrap"><button class="btn btn-ghost btn-sm" data-edit-svc="${s.id}">Modifier</button> <button class="btn btn-quiet btn-sm" data-del-svc="${s.id}" aria-label="Supprimer ${esc(s.name)}">Supprimer</button></td></tr>`).join('')}
        </tbody></table></div></div>`).join('') || '<div class="empty"><h3>Aucune prestation</h3><p>Ajoutez la première prestation du catalogue.</p></div>'}`;
    $('#svc-filter').onchange = e => { svcFilter = e.target.value; loaders.prestations(); };
    $('#add-svc').onclick = () => serviceModal(null, svcFilter);
    $$('[data-add-in]', p).forEach(b => b.onclick = () => serviceModal(null, b.dataset.addIn));
    $$('[data-edit-svc]', p).forEach(b => b.onclick = () => serviceModal(services.find(s => s.id === +b.dataset.editSvc)));
    $$('[data-toggle]', p).forEach(c => c.onchange = async () => {
      const s = services.find(x => x.id === +c.dataset.toggle);
      try { await api(`/admin/services/${s.id}`, { method: 'PATCH', body: { ...s, active: c.checked } }); toast(c.checked ? 'Prestation visible.' : 'Prestation masquée du site.'); loaders.prestations(); }
      catch (e) { toast(e.message, 'error'); c.checked = !c.checked; }
    });
    $$('[data-del-svc]', p).forEach(b => b.onclick = async () => {
      const s = services.find(x => x.id === +b.dataset.delSvc);
      if (!await confirmModal(`Supprimer « ${s.name} » ?`, s.cases || s.appointments ? 'Les dossiers et rendez-vous existants gardent cet intitulé. Pour seulement la retirer du site, décochez plutôt « Visible ».' : 'La prestation sera retirée du catalogue.', { confirm: 'Supprimer', danger: true })) return;
      try { await api(`/admin/services/${s.id}`, { method: 'DELETE' }); toast('Prestation supprimée.'); loaders.prestations(); } catch (e) { toast(e.message, 'error'); }
    });
  },

  async avocats() {
    const p = panel('avocats');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const lawyers = await getLawyers(true);
    p.innerHTML = `<div class="card-head"><p class="muted" style="margin:0;max-width:60ch">Ajoutez un avocat avec son nom, ses coordonnées et sa photo. Il apparaît aussitôt sur le site et peut recevoir des dossiers.</p><button class="btn" id="add-lawyer">${ICONS.plus}Ajouter un avocat</button></div>
      ${lawyers.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Avocat</th><th>Coordonnées</th><th>Spécialités</th><th>Discord</th><th>Portefeuille</th><th>Dossiers</th><th>État</th><th></th></tr></thead><tbody>
      ${lawyers.map(l => `<tr>
        <td data-label="Avocat"><span class="lawyer-row">${face(l.photo, l.display_name)}<span><b>${esc(l.display_name)}</b><br><span class="muted" style="font-size:.82rem">${esc(l.title)} · ${esc(roleName(l.role))}</span></span></span></td>
        <td data-label="Coordonnées" style="font-size:.88rem">${l.phone ? esc(l.phone) : '<span class="muted">—</span>'}${l.email ? `<br><span class="muted">${esc(l.email)}</span>` : ''}</td>
        <td data-label="Spécialités" style="font-size:.88rem">${l.specialties.map(domainName).map(esc).join(', ') || '—'}</td>
        <td data-label="Discord">${l.discord_linked ? '<span class="pill s-cloture">Lié</span>' : '<span class="pill neutral">Non lié</span>'}</td>
        <td data-label="Portefeuille" class="nowrap">${l.portfolio} client${l.portfolio > 1 ? 's' : ''}</td>
        <td data-label="Dossiers" class="nowrap">${l.active_cases} en cours<br><span class="muted">${l.closed_cases} clôturé${l.closed_cases > 1 ? 's' : ''}</span></td>
        <td data-label="État">${l.active ? '<span class="pill s-cloture">Actif</span>' : '<span class="pill neutral">Désactivé</span>'}</td>
        <td><button class="btn btn-ghost btn-sm" data-edit="${l.user_id}">Modifier</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><h3>Aucun avocat</h3><p>Ajoutez le premier avocat du cabinet.</p></div>'}`;
    $('#add-lawyer').onclick = addLawyer;
    $$('[data-edit]', p).forEach(b => b.onclick = () => editLawyer(lawyers.find(l => l.user_id === +b.dataset.edit)));
  },

  async clients() {
    const p = panel('clients');
    if (!p.dataset.ready) {
      p.dataset.ready = '1';
      p.innerHTML = `<div class="toolbar"><input class="input search" type="search" id="client-q" placeholder="Rechercher : pseudo Discord, nom RP, identifiant" aria-label="Rechercher un citoyen"></div><div id="client-results"></div>`;
      let t; $('#client-q').oninput = () => { clearTimeout(t); t = setTimeout(loadClients, 250); };
    }
    loadClients();
  },

  async candidatures() {
    const p = panel('candidatures');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { applications } = await api('/admin/applications');
    setCount('candidatures', applications.filter(a => a.status === 'nouvelle').length);
    const labels = { nouvelle: 'Nouvelle', entretien: 'Entretien prévu', acceptee: 'Acceptée', refusee: 'Refusée' };
    p.innerHTML = applications.length ? applications.map(a => `<div class="card">
      <div class="card-head"><div><h3 style="margin:0">${esc(a.rp_name)} <span class="muted" style="font-family:var(--sans);font-size:.9rem">· ${esc(a.position)}</span></h3>
        <span class="muted" style="font-size:.85rem">${esc(a.contact)}${a.discord_id ? ` · Discord ${esc(a.discord_id)}` : ''} · ${fmtDateTime(a.created_at)}</span></div>
        <select class="input" style="width:auto" data-app="${a.id}" aria-label="Statut de la candidature">${Object.entries(labels).map(([k, l]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${a.experience ? `<p style="white-space:pre-wrap;color:var(--paper-dim)"><b style="color:var(--paper)">Expérience.</b> ${esc(a.experience)}</p>` : ''}
      <p style="white-space:pre-wrap;color:var(--paper-dim);margin:0"><b style="color:var(--paper)">Motivation.</b> ${esc(a.motivation)}</p></div>`).join('') : '<div class="empty"><h3>Aucune candidature</h3><p>Les candidatures envoyées depuis la page Recrutement apparaissent ici.</p></div>';
    $$('[data-app]', p).forEach(s => s.onchange = async () => { try { await api(`/admin/applications/${s.dataset.app}`, { method: 'PATCH', body: { status: s.value } }); toast('Candidature mise à jour.'); } catch (e) { toast(e.message, 'error'); } });
  },

  async messages() {
    const p = panel('messages');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { messages } = await api('/admin/messages');
    setCount('messages', messages.filter(m => !m.handled).length);
    p.innerHTML = messages.length ? messages.map(m => `<div class="card" style="${m.handled ? 'opacity:.6' : ''}">
      <div class="card-head"><div><h3 style="margin:0">${esc(m.subject)}</h3><span class="muted" style="font-size:.85rem">${esc(m.name)} · ${esc(m.contact)} · ${fmtDateTime(m.created_at)}</span></div>
        <label class="check"><input type="checkbox" data-msg="${m.id}" ${m.handled ? 'checked' : ''}> Traité</label></div>
      <p style="white-space:pre-wrap;color:var(--paper-dim);margin:0">${esc(m.message)}</p></div>`).join('') : '<div class="empty"><h3>Aucun message</h3></div>';
    $$('[data-msg]', p).forEach(c => c.onchange = async () => { await api(`/admin/messages/${c.dataset.msg}`, { method: 'PATCH', body: { handled: c.checked } }).catch(e => toast(e.message, 'error')); loaders.messages(); });
  },

  async photos() {
    const p = panel('photos');
    const { photos } = await api('/admin/site-photos');
    p.innerHTML = `<p class="muted" style="margin:0 0 20px">Remplacez les illustrations par vos captures en jeu. Les images sont réduites automatiquement avant l'envoi. Format paysage conseillé.</p>
      <div class="site-photos">${photos.map(ph => `<div class="site-photo-card" data-key="${ph.key}">
        <div class="prev"><img src="${esc(ph.url)}" alt=""></div>
        <div class="body"><h3>${esc(ph.label)}</h3><p class="muted" style="margin:0;font-size:.85rem">${esc(ph.where)}</p>
          <p style="margin:0;font-size:.8rem;color:${ph.custom ? 'var(--ok)' : 'var(--muted)'}">${ph.custom ? 'Votre photo' : 'Illustration par défaut'}</p>
          <div class="actions"><input type="file" accept="image/png,image/jpeg,image/webp" hidden>
            <button class="btn btn-sm" data-pick>${ph.custom ? 'Remplacer' : 'Mettre ma photo'}</button>
            ${ph.custom ? '<button class="btn btn-quiet btn-sm" data-reset>Remettre l’illustration</button>' : ''}</div></div></div>`).join('')}</div>`;
    $$('.site-photo-card', p).forEach(card => {
      const key = card.dataset.key, input = $('input', card);
      $('[data-pick]', card).onclick = () => input.click();
      input.onchange = () => withLoading($('[data-pick]', card), async () => {
        const f = input.files[0]; input.value = '';
        if (!f) return;
        try { const img = await resizeImage(f); await api(`/admin/site-photos/${key}`, { method: 'PUT', body: { image: { mime: img.mime, data: img.data } } }); toast('Photo mise en ligne sur le site.'); loaders.photos(); }
        catch (e) { toast(e.message, 'error'); }
      });
      const reset = $('[data-reset]', card);
      if (reset) reset.onclick = async () => {
        if (!await confirmModal('Remettre l’illustration', 'Votre photo sera supprimée et l’illustration d’origine reviendra sur le site.', { confirm: 'Remettre', danger: true })) return;
        try { await api(`/admin/site-photos/${key}`, { method: 'DELETE' }); toast('Illustration d’origine remise.'); loaders.photos(); } catch (e) { toast(e.message, 'error'); }
      };
    });
  },

  async contrats() {
    const p = panel('contrats');
    const { contracts } = await api('/admin/contracts');
    const pill = c => `<span class="pill s-${{ signature: 'attente', validation: 'attribue', valide: 'cloture', refuse: 'refuse' }[c.status] || 'recue'}">${esc(c.status_label || c.status)}</span>`;
    p.innerHTML = `<p class="muted" style="margin-top:0">Les entreprises abonnées (case « Accès au service de rédaction » dans leur fiche client) et l’équipe tapent <b>/contrat</b> sur Discord. Le bot envoie le PDF aux deux parties pour signature, puis un avocat le valide depuis le salon des nouvelles demandes.</p>
      ${contracts.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Référence</th><th>Contrat</th><th>Dossier</th><th>Entreprise</th><th>Salarié</th><th>Signatures</th><th>État</th><th></th></tr></thead><tbody>
      ${contracts.map(c => `<tr><td data-label="Référence"><b>${esc(c.ref)}</b><br><span class="muted" style="font-size:.82rem">${fmtDate(c.created_at)}</span></td><td data-label="Contrat">${esc(c.type)}</td><td data-label="Dossier">${c.case_number ? `<a href="/dossier.html?n=${encodeURIComponent(c.case_number)}">${esc(c.case_number)}</a>` : '<span class="muted">—</span>'}</td>
        <td data-label="Entreprise">${esc(c.company)}<br><span class="muted" style="font-size:.82rem">${esc(c.employer_name)}</span></td><td data-label="Salarié">${esc(c.employee_name)}<br><span class="muted" style="font-size:.82rem">${esc(c.position)}</span></td>
        <td data-label="Signatures">${['employer', 'employee', 'cabinet'].map(k => `${c.signatures[k] ? '✔' : '○'} ${{ employer: 'Entreprise', employee: 'Salarié', cabinet: 'Cabinet' }[k]}`).join('<br>')}</td>
        <td data-label="État">${pill(c)}${c.refused_by ? `<br><span class="muted" style="font-size:.82rem">par ${esc(c.refused_by)}</span>` : ''}</td>
        <td><a class="btn btn-ghost btn-sm" href="/api/admin/contracts/${c.id}/pdf" target="_blank" rel="noopener">PDF</a></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><h3>Aucun contrat</h3><p>Les contrats rédigés avec /contrat sur Discord apparaîtront ici.</p></div>'}`;
  },

  async actualites() {
    const p = panel('actualites');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { news } = await api('/admin/news');
    p.innerHTML = `<div class="card-head"><h2 style="margin:0;font-size:1.6rem">Actualités</h2><button class="btn" id="add-news">Publier un article</button></div>
      ${news.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Titre</th><th>Catégorie</th><th>Date</th><th>État</th><th></th></tr></thead><tbody>
      ${news.map(n => `<tr><td data-label="Titre"><a href="/actualites.html?a=${encodeURIComponent(n.slug)}" target="_blank">${esc(n.title)}</a></td><td data-label="Catégorie">${esc(n.category)}</td><td data-label="Date">${fmtDate(n.created_at)}</td>
        <td data-label="État">${n.published ? '<span class="pill s-cloture">Publié</span>' : '<span class="pill neutral">Brouillon</span>'}</td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-edit-news="${n.id}">Modifier</button> <button class="btn btn-quiet btn-sm" data-del-news="${n.id}">Supprimer</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>Aucun article</h3></div>'}`;
    $('#add-news').onclick = () => newsModal();
    $$('[data-edit-news]', p).forEach(b => b.onclick = () => newsModal(news.find(n => n.id === +b.dataset.editNews)));
    $$('[data-del-news]', p).forEach(b => b.onclick = async () => {
      if (!await confirmModal('Supprimer cet article ?', 'Cette action est définitive.', { confirm: 'Supprimer', danger: true })) return;
      try { await api(`/admin/news/${b.dataset.delNews}`, { method: 'DELETE' }); toast('Article supprimé.'); loaders.actualites(); } catch (e) { toast(e.message, 'error'); }
    });
  },

  async parametres() {
    const p = panel('parametres');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { settings, status } = await api('/admin/settings');
    const ok = b => b ? '<span class="pill s-cloture">Configuré</span>' : '<span class="pill s-refuse">Manquant</span>';
    p.innerHTML = `<div class="grid-main">
      <form class="card form" id="settings-form" novalidate>
        <h2 style="margin:0">Salons et rôles Discord</h2>
        <p class="muted" style="margin:0">Collez les identifiants (mode développeur de Discord, clic droit puis « Copier l'identifiant »). Plusieurs rôles possibles, séparés par des virgules. Laissez vide pour reprendre la valeur de l'environnement.</p>
        <h3 style="margin:12px 0 0;font-size:1.2rem">Salons de notification</h3>
        ${settings.filter(s => s.key.startsWith('channel_')).map(field).join('')}
        <h3 style="margin:12px 0 0;font-size:1.2rem">Rôles et accès</h3>
        ${settings.filter(s => s.key.startsWith('role_')).map(field).join('')}
        <div><button class="btn" type="submit">Enregistrer les paramètres</button></div>
      </form>
      <aside class="card"><h3>État de la connexion Discord</h3>
        <dl class="recap" style="border:0">
          <div><dt>Connexion OAuth2</dt><dd>${ok(status.oauth)}</dd></div>
          <div><dt>Bot (notifications)</dt><dd>${ok(status.bot)}</dd></div>
          <div><dt>Commandes slash</dt><dd>${ok(status.interactions)}</dd></div>
          <div><dt>Serveur Discord</dt><dd>${ok(status.guild)}</dd></div>
        </dl>
        <p class="muted" style="font-size:.88rem">Les secrets (token du bot, secret OAuth2) se règlent uniquement dans les variables d'environnement Netlify, jamais ici.</p>
        <p class="muted" style="font-size:.88rem">Correspondance des rôles : Citoyen (aucun rôle), ${ROLES.slice(1).map(esc).join(', ')}. Les rôles Discord sont relus à chaque connexion.</p>
        <div style="border-top:1px solid var(--line);margin-top:18px;padding-top:18px;display:grid;gap:10px">
          <h3 style="margin:0">Outils</h3>
          <button class="btn btn-ghost btn-sm" id="install-cmds">Installer les commandes Discord</button>
          <button class="btn btn-ghost btn-sm" id="test-channels">Tester les salons</button>
          <button class="btn btn-ghost btn-sm" id="post-welcome">Publier le message d'accueil</button>
          <p class="hint" style="margin:0">Publie dans le salon d'accueil un message avec des boutons vers la prise de rendez-vous, les demandes et l'espace client. Pensez à l'épingler.</p>
          <div id="tools-out" class="muted" style="font-size:.88rem"></div></div></aside></div>`;
    $('#install-cmds').onclick = e => withLoading(e.currentTarget, async () => {
      try { const r = await api('/admin/discord/commands', { method: 'POST' }); $('#tools-out').innerHTML = `<p style="color:var(--ok)">Commandes installées : ${esc(r.commands.join(', '))}.</p>`; toast('Commandes Discord installées.'); }
      catch (err) { $('#tools-out').innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
    });
    $('#post-welcome').onclick = e => withLoading(e.currentTarget, async () => {
      try { await api('/admin/discord/welcome', { method: 'POST' }); $('#tools-out').innerHTML = '<p style="color:var(--ok)">Message d’accueil publié. Épinglez-le dans le salon (clic droit → Épingler).</p>'; toast('Message d’accueil publié.'); }
      catch (err) { $('#tools-out').innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
    });
    $('#test-channels').onclick = e => withLoading(e.currentTarget, async () => {
      try { const { results } = await api('/admin/discord/test', { method: 'POST' });
        $('#tools-out').innerHTML = `<ul class="list-plain">${results.map(r => `<li><span>${esc(r.label)}</span><span class="pill ${r.ok ? 's-cloture' : 's-refuse'}">${r.ok ? 'Reçu' : esc(r.error)}</span></li>`).join('')}</ul>`;
      } catch (err) { $('#tools-out').innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
    });
    $('#settings-form').onsubmit = async e => {
      e.preventDefault();
      await withLoading($('button[type=submit]', e.target), async () => {
        try { await api('/admin/settings', { method: 'PUT', body: { settings: Object.fromEntries(new FormData(e.target)) } }); toast('Paramètres enregistrés.'); }
        catch (err) { toast(err.message, 'error'); }
      });
    };
  }
};

const field = s => `<div class="field"><label for="set-${s.key}">${esc(s.label)}</label><input class="input" id="set-${s.key}" name="${s.key}" value="${esc(s.value)}" inputmode="numeric" placeholder="Identifiant Discord"><p class="hint">Variable d'environnement : ${esc(s.env)}</p></div>`;

let serviceCache = [];
let svcFilter = '';

async function serviceModal(svc, domain = '') {
  const dom = svc?.domain || domain || 'penal';
  const groupsOf = d => [...new Set(serviceCache.filter(s => s.domain === d).map(s => s.group_name))];
  const unitLabel = u => u ? u.replace('/ ', 'par ') : 'forfait (prix unique)';
  const r = await modal({ title: svc ? 'Modifier la prestation' : 'Ajouter une prestation', confirm: svc ? 'Enregistrer' : 'Ajouter la prestation',
    body: `<div class="form" style="gap:16px">
      <div class="form-row">
        <div class="field"><label for="sv-dom">Module</label><select class="input" id="sv-dom" name="domain">${DOMAINS.map(d => `<option value="${d.slug}" ${d.slug === dom ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="sv-grp">Rubrique</label><input class="input" id="sv-grp" name="group_name" list="sv-groups" maxlength="80" value="${esc(svc?.group_name || groupsOf(dom)[0] || '')}" placeholder="Ex. : Représentation et défense">
          <datalist id="sv-groups">${groupsOf(dom).map(g => `<option value="${esc(g)}">`).join('')}</datalist><p class="hint">Choisissez une rubrique existante ou tapez-en une nouvelle.</p></div>
      </div>
      <div class="field"><label for="sv-name">Intitulé</label><input class="input" id="sv-name" name="name" required minlength="3" maxlength="140" value="${esc(svc?.name || '')}" placeholder="Ex. : Défense pour délit majeur"></div>
      <div class="field"><label for="sv-desc">Description (facultatif)</label><input class="input" id="sv-desc" name="description" maxlength="400" value="${esc(svc?.description || '')}"></div>
      <div class="form-row">
        <div class="field"><label for="sv-price">Prix ($)</label><input class="input" id="sv-price" name="price" inputmode="numeric" value="${svc?.price ?? ''}" placeholder="Ex. : 24900"><p class="hint">Vide = sur devis · 0 = offert</p></div>
        <div class="field"><label for="sv-unit">Facturation</label><select class="input" id="sv-unit" name="price_unit">${PRICE_UNITS.map(u => `<option value="${esc(u)}" ${(svc?.price_unit ?? '/ mois') === u ? 'selected' : ''}>${esc(unitLabel(u))}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label for="sv-sort">Ordre d'affichage (facultatif)</label><input class="input" id="sv-sort" name="sort_order" type="number" value="${svc?.sort_order ?? ''}"></div>
        <div class="field"><span class="label">Aperçu</span><p id="sv-preview" style="margin:8px 0 0"></p></div>
      </div>
      <label class="check"><input type="checkbox" name="active" ${svc?.active === false ? '' : 'checked'}> Visible sur le site et à la prise de rendez-vous</label></div>`,
    onOpen: d => {
      const upd = () => { const v = $('#sv-price', d).value.trim(); $('#sv-preview', d).innerHTML = `<span class="price-tag${v === '0' ? ' free' : ''}">${esc(fmtPrice(v === '' ? null : Number(v.replace(/[\s$]/g, '')) || 0, $('#sv-unit', d).value))}</span>`; };
      $('#sv-price', d).oninput = upd; $('#sv-unit', d).onchange = upd; upd();
      $('#sv-dom', d).onchange = e => { $('#sv-groups', d).innerHTML = groupsOf(e.target.value).map(g => `<option value="${esc(g)}">`).join(''); };
    },
    onSubmit: (data, form) => {
      const body = { ...data, active: form.querySelector('[name=active]').checked, price: data.price.trim() === '' ? null : data.price, sort_order: data.sort_order === '' ? undefined : +data.sort_order };
      return api(svc ? `/admin/services/${svc.id}` : '/admin/services', { method: svc ? 'PATCH' : 'POST', body });
    } });
  if (r) { toast(svc ? 'Prestation enregistrée.' : 'Prestation ajoutée au catalogue.'); loaders.prestations(); }
}

const filters = { q: '', domain: '', status: '', lawyer: '', archived: '' };
async function loadCases() {
  const box = $('#case-results');
  box.innerHTML = '<span class="loader">Recherche</span>';
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  try {
    const { cases } = await api(`/admin/cases?${qs}`);
    const lawyers = await getLawyers();
    box.innerHTML = cases.length ? `<p class="muted" style="font-size:.88rem">${cases.length} dossier${cases.length > 1 ? 's' : ''}</p><div class="table-wrap"><table class="data stack"><thead><tr><th>Dossier</th><th>Client</th><th>Objet</th><th>Domaine</th><th>Statut</th><th>Avocat</th><th>Mise à jour</th></tr></thead><tbody>
      ${cases.map(c => `<tr class="clickable" data-href="/dossier.html?n=${encodeURIComponent(c.number)}">
        <td data-label="Dossier"><a class="num" href="/dossier.html?n=${encodeURIComponent(c.number)}">${esc(c.number)}</a></td>
        <td data-label="Client">${esc(c.client_name)}</td><td data-label="Objet">${esc(c.title)}</td><td data-label="Domaine">${esc(domainName(c.domain))}</td>
        <td data-label="Statut">${statusPill(c.status)}</td>
        <td data-label="Avocat"><select class="input" style="padding:7px 34px 7px 10px;font-size:.88rem;min-width:150px" data-assign="${esc(c.number)}" aria-label="Attribuer ${esc(c.number)}" ${['cloture', 'refuse'].includes(c.status) ? 'disabled' : ''}>
          <option value="">Non attribué</option>${lawyers.filter(l => l.active || l.user_id === c.lawyer_id).map(l => `<option value="${l.user_id}" ${l.user_id === c.lawyer_id ? 'selected' : ''} ${c.client_referent_id && l.user_id !== c.client_referent_id ? 'disabled' : ''}>${esc(l.display_name)}${l.user_id === c.client_referent_id ? ' (référent)' : ''}</option>`).join('')}</select>
          ${c.lawyer_id && c.lawyer_accepted === null ? '<div class="muted" style="font-size:.75rem;margin-top:4px">En attente de réponse</div>' : ''}</td>
        <td data-label="Mise à jour">${fmtDate(c.updated_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>Aucun dossier ne correspond</h3><p>Modifiez la recherche ou les filtres.</p></div>';
    $$('[data-assign]', box).forEach(s => s.onchange = async () => {
      if (!s.value) { toast("Pour retirer un avocat, attribuez le dossier à un autre avocat.", 'error'); return loadCases(); }
      try { const r = await api(`/cases/${encodeURIComponent(s.dataset.assign)}/assign`, { method: 'POST', body: { lawyer_id: +s.value } }); toast(`${s.dataset.assign} attribué à ${r.case.lawyer_name}.`); loadCases(); }
      catch (e) { toast(e.message, 'error'); loadCases(); }
    });
  } catch (e) { box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
}

async function loadClients() {
  const box = $('#client-results');
  box.innerHTML = '<span class="loader">Recherche</span>';
  const q = $('#client-q').value.trim();
  const { clients } = await api(`/admin/clients${q ? '?q=' + encodeURIComponent(q) : ''}`);
  box.innerHTML = clients.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Citoyen</th><th>Identifiant Discord</th><th>Avocat référent</th><th>Dossiers</th><th>Dernière connexion</th><th></th></tr></thead><tbody>
    ${clients.map(c => `<tr><td data-label="Citoyen"><b>${esc(c.rp_name || c.global_name || c.username)}</b><br><span class="muted" style="font-size:.82rem">@${esc(c.username)}</span>${c.disabled ? ' <span class="pill s-refuse">Désactivé</span>' : ''}</td>
      <td data-label="Discord" class="muted">${esc(c.discord_id)}</td><td data-label="Référent">${c.referent_name ? esc(c.referent_name) : '<span class="muted">—</span>'}</td>
      <td data-label="Dossiers">${c.cases_count} (${c.open_cases} en cours)</td><td data-label="Connexion">${fmtDateTime(c.last_login)}</td>
      <td><button class="btn btn-ghost btn-sm" data-client="${c.id}">Fiche</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>Aucun compte trouvé</h3></div>';
  $$('[data-client]', box).forEach(b => b.onclick = () => clientModal(+b.dataset.client));
}

async function clientModal(id) {
  const [{ client: c, cases, appointments }, lawyers] = await Promise.all([api(`/admin/clients/${id}`), getLawyers(true)]);
  const canManage = me.role >= 3 || c.site_role < 2;
  const openCases = cases.filter(k => !['cloture', 'refuse'].includes(k.status)).length;
  const r = await modal({ title: c.rp_name || c.global_name || c.username, confirm: 'Enregistrer', cancel: 'Fermer', wide: true,
    body: `<p class="muted" style="margin-top:0">@${esc(c.username)} · Discord ${esc(c.discord_id)}${c.phone ? ` · Tél. ${esc(c.phone)}` : ''}<br>Inscrit le ${fmtDate(c.created_at)}</p>
      <div class="form" style="gap:12px;padding:16px;border:1px solid var(--bronze-lo);margin-bottom:22px">
        <div class="field"><label for="cl-ref">Avocat référent (portefeuille)</label>
          <select class="input" id="cl-ref" name="referent"><option value="">Aucun</option>${lawyers.filter(l => l.active || l.user_id === c.referent_lawyer_id).map(l => `<option value="${l.user_id}" ${l.user_id === c.referent_lawyer_id ? 'selected' : ''}>${esc(l.display_name)}${l.active ? '' : ' (inactif)'}</option>`).join('')}</select>
          <p class="hint">Le client ne prend rendez-vous qu'avec cet avocat, et ses nouveaux dossiers lui sont confiés automatiquement.</p></div>
        ${openCases ? `<label class="check"><input type="checkbox" name="transfer" checked> Transférer aussi ses ${openCases} dossier${openCases > 1 ? 's' : ''} en cours au nouvel avocat</label>` : ''}
      </div>
      <h4 style="font-family:var(--sans);font-size:.9rem;color:var(--bronze)">Dossiers (${cases.length})</h4>
      ${cases.length ? `<ul class="list-plain">${cases.map(k => `<li><a href="/dossier.html?n=${k.number}">${esc(k.number)}</a><span style="flex:1;margin:0 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.title)}</span>${statusPill(k.status)}</li>`).join('')}</ul>` : '<p class="muted">Aucun dossier.</p>'}
      <h4 style="font-family:var(--sans);font-size:.9rem;color:var(--bronze);margin-top:20px">Rendez-vous (${appointments.length})</h4>
      ${appointments.length ? `<ul class="list-plain">${appointments.slice(0, 8).map(a => `<li><span>${esc(fmtDay(a.date))} à ${esc(a.time)} · ${esc(a.lawyer_name)}</span><span class="pill s-${a.status}">${{ confirme: 'Confirmé', annule: 'Annulé', termine: 'Terminé' }[a.status]}</span></li>`).join('')}</ul>` : '<p class="muted">Aucun rendez-vous.</p>'}
      ${canManage && c.id !== me.id ? `<div style="border-top:1px solid var(--line);margin-top:20px;padding-top:18px" class="form">
        <div class="field"><label for="cl-role">Rôle attribué par le site</label><select class="input" id="cl-role" name="site_role">${ROLES.map((l, i) => `<option value="${i}" ${c.site_role === i ? 'selected' : ''} ${i >= 2 && me.role < 3 ? 'disabled' : ''}>${esc(l)}</option>`).join('')}</select>
          <p class="hint">Le rôle effectif est le plus élevé entre celui-ci et le rôle Discord (actuellement ${esc(roleName(c.discord_role))}).</p></div>
        <label class="check"><input type="checkbox" name="disabled" ${c.disabled ? 'checked' : ''}> Compte désactivé (connexion bloquée)</label></div>` : ''}
      <label class="check" style="margin-top:16px"><input type="checkbox" name="documents_access" ${c.documents_access ? 'checked' : ''}> Accès au service de rédaction : peut générer des contrats avec /contrat sur Discord</label>`,
    onSubmit: async (d, form) => {
      const newRef = d.referent ? +d.referent : null;
      if (newRef !== (c.referent_lawyer_id ?? null)) {
        const res = await api(`/admin/clients/${c.id}/referent`, { method: 'PUT', body: { lawyer_id: newRef, transfer: !!form.querySelector('[name=transfer]')?.checked } });
        if (res.moved.length) toast(`${res.moved.length} dossier(s) transféré(s) : ${res.moved.join(', ')}.`);
      }
      if (canManage && c.id !== me.id) {
        await api(`/admin/users/${c.id}`, { method: 'PATCH', body: { site_role: +d.site_role, disabled: !!form.querySelector('[name=disabled]').checked } });
      }
      const access = !!form.querySelector('[name=documents_access]').checked;
      if (access !== !!c.documents_access) await api(`/admin/users/${c.id}`, { method: 'PATCH', body: { documents_access: access } });
      return 'saved';
    } });
  if (r === 'saved') { toast('Fiche client enregistrée.'); lawyersCache = null; loadClients(); }
}

const roleOptions = (cur, name = 'role', withNone = false) => `<div class="field"><label for="lf-role">Rôle sur le site</label><select class="input" id="lf-role" name="${name}">
  ${withNone ? `<option value="0" ${cur === 0 ? 'selected' : ''}>Aucun (rôle Discord seul)</option>` : ''}
  ${ROLES.slice(1).map((l, i) => `<option value="${i + 1}" ${cur === i + 1 ? 'selected' : ''} ${i + 1 >= 2 && me.role < 3 ? 'disabled' : ''}>${esc(l)}</option>`).join('')}</select></div>`;

async function addLawyer() {
  let photo;
  const r = await modal({ title: 'Ajouter un avocat', confirm: "Ajouter l'avocat", wide: true,
    body: lawyerFields({}, { discord: true, roleSelect: roleOptions(1) }),
    onOpen: d => { photo = bindPhoto(d); },
    onSubmit: (_, form) => api('/admin/lawyers', { method: 'POST', body: readLawyerForm(form, photo) }) });
  if (r) { toast('Avocat ajouté.'); lawyersCache = null; loaders.avocats(); }
}

async function editLawyer(l) {
  let photo;
  const self = l.user_id === me.id;
  const r = await modal({ title: `Modifier ${l.display_name}`, confirm: 'Enregistrer', wide: true,
    body: lawyerFields(l, { discord: true, adminFields: true, roleSelect: self ? '<div></div>' : roleOptions(l.site_role, 'site_role', true) })
      + `<p class="hint" style="margin-top:14px">Rôle Discord actuel : ${esc(roleName(l.discord_role))}. Le rôle effectif est le plus élevé des deux.</p>`,
    onOpen: d => { photo = bindPhoto(d); },
    onSubmit: (_, form) => api(`/admin/lawyers/${l.user_id}`, { method: 'PATCH', body: readLawyerForm(form, photo) }) });
  if (r) { toast('Fiche avocat enregistrée.'); lawyersCache = null; loaders.avocats(); }
}

async function newsModal(n) {
  let image; // undefined = inchangée, null = retirée, objet = nouvelle
  const r = await modal({ title: n ? "Modifier l'article" : 'Publier un article', confirm: n ? 'Enregistrer' : 'Publier',
    body: `<div class="form" style="gap:16px">
      <div class="field"><label for="nw-t">Titre</label><input class="input" id="nw-t" name="title" required maxlength="160" value="${esc(n?.title || '')}"></div>
      <div class="field"><label for="nw-c">Catégorie</label><input class="input" id="nw-c" name="category" required maxlength="60" value="${esc(n?.category || 'Actualité')}"></div>
      <div class="field"><label for="nw-e">Résumé</label><input class="input" id="nw-e" name="excerpt" required maxlength="300" value="${esc(n?.excerpt || '')}"></div>
      <div class="field"><label for="nw-b">Contenu</label><textarea class="input" id="nw-b" name="body" required maxlength="20000">${esc(n?.body || '')}</textarea><p class="hint">Séparez les paragraphes par une ligne vide.</p></div>
      <div class="field"><span class="label">Image (facultative)</span><div class="img-pick">
        <div class="prev" id="nw-prev">${n?.image ? `<img src="${esc(n.image)}" alt="">` : 'Aucune image'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="file" id="nw-file" accept="image/png,image/jpeg,image/webp" hidden>
          <button type="button" class="btn btn-ghost btn-sm" id="nw-choose">${n?.image ? 'Changer l’image' : 'Ajouter une image'}</button>
          <button type="button" class="btn btn-quiet btn-sm" id="nw-remove" ${n?.image ? '' : 'hidden'}>Retirer</button></div></div></div>
      <label class="check"><input type="checkbox" name="published" ${n?.published === false ? '' : 'checked'}> Publié</label></div>`,
    onOpen: d => {
      const input = $('#nw-file', d), prev = $('#nw-prev', d), rm = $('#nw-remove', d);
      $('#nw-choose', d).onclick = () => input.click();
      input.onchange = async () => {
        const f = input.files[0]; input.value = '';
        if (!f) return;
        try { const img = await resizeImage(f, 1600); image = { mime: img.mime, data: img.data }; prev.innerHTML = `<img src="${img.preview}" alt="">`; rm.hidden = false; }
        catch (e) { toast(e.message, 'error'); }
      };
      rm.onclick = () => { image = null; prev.textContent = 'Aucune image'; rm.hidden = true; };
    },
    onSubmit: (d, form) => api(n ? `/admin/news/${n.id}` : '/admin/news', { method: n ? 'PATCH' : 'POST', body: { ...d, published: form.querySelector('[name=published]').checked, ...(image !== undefined ? { image } : {}) } }) });
  if (r) { toast(n ? 'Article enregistré.' : 'Article publié.'); loaders.actualites(); }
}

if (me) render();
