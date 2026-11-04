// Prise de rendez-vous en 4 étapes
import { api, getMe, $, $$, esc, toast, withLoading, domainName, fmtDay, ymd, loginUrl, initials , loadServices, groupServices } from './app.mjs';
import { DOMAINS, DOMAIN_BY_SLUG, WEEKDAYS, OTHER_SERVICE, fmtPrice } from './domains.mjs';
import { ICONS, DOMAIN_ICON } from './icons.mjs';

const root = $('#booking');
const params = new URLSearchParams(location.search);
const KEY = 'ac_booking';
let saved = {};
try { saved = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { /* ignore */ }
// Plusieurs pôles et plusieurs prestations : picks = [{ domain, name }]
const pre = params.get('domaine');
const state = {
  step: 1,
  domains: pre ? [pre] : saved.domains || (saved.domain ? [saved.domain] : []),
  picks: pre ? [] : saved.picks || (saved.domain && saved.service ? [{ domain: saved.domain, name: saved.service }] : []),
  lawyer: params.get('avocat') ? Number(params.get('avocat')) : saved.lawyer || null,
  date: saved.date || null, time: saved.time || null, reason: saved.reason || '', case_number: params.get('dossier') || saved.case_number || ''
};
const picked = (d, n) => state.picks.some(p => p.domain === d && p.name === n);
const priceOf = p => catalog.find(c => c.domain === p.domain && c.name === p.name);
// Chaque pôle choisi doit avoir au moins une prestation
const needComplete = () => state.domains.length > 0 && state.domains.every(d => state.picks.some(p => p.domain === d));
// Nombre de pôles choisis couverts par les spécialités de l'avocat
const coverage = l => state.domains.filter(d => l.specialties.includes(d)).length;
function totalLine() {
  const known = state.picks.map(priceOf).filter(x => x && x.price !== null && x.price !== undefined);
  const sum = known.reduce((n, x) => n + Number(x.price || 0), 0);
  const quote = state.picks.length - known.length;
  return `${state.picks.length} prestation${state.picks.length > 1 ? 's' : ''}${sum ? ` · ${fmtPrice(sum)}` : ''}${quote ? `${sum ? ' + ' : ' · '}${quote} sur devis` : ''}`;
}
let lawyers = [];
let me = null;
let catalog = [];
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };

function setStep(n) {
  state.step = n; save();
  $$('#steps li').forEach(li => { const s = +li.dataset.step; li.className = s === n ? 'active' : s < n ? 'done' : ''; });
  ({ 1: stepDomain, 2: stepLawyer, 3: stepSlot, 4: stepConfirm })[n]();
  root.querySelector('h2')?.focus?.();
}

const nav = (back, nextLabel, nextEnabled) => `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:32px;flex-wrap:wrap">
  ${back ? `<button class="btn btn-ghost" data-back>Retour</button>` : '<span></span>'}
  ${nextLabel ? `<button class="btn" data-next ${nextEnabled ? '' : 'disabled'}>${nextLabel}</button>` : ''}</div>`;

function bindNav(next) {
  $('[data-back]', root)?.addEventListener('click', () => setStep(state.step - 1));
  $('[data-next]', root)?.addEventListener('click', next || (() => setStep(state.step + 1)));
}

function stepDomain() {
  const sel = state.domains.map(d => DOMAIN_BY_SLUG[d]).filter(Boolean);
  root.innerHTML = `<h2 tabindex="-1" style="font-size:var(--step-3)">Quels sont vos besoins ?</h2>
    <p class="muted">Choisissez un ou plusieurs pôles, puis les prestations qui correspondent à votre situation. Vous pouvez en cocher plusieurs.</p>
    <div class="choice-grid domain-choices">${DOMAINS.map(x => `<button class="choice choice-icon" data-v="${x.slug}" aria-pressed="${state.domains.includes(x.slug)}">${ICONS[DOMAIN_ICON[x.slug]]}<strong>${esc(x.name)}</strong><small>${esc(x.tag)}</small></button>`).join('')}</div>
    ${sel.map(d => `<div class="service-pick" id="services-${d.slug}">
      <h3>${esc(d.name)} : quelles prestations ?</h3>
      ${[...groupServices(catalog, d.slug), { group: 'Autre', items: [{ name: OTHER_SERVICE, description: 'Votre situation ne figure pas dans la liste : l’avocat la qualifiera avec vous.', price: undefined }] }].map(g => `
      <h4 class="service-group">${esc(g.group)}</h4>
      <div class="service-options" role="group" aria-label="${esc(g.group)}">
        ${g.items.map(x => `
        <button class="service-option multi" role="checkbox" data-d="${d.slug}" data-s="${esc(x.name)}" aria-checked="${picked(d.slug, x.name)}"><span class="check-box" aria-hidden="true"></span>
          <span class="so-text"><strong>${esc(x.name)}</strong>${x.description ? `<small>${esc(x.description)}</small>` : ''}</span>
          ${x.price !== undefined ? `<span class="price-tag${x.price === 0 ? ' free' : ''}">${esc(fmtPrice(x.price, x.price_unit))}</span>` : ''}</button>`).join('')}
      </div>`).join('')}</div>`).join('')}
    ${state.picks.length ? `<div class="pick-summary" role="status"><b>Votre sélection :</b> ${state.domains.map(d => esc(domainName(d))).join(' + ')} · ${totalLine()}
      ${needComplete() ? '' : `<br><span class="muted">Choisissez au moins une prestation pour : ${state.domains.filter(d => !state.picks.some(p => p.domain === d)).map(d => esc(domainName(d))).join(', ')}.</span>`}</div>` : ''}
    ${nav(false, 'Choisir un avocat', needComplete())}`;
  $$('.domain-choices .choice', root).forEach(btn => btn.onclick = () => {
    const v = btn.dataset.v;
    if (state.domains.includes(v)) { state.domains = state.domains.filter(d => d !== v); state.picks = state.picks.filter(p => p.domain !== v); }
    else state.domains = [...state.domains, v];
    state.lawyer = me?.referent ? state.lawyer : null;
    save(); stepDomain();
    if (state.domains.includes(v)) $(`#services-${v}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $$('.service-option', root).forEach(btn => btn.onclick = () => {
    const d = btn.dataset.d, n = btn.dataset.s;
    if (picked(d, n)) state.picks = state.picks.filter(p => !(p.domain === d && p.name === n));
    else if (state.picks.length >= 8) return toast('8 prestations au maximum par rendez-vous.', 'error');
    else state.picks = [...state.picks, { domain: d, name: n }];
    save();
    const y = scrollY; stepDomain(); scrollTo(0, y);
  });
  bindNav();
}

function stepLawyer() {
  const ref = me?.referent;
  if (ref) {
    const l = lawyers.find(x => x.id === ref.id);
    root.innerHTML = `<h2 tabindex="-1" style="font-size:var(--step-3)">Votre avocat</h2>
      ${l && ref.active ? `<div class="referent-card">${l.photo ? `<img src="${esc(l.photo)}" alt="">` : `<span class="monogram">${esc(initials(l.display_name))}</span>`}
        <div><span class="muted" style="font-size:.85rem">Votre avocat référent</span><h3>Maître ${esc(l.display_name.replace(/^(Me|Maître)\s+/i, ''))}</h3>
        <p class="muted" style="margin:0">Il suit l’ensemble de vos dossiers et connaît votre situation : vos rendez-vous sont pris avec lui.</p></div></div>
        ${l.accepts_appointments && l.has_availability ? nav(true, 'Choisir un créneau', true) : `<div class="empty" style="margin-top:20px"><h3>Pas de créneau en ligne</h3><p>Votre avocat ne prend pas de rendez-vous en ligne en ce moment. Déposez une demande : il vous recontactera.</p><a class="btn" href="/espace-client.html?nouvelle=${state.domains[0] || ''}">Déposer une demande</a></div>${nav(true)}`}`
      : `<div class="empty"><h3>Votre avocat référent n’est plus disponible</h3><p>Le cabinet va vous attribuer un nouvel avocat. Contactez-nous ou déposez une demande en attendant.</p><a class="btn" href="/contact.html">Contacter le cabinet</a></div>${nav(true)}`}`;
    state.lawyer = ref.id;
    bindNav();
    return;
  }
  const available = lawyers.filter(l => l.accepts_appointments && l.has_availability)
    .map(l => ({ ...l, cov: coverage(l) })).sort((a, b) => b.cov - a.cov || a.display_name.localeCompare(b.display_name));
  const best = available.length ? available[0].cov : 0;
  const top = best ? available.filter(l => l.cov === best) : [];
  const partial = available.filter(l => l.cov > 0 && l.cov < best);
  const others = available.filter(l => l.cov === 0);
  // L'avocat qui couvre le plus de pôles est choisi d'office (premier par ordre alphabétique en cas d'égalité)
  if (top.length && !available.some(l => l.id === state.lawyer)) { state.lawyer = top[0].id; state.date = state.time = null; save(); }
  const n = state.domains.length;
  const card = l => `<button class="choice" data-v="${l.id}" aria-pressed="${state.lawyer === l.id}">
      ${l.cov === best && best ? `<span class="badge-best">${n > 1 ? (l.cov === n ? `Couvre vos ${n} pôles` : `Couvre ${l.cov} pôles sur ${n}`) : 'Spécialiste'}</span>` : n > 1 && l.cov ? `<span class="badge-part">Couvre ${l.cov} pôle${l.cov > 1 ? 's' : ''} sur ${n}</span>` : ''}
      <strong>${esc(l.display_name)}</strong><small>${esc(l.title)} · ${l.specialties.map(domainName).map(esc).join(', ') || 'Généraliste'}</small>
      <small style="display:block;margin-top:6px">Reçoit le ${l.weekdays.sort().map(w => WEEKDAYS[w].toLowerCase()).join(', ')}</small></button>`;
  root.innerHTML = `<h2 tabindex="-1" style="font-size:var(--step-3)">Avec quel avocat ?</h2>
    <p class="muted">${state.domains.map(d => esc(domainName(d))).join(' + ')} · ${totalLine()}</p>
    <p class="muted" style="font-size:.88rem">${n > 1 ? 'Nous vous proposons en priorité l’avocat qui couvre le plus de vos pôles : un seul interlocuteur pour l’ensemble de votre situation. ' : ''}L’avocat choisi devient votre avocat référent : il suivra vos dossiers suivants.</p>
    ${!available.length ? `<div class="empty"><h3>Aucun créneau ouvert</h3><p>Aucun avocat n'a encore publié ses disponibilités. Déposez une demande écrite : le cabinet vous proposera un rendez-vous.</p><a class="btn" href="/espace-client.html?nouvelle=${state.domains[0] || ''}">Déposer une demande</a></div>` : ''}
    ${top.length ? `<h3 class="lawyer-group">${n > 1 ? 'Recommandé pour votre demande' : 'Spécialistes de ce pôle'}</h3><div class="choice-grid">${top.map(card).join('')}</div>`
      : available.length ? '<p>Aucun spécialiste de ces pôles ne prend de rendez-vous en ce moment. Les avocats ci-dessous peuvent vous recevoir.</p>' : ''}
    ${partial.length ? `<h3 class="lawyer-group">Couvrent une partie de vos besoins</h3><div class="choice-grid">${partial.map(card).join('')}</div>` : ''}
    ${others.length ? `<h3 class="lawyer-group">${top.length ? 'Autres avocats disponibles' : 'Avocats disponibles'}</h3><div class="choice-grid">${others.map(card).join('')}</div>` : ''}
    ${nav(true, 'Choisir un créneau', !!state.lawyer)}`;
  $$('.choice', root).forEach(b => b.onclick = () => { state.lawyer = +b.dataset.v; state.date = state.time = null; setStep(3); });
  bindNav();
}

async function stepSlot() {
  const lawyer = lawyers.find(l => l.id === state.lawyer);
  if (!lawyer) return setStep(2);
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  root.innerHTML = `<h2 tabindex="-1" style="font-size:var(--step-3)">Quand ?</h2>
    <p class="muted">Avec ${esc(lawyer.display_name)} · créneaux des 14 prochains jours</p>
    <div class="days">${days.map(d => `<button class="day" data-d="${ymd(d)}" ${lawyer.weekdays.includes(d.getDay()) ? '' : 'disabled'} aria-pressed="${state.date === ymd(d)}" aria-label="${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}">
      ${d.toLocaleDateString('fr-FR', { weekday: 'short' })}<b>${d.getDate()}</b>${d.toLocaleDateString('fr-FR', { month: 'short' })}</button>`).join('')}</div>
    <div id="slots"></div>
    ${nav(true, 'Continuer', !!state.time)}`;
  $$('.day', root).forEach(b => b.onclick = () => { $$('.day', root).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); state.date = b.dataset.d; state.time = null; $('[data-next]', root).disabled = true; loadSlots(); });
  bindNav();
  if (state.date) loadSlots();
}

async function loadSlots() {
  const box = $('#slots');
  box.innerHTML = '<span class="loader">Recherche des créneaux</span>';
  try {
    const { slots } = await api(`/public/slots?lawyer=${state.lawyer}&date=${state.date}`);
    box.innerHTML = slots.length
      ? `<h3 style="margin-top:28px;font-size:1.2rem">${esc(fmtDay(state.date))}</h3><div class="slots">${slots.map(s => `<button class="slot" data-t="${s.time}" aria-pressed="${state.time === s.time}">${s.time}</button>`).join('')}</div>`
      : '<p class="muted" style="margin-top:24px">Plus aucun créneau libre ce jour-là. Choisissez une autre date.</p>';
    $$('.slot', box).forEach(b => b.onclick = () => { $$('.slot', box).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); state.time = b.dataset.t; save(); $('[data-next]', root).disabled = false; });
  } catch (e) { box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
}

async function stepConfirm() {
  const me = await getMe();
  const lawyer = lawyers.find(l => l.id === state.lawyer);
  if (!lawyer || !state.date || !state.time) return setStep(3);
  let cases = [];
  if (me) { try { cases = (await api('/cases')).cases.filter(c => !['cloture', 'refuse'].includes(c.status)); } catch { /* ignore */ } }
  root.innerHTML = `<h2 tabindex="-1" style="font-size:var(--step-3)">Vérifiez et confirmez</h2>
    <dl class="recap">
      <div><dt>${state.domains.length > 1 ? 'Pôles' : 'Pôle'}</dt><dd>${state.domains.map(d => esc(domainName(d))).join(' + ')}</dd></div>
      <div><dt>Prestation${state.picks.length > 1 ? 's' : ''}</dt><dd><ul class="recap-list">${state.picks.map(p => { const x = priceOf(p); return `<li>${esc(p.name)}${state.domains.length > 1 ? ` <span class="muted">· ${esc(domainName(p.domain))}</span>` : ''}${x ? ` <span class="price-tag${x.price === 0 ? ' free' : ''}">${esc(fmtPrice(x.price, x.price_unit))}</span>` : ''}</li>`; }).join('')}</ul>${state.picks.length > 1 ? `<span class="muted">${totalLine()}</span>` : ''}</dd></div>
      <div><dt>Avocat</dt><dd>${esc(lawyer.display_name)}</dd></div>
      <div><dt>Date</dt><dd>${esc(fmtDay(state.date))} à ${esc(state.time)}</dd></div>
    </dl>
    <form class="form" id="confirm-form" style="margin-top:28px" novalidate>
      ${cases.length ? `<div class="field"><label for="b-case">Rattacher à un dossier (facultatif)</label><select class="input" id="b-case" name="case_number"><option value="">Aucun dossier</option>${cases.map(c => `<option value="${esc(c.number)}" ${state.case_number === c.number ? 'selected' : ''}>${esc(c.number)} — ${esc(c.title)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="b-reason">Motif du rendez-vous</label><textarea class="input" id="b-reason" name="reason" required minlength="5" maxlength="500" style="min-height:110px" placeholder="En quelques lignes : votre situation et ce que vous attendez du rendez-vous.">${esc(state.reason)}</textarea></div>
    </form>
    ${me ? nav(true, 'Confirmer le rendez-vous', true) : `${nav(true)}<div class="aside-box" style="position:static;margin-top:24px"><h3>Dernière étape : connexion</h3><p class="muted">Connectez-vous avec Discord pour confirmer. Vos choix sont conservés.</p><a class="btn btn-discord" data-login href="${loginUrl('/rendez-vous.html')}">Se connecter avec Discord</a></div>`}`;
  const reason = $('#b-reason');
  reason.oninput = () => { state.reason = reason.value; save(); };
  $('[data-login]', root)?.addEventListener('click', () => { state.reason = reason.value; save(); });
  bindNav(async e => {
    if (!reason.checkValidity()) { reason.setAttribute('aria-invalid', 'true'); reason.focus(); return toast('Indiquez le motif du rendez-vous (5 caractères minimum).', 'error'); }
    await withLoading(e.currentTarget, async () => {
      try {
        await api('/appointments', { method: 'POST', body: { domain: state.domains[0], services: state.picks, lawyer_id: state.lawyer, date: state.date, time: state.time, reason: reason.value, case_number: $('#b-case')?.value || undefined } });
        sessionStorage.removeItem(KEY);
        $$('#steps li').forEach(li => li.className = 'done');
        root.innerHTML = `<div class="empty" style="border-style:solid"><h3>Rendez-vous confirmé</h3>
          <p>${esc(fmtDay(state.date))} à ${esc(state.time)} avec ${esc(lawyer.display_name)}.<br>Une confirmation vous a été envoyée sur Discord si vos messages privés sont ouverts.</p>
          <a class="btn" href="/espace-client.html#rendez-vous">Voir mes rendez-vous</a></div>`;
      } catch (err) {
        toast(err.message, 'error');
        if (err.status === 409) { state.time = null; setStep(3); }
      }
    });
  });
}

(async () => {
  try { lawyers = (await api('/public/lawyers')).lawyers; } catch { lawyers = []; }
  catalog = await loadServices();
  me = await getMe();
  if (me?.referent) state.lawyer = me.referent.id;
  if (params.get('avocat') && !state.domains.length) state.domains = [lawyers.find(l => l.id === state.lawyer)?.specialties[0] || 'conseil'];
  state.picks = state.picks.filter(p => state.domains.includes(p.domain));
  const start = !needComplete() ? 1 : state.lawyer && state.date && state.time ? 4 : state.lawyer ? 3 : 2;
  setStep(start);
})();
