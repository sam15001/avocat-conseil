import { api, $, $$, esc, fmtDate, domainName, initials, toast, withLoading } from './app.mjs';
import { ICONS } from './icons.mjs';
import { loadServices, groupServices } from './app.mjs';
import { DOMAINS, fmtPrice } from './domains.mjs';

const page = document.body.dataset.page;

// ── Équipe (accueil, page équipe, pages domaines)
export const maitre = n => /^(Me|Ma[iî]tre)\s/i.test(n) ? n.replace(/^Me\s/i, 'Maître ') : `Maître ${n}`;

function lawyerCard(l, { bio = false, portrait = false } = {}) {
  const img = l.photo ? `<img src="${esc(l.photo)}" alt="Portrait de ${esc(l.display_name)}" loading="lazy">` : `<span class="monogram">${esc(initials(l.display_name))}</span>`;
  const specs = l.specialties.map(domainName).map(esc).join(', ') || 'Généraliste';
  if (portrait) return `<a class="lawyer-card" href="/rendez-vous.html?avocat=${l.id}" aria-label="Prendre rendez-vous avec ${esc(maitre(l.display_name))}">
    <div class="lawyer-portrait">${img}</div>
    <div class="lawyer-meta"><h3>${esc(maitre(l.display_name))}</h3><div class="title">${esc(l.title)}</div></div></a>`;
  return `<div class="lawyer-card">
    <a href="/rendez-vous.html?avocat=${l.id}" class="lawyer-portrait" style="display:grid" aria-label="Prendre rendez-vous avec ${esc(maitre(l.display_name))}">${img}</a>
    <h3>${esc(maitre(l.display_name))}</h3>
    <div class="title">${esc(l.title)}</div>
    <div class="specs">${specs}</div>
    ${bio && l.bio ? `<p class="bio">${esc(l.bio)}</p>` : ''}
    ${l.phone || l.email ? `<div class="lawyer-contact">${l.phone ? `<span>${ICONS.phone}${esc(l.phone)}</span>` : ''}${l.email ? `<span>${ICONS.mail}${esc(l.email)}</span>` : ''}</div>` : ''}
    <div class="specs" style="margin-top:10px">${l.cases_closed} dossier${l.cases_closed > 1 ? 's' : ''} mené${l.cases_closed > 1 ? 's' : ''} à terme</div>
    ${l.accepts_appointments && l.has_availability ? `<a class="link-more" href="/rendez-vous.html?avocat=${l.id}">Prendre rendez-vous${ICONS.arrow}</a>` : ''}
  </div>`;
}

async function loadTeams() {
  const grids = $$('[data-team]');
  if (!grids.length && !$('[data-stat]')) return;
  let lawyers = [];
  try { lawyers = (await api('/public/lawyers')).lawyers; } catch { /* affichage vide */ }
  $('[data-stat="lawyers"]') && ($('[data-stat="lawyers"]').textContent = lawyers.length);
  $('[data-stat="closed"]') && ($('[data-stat="closed"]').textContent = lawyers.reduce((s, l) => s + l.cases_closed, 0));
  for (const g of grids) {
    const scope = g.dataset.team;
    let list = scope === 'home' ? lawyers.slice(0, 4) : scope === 'all' ? lawyers : lawyers.filter(l => l.specialties.includes(scope));
    g.innerHTML = list.length ? list.map(l => lawyerCard(l, { bio: g.hasAttribute('data-bio'), portrait: g.classList.contains('team-portraits') })).join('')
      : `<p class="muted">${scope === 'home' || scope === 'all' ? "L'équipe sera présentée ici dès que les fiches avocats seront publiées." : "Aucun avocat n'est encore rattaché à ce pôle. Vos demandes sont tout de même traitées par le cabinet."}</p>`;
  }
}

// ── Actualités
async function loadNews() {
  const list = $('[data-news]');
  if (!list) return;
  const slug = new URLSearchParams(location.search).get('a');
  if (slug && page === 'actualites') return showArticle(slug);
  try {
    const { news } = await api(`/public/news?limit=${list.dataset.news}`);
    list.innerHTML = news.length ? news.map(n => `<a class="news-item" href="/actualites.html?a=${encodeURIComponent(n.slug)}">
      ${n.image ? `<figure class="news-img"><img src="${esc(n.image)}" alt="" loading="lazy"></figure>` : ''}<span class="cat">${esc(n.category)}</span><h3>${esc(n.title)}</h3><p>${esc(n.excerpt)}</p><time datetime="${esc(n.created_at)}">${fmtDate(n.created_at)}</time></a>`).join('')
      : '<p class="muted">Aucune actualité publiée pour le moment.</p>';
  } catch { list.innerHTML = '<p class="muted">Les actualités sont momentanément indisponibles.</p>'; }
}

async function showArticle(slug) {
  const root = $('#news-root');
  try {
    const { article: a } = await api(`/public/news/${encodeURIComponent(slug)}`);
    document.title = `${a.title} — AVOCAT & CONSEIL`;
    $('#news-head .wrap').innerHTML = `<nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span>/</span><a href="/actualites.html">Actualités</a><span>/</span><span>${esc(a.category)}</span></nav>
      <h1>${esc(a.title)}</h1><p class="lede">${esc(a.excerpt)}</p><p class="muted">${fmtDate(a.created_at)}</p>`;
    root.innerHTML = `${a.image ? `<figure class="photo article-cover"><img src="${esc(a.image)}" alt=""></figure>` : ''}<article class="prose article-body" style="max-width:720px">${a.body.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}</article>
      <p style="margin-top:48px"><a class="btn btn-ghost" href="/actualites.html">Toutes les actualités</a></p>`;
  } catch { root.innerHTML = '<div class="empty"><h3>Article introuvable</h3><a class="btn btn-ghost" href="/actualites.html">Toutes les actualités</a></div>'; }
}

// ── Formulaires publics
function bindForm(id, path, success) {
  const form = $(id);
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
    const invalid = $$('[required]', form).filter(el => !el.checkValidity());
    if (invalid.length) { invalid.forEach(el => el.setAttribute('aria-invalid', 'true')); invalid[0].focus(); toast('Complétez les champs obligatoires.', 'error'); return; }
    await withLoading($('button[type=submit]', form), async () => {
      try {
        await api(path, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
        form.reset(); toast(success);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

// ── Connexion
function initLogin() {
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/espace-client.html';
  $('#login-btn').href = `/api/auth/login?next=${encodeURIComponent(next)}`;
  const msgs = {
    annule: 'Connexion annulée sur Discord.',
    etat: 'La session de connexion a expiré. Réessayez.',
    discord: "Discord n'a pas répondu correctement. Réessayez dans un instant.",
    expire: 'Le lien de connexion a expiré ou a déjà servi (page rechargée, double clic). Cliquez à nouveau sur « Se connecter avec Discord ».',
    serveur: "Vous devez être membre du serveur Discord du cabinet pour vous connecter.",
    desactive: 'Ce compte a été désactivé par le cabinet.'
  };
  const err = params.get('erreur');
  if (err && msgs[err]) { const c = params.get('code'); $('#login-error').textContent = msgs[err] + (c ? ` (code ${c === 'secret' ? 'secret OAuth2 refusé' : c})` : ''); $('#login-error').hidden = false; }
}

loadTeams();
loadNews();
bindForm('#contact-form', '/public/contact', 'Message envoyé. Le cabinet vous répondra rapidement.');
bindForm('#apply-form', '/public/applications', 'Candidature envoyée. La direction vous recontactera.');
if (page === 'connexion') initLogin();

// ── Prestations et tarifs (pages domaines et honoraires), depuis la base
const priceRow = x => `<div class="price-row"><div><strong>${esc(x.name)}</strong>${x.description ? `<p>${esc(x.description)}</p>` : ''}</div>
  <span class="price-tag${x.price === 0 ? ' free' : ''}">${esc(fmtPrice(x.price, x.price_unit))}</span></div>`;

async function loadPriceLists() {
  const lists = $$('[data-services]');
  const fees = $('#fees');
  if (!lists.length && !fees) return;
  const all = await loadServices();
  for (const el of lists) {
    const groups = groupServices(all, el.dataset.services);
    el.innerHTML = groups.length ? groups.map(g => `<h3 class="price-group">${esc(g.group)}</h3>${g.items.map(priceRow).join('')}`).join('')
      : '<p class="muted">Les prestations de ce pôle sont présentées lors de la consultation.</p>';
  }
  if (fees) {
    const doms = DOMAINS.filter(d => all.some(s => s.domain === d.slug));
    $('#fee-nav').innerHTML = doms.map(d => `<a href="#tarifs-${d.slug}">${esc(d.name)}</a>`).join('');
    fees.innerHTML = doms.map(d => `<section class="fee-block" id="tarifs-${d.slug}"><h2>${esc(d.name)}</h2>
      ${groupServices(all, d.slug).map(g => `<h3 class="price-group">${esc(g.group)}</h3>${g.items.map(priceRow).join('')}`).join('')}
      <p style="margin-top:18px"><a class="link-more" href="/rendez-vous.html?domaine=${d.slug}">Prendre rendez-vous${ICONS.arrow}</a></p></section>`).join('');
  }
}
loadPriceLists();
