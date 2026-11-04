// Socle commun : API, session, en-tête, notifications, modales, utilitaires.
import { STATUS_BY_KEY, DOMAIN_BY_SLUG, ROLES } from './domains.mjs';
import { ICONS, crest } from './icons.mjs';
export { ICONS };

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'x-requested-with': 'avocat-conseil', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = {};
  try { data = await res.json(); } catch { /* vide */ }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Une erreur est survenue.');
  return data;
}

// ── Session
let mePromise;
export function getMe() {
  if (!mePromise) mePromise = api('/me').then(d => d.user).catch(() => null);
  return mePromise;
}

export const loginUrl = (next = location.pathname + location.search + location.hash) => `/api/auth/login?next=${encodeURIComponent(next)}`;

export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/';
}

// ── Format
export const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
export const fmtShort = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
export const fmtDateTime = d => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDay = ymd => new Date(ymd + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.ceil(n / 1024) + ' Ko';
export const domainName = s => DOMAIN_BY_SLUG[s]?.name || s;
export const statusPill = s => `<span class="pill s-${esc(s)}">${esc(STATUS_BY_KEY[s]?.label || s)}</span>`;
export const roleName = r => ROLES[r] || 'Citoyen';
export const initials = n => String(n || '?').replace(/^(Me|Ma[iî]tre)\s+/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
export const avatar = u => u?.avatar ? `<img src="${esc(u.avatar)}" alt="">` : `<span class="avatar-fallback">${esc(initials(u?.name))}</span>`;
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const ICON_DOC = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 2h7l4 4v12H5z"/><path d="M12 2v4h4"/></svg>`;

// ── Notifications
export function toast(msg, type = 'ok') {
  const box = $('#toasts');
  if (!box) return alert(msg);
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  box.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'error' ? 6000 : 3800);
}

// ── Modale générique. Retourne une promesse résolue avec les données du formulaire, ou null.
export function modal({ title, body, confirm = 'Valider', cancel = 'Annuler', danger = false, onSubmit, onOpen, wide = false }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'modal' + (wide ? ' wide' : '');
    d.innerHTML = `<form method="dialog" class="modal-form" novalidate>
      <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="modal-close" aria-label="Fermer">×</button></div>
      <div class="modal-body">${body}</div>
      <p class="form-error" style="padding:0 26px" hidden></p>
      <div class="modal-foot"><button type="button" class="btn btn-ghost btn-sm" data-cancel>${esc(cancel)}</button>
      <button type="submit" class="btn btn-sm ${danger ? 'btn-danger' : ''}">${esc(confirm)}</button></div></form>`;
    document.body.append(d);
    const form = $('form', d), err = $('.form-error', d);
    const close = v => { d.close(); d.remove(); resolve(v); };
    $('.modal-close', d).onclick = () => close(null);
    $('[data-cancel]', d).onclick = () => close(null);
    d.addEventListener('cancel', e => { e.preventDefault(); close(null); });
    form.onsubmit = async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const btn = $('button[type=submit]', form);
      if (!onSubmit) return close(data);
      btn.classList.add('loading'); err.hidden = true;
      try { close(await onSubmit(data, form) ?? data); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; btn.classList.remove('loading'); }
    };
    d.showModal();
    onOpen?.(d);
    $('input:not([type=file]):not([disabled]), select, textarea', d)?.focus();
  });
}

export const confirmModal = (title, text, opts = {}) => modal({ title, body: `<p>${esc(text)}</p>`, ...opts }).then(Boolean);

// ── Bouton avec état de chargement
export async function withLoading(btn, fn) {
  btn.classList.add('loading');
  try { return await fn(); } finally { btn.classList.remove('loading'); }
}

// ── Lecture d'un fichier en base64
export const fileToBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(new Error('Lecture du fichier impossible.'));
  r.readAsDataURL(file);
});

// Image réduite dans le navigateur avant envoi (captures en jeu souvent > 5 Mo) : JPEG, 2000 px de large maximum
export function resizeImage(file, maxW = 2000, quality = 0.86) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(new Error('Formats acceptés : PNG, JPG ou WEBP.'));
    if (file.size > 25 * 1024 * 1024) return rej(new Error('Image trop lourde (25 Mo maximum).'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', quality);
      res({ mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image illisible.')); };
    img.src = url;
  });
}

// Photos du site remplacées depuis l'administration
async function applySitePhotos() {
  const imgs = $$('img[data-site-photo]');
  if (!imgs.length) return;
  try {
    const { photos } = await api('/public/site-photos');
    for (const img of imgs) { const v = photos[img.dataset.sitePhoto]; if (v) img.src = `/api/public/site-photo/${img.dataset.sitePhoto}?v=${v}`; }
  } catch { /* photos par défaut */ }
}
applySitePhotos();

export async function uploadFiles(caseNumber, files, { internal = false } = {}) {
  for (const f of files) {
    if (f.size > 4 * 1024 * 1024) throw new Error(`${f.name} dépasse 4 Mo.`);
    await api(`/cases/${encodeURIComponent(caseNumber)}/documents`, { method: 'POST', body: { filename: f.name, mime: f.type || 'application/octet-stream', data: await fileToBase64(f), internal } });
  }
}

// Zone de dépôt de fichiers réutilisable
export function dropzone(root) {
  const files = [];
  root.innerHTML = `<div class="dropzone" tabindex="0" role="button">Déposez vos pièces ici ou <u>parcourez</u><br><small>PNG, JPG, WEBP, GIF, PDF ou TXT · 4 Mo maximum par fichier</small></div>
    <input type="file" multiple hidden accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt"><ul class="file-list"></ul>`;
  const dz = $('.dropzone', root), input = $('input', root), list = $('.file-list', root);
  const render = () => { list.innerHTML = files.map((f, i) => `<li><span>${esc(f.name)} · ${fmtSize(f.size)}</span><button type="button" data-i="${i}" aria-label="Retirer ${esc(f.name)}">Retirer</button></li>`).join(''); };
  const add = fl => { for (const f of fl) { if (f.size > 4 * 1024 * 1024) toast(`${f.name} dépasse 4 Mo.`, 'error'); else files.push(f); } render(); };
  dz.onclick = () => input.click();
  dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
  input.onchange = () => { add(input.files); input.value = ''; };
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); add(e.dataTransfer.files); };
  list.onclick = e => { const i = e.target.dataset.i; if (i !== undefined) { files.splice(+i, 1); render(); } };
  return { files, clear: () => { files.length = 0; render(); } };
}

// Onglets accessibles : boutons [role=tab][data-tab] et panneaux [data-panel]
export function tabs(root, onChange) {
  const all = $$('[role=tab]', root);
  const show = name => {
    all.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
    history.replaceState(null, '', '#' + name);
    Promise.resolve().then(() => onChange?.(name)).catch(e => toast(e.message, 'error'));
  };
  all.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (all.some(t => t.dataset.tab === h)) show(h); });
  const initial = location.hash.slice(1);
  show(all.some(t => t.dataset.tab === initial) ? initial : all[0].dataset.tab);
  return show;
}

// Page réservée : affiche un écran de connexion ou de refus si besoin
export async function requireRole(minRole, container) {
  const me = await getMe();
  if (!me) {
    container.innerHTML = `<div class="wrap gate">${MARK_HTML}<h1 style="font-size:2.4rem">Connexion requise</h1>
      <p>Cet espace est accessible après connexion avec votre compte Discord.</p>
      <a class="btn btn-discord" href="${loginUrl()}">Se connecter avec Discord</a></div>`;
    return null;
  }
  if (me.role < minRole) {
    container.innerHTML = `<div class="wrap gate">${MARK_HTML}<h1 style="font-size:2.4rem">Accès réservé</h1>
      <p>Cet espace est réservé au rôle « ${esc(roleName(minRole))} » ou supérieur. Votre rôle actuel : ${esc(roleName(me.role))}.</p>
      <p class="muted">Si vous venez de recevoir un rôle sur Discord, déconnectez-vous puis reconnectez-vous.</p>
      <a class="btn btn-ghost" href="/espace-client.html">Aller à mon espace client</a></div>`;
    return null;
  }
  return me;
}
const MARK_HTML = crest('mark');

// ── En-tête : menu mobile + compte
function initHeader() {
  const toggle = $('.nav-toggle'), nav = $('#main-nav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  getMe().then(me => {
    const box = $('#account');
    if (!box || !me) return;
    box.innerHTML = `<button class="account-btn" aria-haspopup="menu" aria-expanded="false">${avatar(me)}<span class="account-name">${esc(me.rp_name || me.name)}</span></button>
      <div class="account-menu" role="menu">
        <div class="role">${esc(roleName(me.role))}</div>
        <a role="menuitem" href="/espace-client.html">Espace client</a>
        <a role="menuitem" href="/espace-client.html#profil">Modifier mon nom</a>
        ${me.role >= 1 ? '<a role="menuitem" href="/espace-avocat.html">Espace avocat</a>' : ''}
        ${me.role >= 2 ? '<a role="menuitem" href="/administration.html">Administration</a>' : ''}
        <button role="menuitem" data-logout>Se déconnecter</button>
      </div>`;
    const btn = $('.account-btn', box), menu = $('.account-menu', box);
    btn.onclick = e => { e.stopPropagation(); const o = menu.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); };
    document.addEventListener('click', () => { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    $('[data-logout]', box).onclick = logout;
  });
}

// Apparition au défilement, uniquement pour les éléments marqués .reveal
function initReveal() {
  const els = $$('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
}

initHeader();
initReveal();

// ── Gabarit des espaces privés : barre latérale + en-tête
const DISCORD_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14.1 14.1 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>';
export const discordBadge = () => `<span class="discord-badge">${DISCORD_SVG}Connecté sur Discord<span class="dot" aria-hidden="true"></span></span>`;

export function dashShell({ label, nav, title, sub = '', actions = '' }) {
  const item = n => n.sep ? '<div class="side-sep"></div>'
    : n.href ? `<a class="side-link" href="${n.href}">${ICONS[n.icon] || ''}<span>${esc(n.label)}</span></a>`
    : `<button class="side-link" role="tab" data-tab="${n.key}">${ICONS[n.icon] || ''}<span>${esc(n.label)}</span><span class="count" data-count="${n.key}" hidden></span></button>`;
  return `<div class="dash">
    <aside class="dash-side"><nav role="tablist" aria-label="${esc(label)}" aria-orientation="vertical">${nav.map(item).join('')}</nav>
      <div class="side-foot"><button class="side-link" data-side-logout>${ICONS.logout}<span>Se déconnecter</span></button></div></aside>
    <div class="dash-main">
      <header class="dash-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}</div></header>
      ${nav.filter(n => n.key).map(n => `<section class="panel" data-panel="${n.key}"></section>`).join('')}
    </div></div>`;
}
document.addEventListener('click', e => { if (e.target.closest('[data-side-logout]')) logout(); });

export const kpiCard = (icon, value, label, accent = false) => `<div class="kpi-card${accent ? ' accent' : ''}">${ICONS[icon]}<div><b>${value}</b><span>${esc(label)}</span></div></div>`;
export const firstName = me => (me.rp_name || me.name || '').split(/\s+/)[0];

// ── Catalogue des prestations (chargé une fois par page)
let servicesPromise;
export function loadServices() {
  if (!servicesPromise) servicesPromise = api('/public/services').then(d => d.services).catch(() => []);
  return servicesPromise;
}
// Regroupe les prestations d'un secteur par rubrique, dans l'ordre du catalogue
export function groupServices(list, domain) {
  const groups = [];
  for (const s of list.filter(x => !domain || x.domain === domain)) {
    let g = groups.find(x => x.group === s.group_name && x.domain === s.domain);
    if (!g) groups.push(g = { domain: s.domain, group: s.group_name, items: [] });
    g.items.push(s);
  }
  return groups;
}

// ── Mode clair / sombre (choix mémorisé ; par défaut, celui de l'appareil)
function syncThemeBtn() {
  const light = document.documentElement.dataset.theme === 'light';
  for (const b of document.querySelectorAll('.theme-btn')) { b.setAttribute('aria-label', light ? 'Passer en mode sombre' : 'Passer en mode clair'); b.setAttribute('aria-pressed', String(light)); }
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = light ? '#FFFFFF' : '#09090A';
}
document.addEventListener('click', e => {
  if (!e.target.closest('.theme-btn')) return;
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ac_theme', next); } catch { /* navigation privée */ }
  syncThemeBtn();
});
syncThemeBtn();
