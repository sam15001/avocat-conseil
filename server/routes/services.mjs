// Catalogue des prestations (modules par secteur), géré depuis l'administration.
import { route } from '../router.mjs';
import { json, readJson, str, int, fail } from '../http.mjs';
import { all, get, insert, update, remove } from '../store.mjs';
import { DOMAIN_BY_SLUG, OTHER_SERVICE, PRICE_UNITS } from '../../shared/domains.mjs';

const pick = s => ({ id: s.id, domain: s.domain, group_name: s.group_name, name: s.name, description: s.description, price: s.price ?? null, price_unit: s.price_unit, sort_order: s.sort_order, active: s.active });
const ordered = list => list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

// Prestation valide : vide, « Autre demande », ou prestation active du secteur
export async function validateService(domain, service) {
  if (!service || service === OTHER_SERVICE) return;
  if (!(await all('services')).some(s => s.domain === domain && s.name === service && s.active)) fail(400, 'Prestation inconnue pour ce domaine.');
}

route('GET', '/api/public/services', async ({ query }) => {
  const domain = query.get('domain');
  if (domain && !DOMAIN_BY_SLUG[domain]) fail(404, 'Domaine inconnu.');
  const services = ordered((await all('services')).filter(s => s.active && (!domain || s.domain === domain))).map(pick);
  return json({ services });
});

function cleanService(b) {
  const domain = str(b.domain, 'Module');
  if (!DOMAIN_BY_SLUG[domain]) fail(400, 'Module inconnu.');
  let price = null;
  if (b.price !== null && b.price !== undefined && b.price !== '') {
    price = Number(String(b.price).replace(/[\s$]/g, '').replace(',', '.'));
    if (!Number.isFinite(price) || price < 0 || price > 100000000) fail(400, 'Prix invalide.');
    price = Math.round(price);
  }
  const unit = String(b.price_unit ?? '');
  if (!PRICE_UNITS.includes(unit)) fail(400, 'Unité de prix invalide.');
  const name = str(b.name, 'Intitulé', { min: 3, max: 140 });
  if (name === OTHER_SERVICE) fail(400, 'Cet intitulé est réservé.');
  return {
    domain, name, price, unit,
    group: str(b.group_name, 'Rubrique', { max: 80, optional: true }) || 'Prestations',
    description: str(b.description, 'Description', { max: 400, optional: true }) || '',
    sort: b.sort_order === undefined || b.sort_order === '' ? null : int(b.sort_order, 'Ordre'),
    active: b.active !== false
  };
}

route('GET', '/api/admin/services', async () => {
  const [services, appts, cases] = await Promise.all([all('services'), all('appointments'), all('cases')]);
  const n = (arr, s) => arr.filter(x => x.domain === s.domain && x.service === s.name).length;
  return json({ services: ordered(services).sort((a, b) => a.domain.localeCompare(b.domain)).map(s => ({ ...pick(s), appointments: n(appts, s), cases: n(cases, s) })) });
}, { auth: 2 });

const duplicate = async (s, exceptId) => (await all('services')).some(x => x.domain === s.domain && x.name.toLowerCase() === s.name.toLowerCase() && x.id !== exceptId);

route('POST', '/api/admin/services', async ({ req }) => {
  const s = cleanService(await readJson(req, 10000));
  if (await duplicate(s)) fail(409, 'Cette prestation existe déjà dans ce module.');
  const list = await all('services');
  const inGroup = list.filter(x => x.domain === s.domain && x.group_name === s.group);
  const sort = s.sort ?? (Math.max(0, ...(inGroup.length ? inGroup : list).map(x => x.sort_order)) + 1);
  const r = await insert('services', { domain: s.domain, group_name: s.group, name: s.name, description: s.description, price: s.price, price_unit: s.unit, sort_order: sort, active: s.active });
  return json({ service: pick(r) }, 201);
}, { auth: 2 });

route('PATCH', '/api/admin/services/:id', async ({ req, params }) => {
  const id = int(params.id, 'id');
  const cur = await get('services', id);
  if (!cur) fail(404, 'Prestation introuvable.');
  const s = cleanService(await readJson(req, 10000));
  if (await duplicate(s, id)) fail(409, 'Cette prestation existe déjà dans ce module.');
  await update('services', id, { domain: s.domain, group_name: s.group, name: s.name, description: s.description, price: s.price, price_unit: s.unit, sort_order: s.sort ?? cur.sort_order, active: s.active });
  return json({ ok: true });
}, { auth: 2 });

// Suppression définitive. Les dossiers et rendez-vous gardent l'intitulé enregistré.
route('DELETE', '/api/admin/services/:id', async ({ params }) => {
  const id = int(params.id, 'id');
  if (!await get('services', id)) fail(404, 'Prestation introuvable.');
  await remove('services', id);
  return json({ ok: true });
}, { auth: 2 });
