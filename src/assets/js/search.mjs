// Recherche sur tout le site : prestations, articles de loi de FratWorld, domaines, avocats, actualités.
import { api, $, $$, esc, fmtDate } from './app.mjs';
import { DOMAINS, DOMAIN_BY_SLUG, fmtPrice } from './domains.mjs';
import { LAW, LAW_SOURCE } from './legal.mjs';

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ');
const KINDS = [['all', 'Tout'], ['law', 'Articles de loi'], ['service', 'Prestations'], ['domain', 'Domaines'], ['lawyer', 'Avocats'], ['news', 'Actualités']];
const STOP = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'a', 'au', 'aux', 'en', 'd', 'l', 'pour', 'sur', 'par', 'dans', 'mon', 'ma', 'mes', 'je', 'est']);

let index = null;
async function buildIndex() {
  const [services, lawyers, news] = await Promise.all([
    api('/public/services').then(d => d.services).catch(() => []),
    api('/public/lawyers').then(d => d.lawyers).catch(() => []),
    api('/public/news?limit=50').then(d => d.news).catch(() => [])
  ]);
  const items = [];
  const seen = new Set();
  for (const [slug, list] of Object.entries(LAW)) for (const l of list) {
    if (seen.has(l.ref)) continue; seen.add(l.ref);
    items.push({ kind: 'law', title: `${l.ref} — ${l.title}`, text: l.summary, extra: l.penalty ? `Peine maximale : ${l.penalty}` : '', url: l.url, ext: true,
      where: `Législation de FratWorld · ${DOMAIN_BY_SLUG[slug].name}`, num: norm(l.ref).replace(/\s+/g, ' '), hay: norm(`${l.ref} ${l.title} ${l.summary} ${l.penalty || ''}`) });
  }
  for (const s of services) items.push({ kind: 'service', title: s.name, text: s.description || '', extra: fmtPrice(s.price, s.price_unit), url: `/expertises/${s.domain}.html`,
    where: `Prestation · ${DOMAIN_BY_SLUG[s.domain]?.name || s.domain}${s.group_name ? ' · ' + s.group_name : ''}`, hay: norm(`${s.name} ${s.description || ''} ${s.group_name || ''}`) });
  for (const d of DOMAINS) items.push({ kind: 'domain', title: d.name, text: d.short, url: `/expertises/${d.slug}.html`, where: 'Domaine d’intervention',
    hay: norm(`${d.name} ${d.tag} ${d.short} ${d.intro} ${d.services.map(x => x.join(' ')).join(' ')}`) });
  for (const l of lawyers) items.push({ kind: 'lawyer', title: l.display_name, text: `${l.title} · ${l.specialties.map(x => DOMAIN_BY_SLUG[x]?.name).filter(Boolean).join(', ')}`, url: `/rendez-vous.html?avocat=${l.id}`,
    where: 'Avocat du cabinet', hay: norm(`${l.display_name} ${l.first_name || ''} ${l.last_name || ''} ${l.title} ${l.bio || ''} ${l.specialties.map(x => DOMAIN_BY_SLUG[x]?.name).join(' ')}`) });
  for (const n of news) items.push({ kind: 'news', title: n.title, text: n.excerpt, url: `/actualites.html?a=${encodeURIComponent(n.slug)}`, where: `Actualité · ${fmtDate(n.created_at)}`, hay: norm(`${n.title} ${n.excerpt} ${n.category}`) });
  return items;
}

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function run(q, kind) {
  const query = norm(q).trim();
  if (!query) return { exact: [], hits: [], terms: [] };
  // Numéro d'article : « 226-4 », « CPP 226-4 », « BOR-VI », « décret 2026-022 »
  const num = query.match(/(?:\b(cpp|cp|cgi|deonto|bor)\b[\s-]*)?((?:\d{3}-\d+)|(?:[ivx]+-\d+)|(?:da-\d)|(?:20\d\d-\d{3}))/);
  const exact = num ? index.filter(i => i.kind === 'law' && new RegExp(`(^|[^0-9a-z-])${reEsc(num[2])}($|[^0-9a-z-]|,)`).test(i.num) && (!num[1] || i.num.startsWith(num[1] === 'bor' ? 'bor' : num[1] + ' '))) : [];
  const terms = query.split(/[^a-z0-9-]+/).filter(w => w && !STOP.has(w));
  const res = terms.map(t => new RegExp(`(^|[^a-z0-9])${reEsc(t)}(s|x|e|es)?(?![a-z0-9])`));
  const hits = index.filter(i => (kind === 'all' || i.kind === kind) && !exact.includes(i) && res.every(r => r.test(i.hay)))
    .map(i => ({ ...i, score: res.reduce((n, r) => n + (r.test(norm(i.title)) ? 3 : 1), 0) + (i.kind === 'service' ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score);
  return { exact, hits, terms };
}

function mark(text, terms) {
  let h = esc(text);
  for (const t of terms) {
    if (t.length < 2) continue;
    const plainRe = new RegExp(`(^|[^\\p{L}\\p{N}])(${[...t].map(c => `[${c}${{ a: 'àâä', e: 'éèêë', i: 'îï', o: 'ôö', u: 'ùûü', c: 'ç' }[c] || ''}]`).join('')}(?:s|x|e|es)?)(?![\\p{L}\\p{N}])`, 'giu');
    h = h.replace(plainRe, '$1<mark>$2</mark>');
  }
  return h;
}

const card = (i, terms, strong) => `<a class="search-hit${strong ? ' exact' : ''}" href="${esc(i.url)}"${i.ext ? ' target="_blank" rel="noopener"' : ''}>
  <span class="where">${esc(i.where)}</span><strong>${mark(i.title, terms)}</strong>
  ${i.text ? `<span class="txt">${mark(i.text, terms)}</span>` : ''}${i.extra ? `<span class="extra">${esc(i.extra)}</span>` : ''}</a>`;

async function render() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '', kind = KINDS.some(([k]) => k === params.get('type')) ? params.get('type') : 'all';
  $('#q').value = q;
  const out = $('#results');
  if (!q.trim()) { $('#filters').innerHTML = ''; out.innerHTML = '<p class="muted">Exemples : <a href="?q=garde%20%C3%A0%20vue">garde à vue</a> · <a href="?q=caution">caution</a> · <a href="?q=CPP%20226-4">CPP 226-4</a> · <a href="?q=IRS">IRS</a> · <a href="?q=licence">licence</a></p>'; return; }
  out.innerHTML = '<span class="loader">Recherche</span>';
  index ||= await buildIndex();
  const r = run(q, kind);
  const all = run(q, 'all');
  const counts = Object.fromEntries(KINDS.map(([k]) => [k, k === 'all' ? all.hits.length : all.hits.filter(h => h.kind === k).length]));
  $('#filters').innerHTML = KINDS.map(([k, label]) => `<a class="filter-chip" href="?q=${encodeURIComponent(q)}${k === 'all' ? '' : '&type=' + k}" aria-pressed="${kind === k}">${label} (${counts[k]})</a>`).join('');
  out.innerHTML = `${r.exact.length ? `<h2 class="results-title">Accès direct</h2>${r.exact.map(i => card(i, r.terms, true)).join('')}` : ''}
    <h2 class="results-title">${r.hits.length ? `${r.hits.length} résultat${r.hits.length > 1 ? 's' : ''}` : r.exact.length ? 'Autres résultats : aucun' : 'Aucun résultat'}</h2>
    ${r.hits.slice(0, 80).map(i => card(i, r.terms)).join('')}
    ${!r.hits.length && !r.exact.length ? `<p class="muted">Essayez un autre mot, ou cherchez directement dans la <a href="${LAW_SOURCE.url}" target="_blank" rel="noopener">législation officielle sur LégiFrat</a>.</p>` : ''}
    <p class="muted search-note">Les articles de loi sont des résumés à jour au ${LAW_SOURCE.date.split('-').reverse().join('/')} ; seul le texte officiel publié sur LégiFrat fait foi.</p>`;
}

$('#search-form').addEventListener('submit', e => { e.preventDefault(); const q = $('#q').value.trim(); history.pushState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname); render(); });
addEventListener('popstate', render);
render();
