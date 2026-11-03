// Espace client (citoyen)
import { api, $, $$, esc, toast, tabs, requireRole, avatar, roleName, statusPill, domainName, fmtDate, fmtDay, withLoading, confirmModal, dropzone, uploadFiles, dashShell, discordBadge, kpiCard, firstName, fmtShort, ICONS , loadServices, groupServices } from './app.mjs';
import { DOMAINS, DOMAIN_BY_SLUG, OTHER_SERVICE, fmtPrice } from './domains.mjs';

const app = $('#app');
let preDomain = null;
const me = await requireRole(0, app);
if (me) render();

function render() {
  const params = new URLSearchParams(location.search);
  app.innerHTML = dashShell({
    label: 'Espace client',
    title: `Bonjour ${esc(firstName(me))},`,
    sub: 'Voici un aperçu de votre espace client.',
    actions: `${discordBadge()}<button class="btn" data-goto="nouvelle">Nouvelle demande${ICONS.plus}</button>`,
    nav: [
      { key: 'tableau', icon: 'home', label: 'Mon espace' },
      { key: 'dossiers', icon: 'folder', label: 'Mes dossiers' },
      { key: 'nouvelle', icon: 'plusCircle', label: 'Nouvelle demande' },
      { key: 'rendez-vous', icon: 'calendar', label: 'Mes rendez-vous' },
      { key: 'profil', icon: 'user', label: 'Mon profil' },
      { sep: true },
      { href: '/contact.html', icon: 'mail', label: 'Nous contacter' },
      ...(me.role >= 1 ? [{ href: '/espace-avocat.html', icon: 'scales', label: 'Espace avocat' }] : []),
      ...(me.role >= 2 ? [{ href: '/administration.html', icon: 'settings', label: 'Administration' }] : [])
    ]
  });
  preDomain = params.get('nouvelle');
  if (preDomain) history.replaceState(null, '', location.pathname + '#nouvelle');
  const show = tabs(app, name => loaders[name]?.());
  $$('[data-goto]').forEach(b => b.onclick = () => show(b.dataset.goto));
  app.addEventListener('click', e => { const g = e.target.closest('[data-goto-tab]'); if (g) { e.preventDefault(); show(g.dataset.gotoTab); } });
}

const panel = n => $(`[data-panel="${n}"]`);
const caseRow = c => `<tr class="clickable" data-href="/dossier.html?n=${encodeURIComponent(c.number)}">
  <td data-label="Dossier"><a class="num" href="/dossier.html?n=${encodeURIComponent(c.number)}">${esc(c.number)}</a></td>
  <td data-label="Objet">${esc(c.title)}</td>
  <td data-label="Domaine">${esc(domainName(c.domain))}</td>
  <td data-label="Avocat">${esc(c.lawyer_name || '—')}</td>
  <td data-label="Statut">${statusPill(c.status)}</td>
  <td data-label="Mise à jour">${fmtDate(c.updated_at)}</td></tr>`;
const compactTable = list => `<div class="table-wrap"><table class="data stack"><thead><tr><th>N° dossier</th><th>Domaine</th><th>Statut</th><th>Mise à jour</th></tr></thead><tbody>${list.map(c => `<tr class="clickable" data-href="/dossier.html?n=${encodeURIComponent(c.number)}">
  <td data-label="Dossier"><a class="num" href="/dossier.html?n=${encodeURIComponent(c.number)}">${esc(c.number)}</a></td><td data-label="Domaine">${esc(domainName(c.domain))}</td>
  <td data-label="Statut">${statusPill(c.status)}</td><td data-label="Mise à jour" class="nowrap">${fmtShort(c.updated_at)}</td></tr>`).join('')}</tbody></table></div>`;
const caseTable = list => `<div class="table-wrap"><table class="data stack"><thead><tr><th>Dossier</th><th>Objet</th><th>Domaine</th><th>Avocat</th><th>Statut</th><th>Mise à jour</th></tr></thead><tbody>${list.map(caseRow).join('')}</tbody></table></div>`;
document.addEventListener('click', e => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) location.href = tr.dataset.href; });

const loaders = {
  async tableau() {
    const p = panel('tableau');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const [{ cases }, { appointments }] = await Promise.all([api('/cases'), api('/appointments')]);
    const open = cases.filter(c => !['cloture', 'refuse'].includes(c.status));
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = appointments.filter(a => a.status === 'confirme' && a.date >= today).reverse();
    const waitingDocs = cases.filter(c => c.status === 'attente_docs');
    p.innerHTML = `
      <div class="kpi-cards">
        ${kpiCard('folder', open.length, open.length > 1 ? 'Dossiers en cours' : 'Dossier en cours', true)}
        ${kpiCard('calendar', upcoming.length, upcoming.length > 1 ? 'Rendez-vous à venir' : 'Rendez-vous à venir')}
        ${kpiCard('check', cases.length - open.length, cases.length - open.length > 1 ? 'Dossiers clôturés' : 'Dossier clôturé')}
      </div>
      ${waitingDocs.length ? `<div class="card" style="border-color:#5b4a2e;margin-bottom:24px"><b>Documents demandés.</b> Votre avocat attend des pièces pour ${waitingDocs.map(c => `<a href="/dossier.html?n=${c.number}">${esc(c.number)}</a>`).join(', ')}. Ajoutez-les depuis la page du dossier.</div>` : ''}
      <div class="grid-main">
        <div class="card"><div class="card-head"><h2>Mes derniers dossiers</h2></div>
          ${cases.length ? compactTable(cases.slice(0, 5)) + `<a class="link-more" href="#dossiers" data-goto-tab="dossiers">Voir tous mes dossiers${ICONS.arrow}</a>` : `<div class="empty"><h3>Aucun dossier pour le moment</h3><p>Exposez votre situation : un numéro de dossier vous sera attribué.</p><button class="btn" data-goto-tab="nouvelle">Déposer une demande</button></div>`}
        </div>
        <div>
        ${me.referent ? `<div class="card"><div class="card-head" style="margin-bottom:10px"><h2>Mon avocat</h2></div>
          <p class="ref-badge" style="margin:0 0 6px">${ICONS.scales}${esc(me.referent.name)}</p>
          <p class="muted" style="margin:0;font-size:.9rem">${me.referent.active ? 'Votre avocat référent suit tous vos dossiers et vos rendez-vous.' : "Votre avocat n'exerce plus au cabinet : un nouvel avocat va vous être attribué."}</p></div>` : ''}
        <div class="card"><div class="card-head"><h2>Prochains rendez-vous</h2></div>
          ${upcoming.length ? `<ul class="upnext">${upcoming.slice(0, 4).map(a => `<li><span class="face">${ICONS.calendar}</span><div><span class="when">${esc(fmtDay(a.date))} · ${esc(a.time)}</span><b style="display:block">${esc(a.lawyer_name)}</b><small>${esc(a.reason)}</small></div></li>`).join('')}</ul>` : '<p class="muted">Aucun rendez-vous prévu.</p>'}
          <a class="link-more" href="/rendez-vous.html">Prendre rendez-vous${ICONS.arrow}</a>
        </div></div>
      </div>`;
  },

  async dossiers() {
    const p = panel('dossiers');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { cases } = await api('/cases');
    const open = cases.filter(c => !['cloture', 'refuse'].includes(c.status));
    const closed = cases.filter(c => ['cloture', 'refuse'].includes(c.status));
    p.innerHTML = !cases.length ? `<div class="empty"><h3>Vous n'avez encore déposé aucune demande</h3><button class="btn" data-goto-tab="nouvelle">Déposer une demande</button></div>` : `
      <h2 style="font-size:1.6rem">En cours</h2>${open.length ? caseTable(open) : '<p class="muted">Aucun dossier en cours.</p>'}
      <h2 style="font-size:1.6rem;margin-top:48px">Historique</h2>${closed.length ? caseTable(closed) : '<p class="muted">Aucun dossier clôturé.</p>'}`;
  },

  async nouvelle() {
    const catalog = await loadServices();
    const p = panel('nouvelle');
    if (p.dataset.ready) return;
    p.dataset.ready = '1';
    const pre = preDomain;
    p.innerHTML = `<div class="grid-main">
      <form class="card form" id="new-case" novalidate>
        <h2 style="margin:0">Déposer une demande juridique</h2>
        <div class="field"><span class="label">Domaine concerné</span>
          <div class="chips">${DOMAINS.map(d => `<label class="chip"><input type="radio" name="domain" value="${d.slug}" ${pre === d.slug ? 'checked' : ''} required><span>${esc(d.name)}</span></label>`).join('')}</div></div>
        <div class="field"><label for="n-service">Prestation</label><select class="input" id="n-service" name="service" disabled><option value="">Choisissez d'abord un domaine</option></select></div>
        <div class="field"><label for="n-title">Objet de la demande</label><input class="input" id="n-title" name="title" required minlength="5" maxlength="140" placeholder="Ex. : Contestation d'une amende pour excès de vitesse"></div>
        <div class="field"><label for="n-desc">Votre situation</label><textarea class="input" id="n-desc" name="description" required minlength="30" maxlength="6000" style="min-height:200px" placeholder="Les faits, les dates, les personnes impliquées, ce que vous attendez du cabinet."></textarea><p class="hint"><span id="n-count">0</span> / 6000 caractères · 30 minimum</p></div>
        <div class="field"><span class="label">Documents et preuves</span><div id="n-files"></div></div>
        <div><button class="btn" type="submit">Envoyer la demande</button></div>
      </form>
      <aside class="card"><h3>Ce qui se passe ensuite</h3>
        ${me.referent?.active ? `<p class="ref-badge">${ICONS.scales}Votre avocat référent : ${esc(me.referent.name)}</p>
        <ol class="muted" style="padding-left:18px;margin:0;line-height:1.7">
          <li>Votre dossier reçoit un numéro.</li>
          <li>Il est confié directement à votre avocat référent, qui connaît déjà votre situation.</li>
          <li>Vous suivez chaque étape ici et sur Discord.</li>
        </ol>` : `<ol class="muted" style="padding-left:18px;margin:0;line-height:1.7">
          <li>Votre dossier reçoit un numéro et le statut « Demande reçue ».</li>
          <li>Le cabinet l'attribue à un avocat du domaine, qui devient votre avocat référent.</li>
          <li>L'avocat accepte le dossier et vous propose un rendez-vous.</li>
          <li>Vous suivez chaque étape ici et sur Discord.</li>
        </ol>`}</aside></div>`;
    const svc = $('#n-service');
    const fillServices = slug => {
      const d = DOMAIN_BY_SLUG[slug];
      svc.disabled = !d;
      svc.innerHTML = d ? `<option value="">Choisir une prestation (facultatif)</option>${groupServices(catalog, d.slug).map(g => `<optgroup label="${esc(g.group)}">${g.items.map(x => `<option value="${esc(x.name)}">${esc(x.name)} — ${esc(fmtPrice(x.price, x.price_unit))}</option>`).join('')}</optgroup>`).join('')}<option>${OTHER_SERVICE}</option>` : '<option value="">Choisissez d\'abord un domaine</option>';
    };
    $$('input[name=domain]').forEach(r => r.onchange = () => fillServices(r.value));
    if (pre && DOMAIN_BY_SLUG[pre]) fillServices(pre);
    const dz = dropzone($('#n-files'));
    const form = $('#new-case'), desc = $('#n-desc');
    desc.oninput = () => $('#n-count').textContent = desc.value.length;
    form.onsubmit = async e => {
      e.preventDefault();
      $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
      const data = Object.fromEntries(new FormData(form));
      if (!data.domain) return toast('Choisissez le domaine concerné.', 'error');
      const bad = [$('#n-title'), desc].filter(el => !el.checkValidity());
      if (bad.length) { bad.forEach(el => el.setAttribute('aria-invalid', 'true')); bad[0].focus(); return toast(desc.value.length < 30 ? 'Décrivez votre situation en 30 caractères minimum.' : 'Complétez les champs obligatoires.', 'error'); }
      await withLoading($('button[type=submit]', form), async () => {
        try {
          const { case: c } = await api('/cases', { method: 'POST', body: data });
          if (dz.files.length) {
            try { await uploadFiles(c.number, dz.files); }
            catch (err) { toast(`Dossier créé, mais un document n'a pas pu être envoyé : ${err.message}`, 'error'); }
          }
          toast(`Demande enregistrée sous le numéro ${c.number}.`);
          location.href = `/dossier.html?n=${encodeURIComponent(c.number)}&nouveau=1`;
        } catch (err) { toast(err.message, 'error'); }
      });
    };
  },

  async 'rendez-vous'() {
    const p = panel('rendez-vous');
    p.innerHTML = '<span class="loader">Chargement</span>';
    const { appointments } = await api('/appointments');
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = appointments.filter(a => a.status === 'confirme' && a.date >= today).reverse();
    const past = appointments.filter(a => !(a.status === 'confirme' && a.date >= today));
    const row = (a, cancel) => `<div class="appt"><div class="t">${esc(a.time)}</div>
      <div class="w"><b>${esc(fmtDay(a.date))}</b> avec ${esc(a.lawyer_name)}${a.case_number ? ` · <a href="/dossier.html?n=${a.case_number}">${esc(a.case_number)}</a>` : ''}<small>${esc(domainName(a.domain))}${a.service ? ` · ${esc(a.service)}` : ''} — ${esc(a.reason)}</small></div>
      <div>${cancel ? `<button class="btn btn-quiet btn-sm" data-cancel="${a.id}">Annuler</button>` : `<span class="pill s-${a.status}">${{ confirme: 'Passé', annule: 'Annulé', termine: 'Terminé' }[a.status]}</span>`}</div></div>`;
    p.innerHTML = `<div class="card-head"><h2 style="margin:0;font-size:1.6rem">À venir</h2><a class="btn btn-sm" href="/rendez-vous.html">Nouveau rendez-vous</a></div>
      ${upcoming.length ? upcoming.map(a => row(a, true)).join('') : '<p class="muted">Aucun rendez-vous à venir.</p>'}
      <h2 style="font-size:1.6rem;margin-top:48px">Passés et annulés</h2>
      ${past.length ? past.map(a => row(a, false)).join('') : '<p class="muted">Aucun rendez-vous passé.</p>'}`;
    $$('[data-cancel]', p).forEach(b => b.onclick = async () => {
      if (!await confirmModal('Annuler ce rendez-vous ?', "Le créneau sera libéré et l'avocat prévenu.", { confirm: 'Annuler le rendez-vous', cancel: 'Garder', danger: true })) return;
      try { await api(`/appointments/${b.dataset.cancel}/cancel`, { method: 'POST' }); toast('Rendez-vous annulé.'); loaders['rendez-vous'](); }
      catch (e) { toast(e.message, 'error'); }
    });
  },

  profil() {
    const p = panel('profil');
    p.innerHTML = `<div class="grid-2">
      <div class="card"><h2>Compte Discord</h2>
        <div class="who" style="display:flex;gap:16px;align-items:center;margin:20px 0">${avatar(me).replace('<img', '<img style="width:64px;height:64px;border-radius:50%"')}<div><b>${esc(me.name)}</b><div class="muted">@${esc(me.username)}</div><div class="muted" style="font-size:.85rem">ID ${esc(me.discord_id)}</div></div></div>
        <p class="muted">Rôle sur le site : <b style="color:var(--paper)">${esc(roleName(me.role))}</b>. Il est déterminé par vos rôles sur le serveur Discord du cabinet à chaque connexion.</p>
        <p class="muted">Avocat référent : <b style="color:var(--paper)">${me.referent ? esc(me.referent.name) : 'pas encore attribué'}</b>.</p>
        <p class="muted">Membre depuis le ${fmtDate(me.created_at)}.</p></div>
      <form class="card form" id="profile-form" novalidate><h2 style="margin:0">Identité RP</h2>
        <p class="muted" style="margin:0">Ces informations sont transmises à votre avocat.</p>
        <div class="field"><label for="p-rp">Nom et prénom RP</label><input class="input" id="p-rp" name="rp_name" maxlength="80" value="${esc(me.rp_name || '')}"></div>
        <div class="field"><label for="p-phone">Téléphone en jeu</label><input class="input" id="p-phone" name="phone" maxlength="30" value="${esc(me.phone || '')}"></div>
        <div><button class="btn" type="submit">Enregistrer</button></div></form></div>`;
    $('#profile-form').onsubmit = async e => {
      e.preventDefault();
      await withLoading($('button', e.target), async () => {
        try { await api('/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); toast('Profil enregistré.'); }
        catch (err) { toast(err.message, 'error'); }
      });
    };
  }
};
