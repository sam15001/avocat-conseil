// Assemble les pages : src/pages/*.html + en-tête/pied de page communs → dist/
// Les pages de domaines (dist/expertises/<slug>.html) sont générées depuis shared/domains.mjs.
import fs from 'node:fs';
import path from 'node:path';
import site from '../site.config.mjs';
import { DOMAINS, DOC_TERMS } from '../shared/domains.mjs';
import { ICONS, DOMAIN_ICON, crest } from '../src/assets/js/icons.mjs';

const SRC = 'src', OUT = 'dist';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync('shared/domains.mjs', path.join(OUT, 'assets/js/domains.mjs'));
// Numéro de version : après chaque mise en ligne, le navigateur charge les nouveaux scripts (même URL partout)
const BUILD = Date.now().toString(36);
for (const f of fs.readdirSync(path.join(OUT, 'assets/js')).filter(f => f.endsWith('.mjs'))) {
  const file = path.join(OUT, 'assets/js', f);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/(from\s+|import\()(['"])(\.\/[\w-]+\.mjs)\2/g, `$1$2$3?v=${BUILD}$2`));
}

const docTerms = () => `<div class="doc-terms"><h3>Service B2B documentaire : comment ça fonctionne</h3><dl>${DOC_TERMS.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>
  <p class="muted">La souscription se fait avec le cabinet : prenez rendez-vous ou contactez nos avocats associés.</p></div>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const MARK = crest('crest');
const WORDMARK = `<span class="wordmark"><span class="wm-name">Avocat &amp; Conseil</span><span class="wm-sub">Cabinet juridique · Los Santos</span></span>`;
const ARROW = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 7h12M8 2l5 5-5 5"/></svg>`;
const DISCORD = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14.1 14.1 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>`;

const QUICK = [
  ['/rendez-vous.html', 'Prendre rendez-vous', 'Choisissez un avocat et un créneau libre, confirmation immédiate.'],
  ['/espace-client.html?nouvelle=1', 'Déposer une demande', 'Exposez votre situation, joignez vos preuves, recevez un numéro de dossier.'],
  ['/espace-client.html', 'Suivre mon dossier', 'Statut, rendez-vous, documents et messages de votre avocat.'],
  ['/honoraires.html', 'Honoraires', 'Les tarifs de chaque prestation, par domaine.'],
  ['/equipe.html', 'Nos avocats', 'Spécialités, coordonnées et disponibilités.'],
  ['/recherche.html', 'Rechercher', 'Une prestation, un avocat, une actualité.'],
  ['/recrutement.html', 'Nous rejoindre', 'Postes ouverts au cabinet et candidature en ligne.'],
  ['/faq.html', 'Questions fréquentes', 'Demandes, rendez-vous, suivi de votre dossier.']
];

const NAV = [
  ['accueil', '/', 'Accueil'],
  ['cabinet', '/cabinet.html', 'Le cabinet'],
  ['expertises', '/expertises.html', 'Expertises'],
  ['equipe', '/equipe.html', 'Notre équipe'],
  ['actualites', '/actualites.html', 'Actualités'],
  ['contact', '/contact.html', 'Contact']
];

const navItem = ([k, h, l], active) => k === 'expertises'
  ? `<div class="nav-drop"><a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}<svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></a>
      <div class="drop-menu">${DOMAINS.map(d => `<a href="/expertises/${d.slug}.html">${ICONS[DOMAIN_ICON[d.slug]]}<span>${esc(d.name)}</span></a>`).join('')}</div></div>`
  : `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`;

const header = active => `
<a class="skip" href="#main">Aller au contenu</a>
${site.notice ? `<div class="notice-band"><div class="wrap"><span>${esc(site.notice)}</span><a href="/rendez-vous.html">Prendre rendez-vous</a></div></div>` : ''}
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${esc(site.name)}, accueil">${MARK}${WORDMARK}</a>
    <nav class="main-nav" id="main-nav" aria-label="Navigation principale">
      ${NAV.map(n => navItem(n, active)).join('\n      ')}
    </nav>
    <div class="header-actions">
      <button class="search-btn theme-btn" type="button" aria-label="Passer en mode clair" title="Mode clair / sombre"><svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button>
      <a class="search-btn" href="/recherche.html" aria-label="Rechercher sur le site" title="Rechercher">${ICONS.search}</a>
      <a class="btn btn-rdv" href="/rendez-vous.html">${ICONS.calendar}Prendre rendez-vous</a>
      <div class="account" id="account"><a class="btn btn-sm btn-ghost" href="/connexion.html">Connexion</a></div>
      <button class="nav-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="main-nav"><span></span><span></span></button>
    </div>
  </div>
</header>`;

const footer = () => `
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/">${MARK}${WORDMARK}</a>
        <p>Cabinet d'avocats à Los Santos. Défense pénale, contentieux civils et conseil aux entreprises.</p>
        <div class="socials"><a href="${esc(site.discordInvite)}" aria-label="Rejoindre notre serveur Discord" rel="noopener" target="_blank">${DISCORD}</a></div>
      </div>
      <div><h4>Le cabinet</h4><ul>
        <li><a href="/cabinet.html">Présentation</a></li><li><a href="/equipe.html">Notre équipe</a></li>
        <li><a href="/honoraires.html">Honoraires</a></li><li><a href="/rendez-vous.html">Prendre rendez-vous</a></li><li><a href="/recrutement.html">Recrutement</a></li><li><a href="/faq.html">Questions fréquentes</a></li><li><a href="https://legifrat.fr/" target="_blank" rel="noopener">Législation de FratWorld (LégiFrat)</a></li></ul></div>
      <div><h4>Expertises</h4><ul>
        ${DOMAINS.map(d => `<li><a href="/expertises/${d.slug}.html">${esc(d.name)}</a></li>`).join('')}</ul></div>
      <div><h4>Nous trouver</h4><ul>
        <li>${site.address.map(esc).join('<br>')}</li>
        <li>Téléphone en jeu : ${esc(site.phone)}</li>
        <li>${esc(site.hours)}</li>
        <li><a href="/rendez-vous.html">Prendre rendez-vous</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(site.name)} — cabinet fictif sur serveur GTA V RP. Aucun conseil juridique réel.</span>
      <span><a href="/espace-client.html">Espace client</a> · <a href="/espace-avocat.html">Espace avocat</a></span>
    </div>
  </div>
</footer>
<div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;

function layout({ title, desc, nav, body, script, page }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || 'Cabinet d\'avocats AVOCAT & CONSEIL à Los Santos.')}">
<meta name="theme-color" content="#09090A">
<meta name="color-scheme" content="dark light">
<script>try{var t=localStorage.getItem('ac_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;if(t==='light')document.querySelector('meta[name=theme-color]').content='#FFFFFF'}catch(e){}</script>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/bodoni-moda-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/hanken-grotesk-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/style.css?v=${BUILD}">
<script type="module" src="/assets/js/app.mjs?v=${BUILD}"></script>
${script ? `<script type="module" src="/assets/js/${script}?v=${BUILD}"></script>` : ''}
</head>
<body data-page="${page}">
${header(nav)}
<main id="main">
${body}
</main>
${footer()}
</body>
</html>`;
}

const fill = html => html
  .replace(/\{\{photo:(\w+)\}\}/g, (_, k) => `${esc(site.photos[k] || '')}" data-site-photo="${k}`)
  .replace(/\{\{site:(\w+)\}\}/g, (_, k) => esc(Array.isArray(site[k]) ? site[k].join(', ') : site[k]))
  .replace(/\{\{arrow\}\}/g, ARROW)
  .replace(/\{\{mark\}\}/g, () => MARK)
  .replace(/\{\{discord\}\}/g, DISCORD)
  .replace(/\{\{icon:(\w+)\}\}/g, (_, k) => ICONS[k] || '')
  .replace(/\{\{domains:cards\}\}/g, () => DOMAINS.map(d => `
    <a class="domain-card" href="/expertises/${d.slug}.html">${ICONS[DOMAIN_ICON[d.slug]]}<strong>${esc(d.name)}</strong><span>${esc(d.tag)}</span></a>`).join(''))
  .replace(/\{\{docterms\}\}/g, () => docTerms())
  .replace(/\{\{quick\}\}/g, () => QUICK.map(([h, t, d, ext]) => `<a class="quick-link" href="${h}"${ext ? ' target="_blank" rel="noopener"' : ''}><strong>${esc(t)}</strong><span>${esc(d)}</span></a>`).join(''))
  .replace(/\{\{domains:index\}\}/g, () => DOMAINS.map(d => `
    <a class="domain-row" href="/expertises/${d.slug}.html">
      <h3>${esc(d.name)}</h3><p>${esc(d.short)}</p><span class="arrow">${ARROW}</span>
    </a>`).join(''));

let count = 0;
for (const file of fs.readdirSync(path.join(SRC, 'pages'))) {
  if (!file.endsWith('.html')) continue;
  const raw = fs.readFileSync(path.join(SRC, 'pages', file), 'utf8');
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  const meta = m ? JSON.parse(m[1]) : {};
  const body = fill(m ? raw.slice(m[0].length) : raw);
  fs.writeFileSync(path.join(OUT, file), layout({ ...meta, body, page: file.replace('.html', '') }));
  count++;
}

// Pages dédiées à chaque domaine
fs.mkdirSync(path.join(OUT, 'expertises'), { recursive: true });
const PHOTO_FOR = { penal: 'tribunal', civil: 'reunion', affaires: 'bureau', immobilier: 'facade', 'administratif-routier': 'tribunal', conseil: 'bibliotheque' };
for (const d of DOMAINS) {
  const others = DOMAINS.filter(o => o.slug !== d.slug);
  const body = `
<section class="page-head">
  <figure class="page-head-photo" aria-hidden="true"><img src="${esc(site.photos[PHOTO_FOR[d.slug]])}" data-site-photo="${PHOTO_FOR[d.slug]}" alt=""></figure>
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span>/</span><a href="/expertises.html">Expertises</a><span>/</span><span>${esc(d.name)}</span></nav>
    <h1>${esc(d.name)}</h1>
    <p class="lede">${esc(d.intro)}</p>
  </div>
</section>
<section class="section">
  <div class="wrap two-col">
    <div>
      <h2>Nos prestations</h2>
      <div class="price-list" data-services="${d.slug}"><span class="loader">Chargement des prestations</span></div>
      ${d.slug === 'affaires' ? docTerms() : ''}
      <div style="margin-top:72px">
        <h2>Les avocats de ce pôle</h2>
        <div class="team-grid" data-team="${d.slug}"><span class="loader">Chargement</span></div>
      </div>
    </div>
    <aside>
      <div class="aside-box">
        <h3>Exposer votre situation</h3>
        <p class="muted">Déposez une demande : un avocat spécialisé l'étudie et vous recontacte. Vous suivez l'avancement depuis votre espace client.</p>
        <a class="btn" href="/espace-client.html?nouvelle=${d.slug}">Déposer une demande</a>
        <a class="btn btn-ghost" href="/rendez-vous.html?domaine=${d.slug}">Prendre rendez-vous</a>
        <a class="btn btn-quiet" href="/contact.html">Poser une question</a>
      </div>
    </aside>
  </div>
</section>
<section class="section-tight">
  <div class="wrap">
    <h2 style="font-size:var(--step-3)">Autres domaines</h2>
    <div class="domain-index">${others.map(o => `<a class="domain-row" href="/expertises/${o.slug}.html"><h3>${esc(o.name)}</h3><p>${esc(o.short)}</p><span class="arrow">${ARROW}</span></a>`).join('')}</div>
  </div>
</section>`;
  fs.writeFileSync(path.join(OUT, 'expertises', `${d.slug}.html`), layout({
    title: `${d.name} — AVOCAT & CONSEIL`, desc: d.short, nav: 'expertises', body, script: 'public.mjs', page: 'domaine'
  }));
  count++;
}
console.log(`✔ ${count} pages générées dans dist/`);
