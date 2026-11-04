// Contenu de départ, inséré une seule fois dans une base Firebase vide :
// catalogue des prestations (module pénal + actes) et 3 actualités d'exemple.
import { rtdb } from './store.mjs';
import { seedServiceRows } from '../shared/domains.mjs';
import { all } from './store.mjs';

const NEWS = [
  { slug: 'ouverture-cabinet-los-santos', title: 'Le cabinet ouvre ses bureaux à Rockford Hills', category: 'Le cabinet',
    excerpt: 'Après plusieurs mois de préparation, AVOCAT & CONSEIL accueille ses premiers clients dans ses nouveaux locaux.',
    body: "Le cabinet AVOCAT & CONSEIL ouvre officiellement ses portes à Rockford Hills. Nos avocats reçoivent sur rendez-vous, du lundi au samedi.\n\nLes demandes peuvent être déposées directement depuis votre espace client, après connexion avec votre compte Discord. Chaque demande reçoit un numéro de dossier et vous pouvez en suivre l'avancement en temps réel." },
  { slug: 'garde-a-vue-vos-droits', title: 'Garde à vue : ce que vous pouvez exiger', category: 'Droit pénal',
    excerpt: "Droit au silence, droit à un avocat, durée de la retenue : les règles à connaître avant d'être interrogé.",
    body: "En garde à vue, vous avez droit à un avocat, au silence, à un appel téléphonique et à être informé des faits (CPP 226-3). Votre avocat est contacté immédiatement : vous avez 15 minutes d'entretien confidentiel avec lui, et aucune audition ne peut commencer sans lui avant 30 minutes (CPP 226-4).\n\nLa garde à vue dure 24 heures, prolongeable jusqu'à 96 heures pour les infractions graves (CPP 226-2). Tout manquement à ces règles peut faire annuler la garde à vue et les actes qui en découlent (CPP 226-6). Demandez explicitement votre avocat et ne signez aucune déclaration sans l'avoir relue. Source : Code de procédure pénale de FratWorld, sur LégiFrat." },
  { slug: 'contester-une-amende', title: 'Contester une amende routière : délais et méthode', category: 'Droit routier',
    excerpt: "Une contravention n'est pas définitive tant que les délais de contestation ne sont pas expirés.",
    body: "Vous avez reçu une amende que vous estimez injustifiée ? Conservez le ticket, les captures et le nom de l'agent.\n\nDéposez une demande dans la catégorie « Droit administratif et routier » en joignant ces éléments. L'avocat attribué vous indiquera la procédure applicable sur le serveur." }
];

const OLD_GAV_BODY = "Toute personne interpellée par le LSPD ou le BCSO peut demander l'assistance d'un avocat avant son interrogatoire.\n\nDemandez explicitement votre avocat, ne signez aucune déclaration sans l'avoir relue et notez l'heure de votre interpellation. Notre permanence pénale peut être contactée depuis le site ou depuis notre serveur Discord.";

let done = false;
export async function ensureSeeded() {
  if (done) return;
  const r = await rtdb.txn('meta/seeded', v => (v ? undefined : new Date().toISOString()));
  if (r.committed) {
    // Une seule écriture groupée (rapide, sous le délai des fonctions Netlify)
    const t = new Date().toISOString();
    const patch = {};
    const rows = seedServiceRows();
    rows.forEach((s, i) => {
      const id = i + 1;
      patch[`tables/services/${id}`] = { id, domain: s.domain, group_name: s.group, name: s.name, description: s.description || null,
        price: s.price, price_unit: s.unit || null, sort_order: s.sort, active: true, created_at: t };
    });
    NEWS.forEach((n, i) => { patch[`tables/news/${i + 1}`] = { id: i + 1, ...n, published: true, created_at: t }; });
    patch['counters/services'] = rows.length;
    patch['counters/news'] = NEWS.length;
    await rtdb.patch('', patch);
  }
  await upgradeCatalog();
  done = true;
}

// Mise à jour v2 (4 novembre 2026) : références à la législation de FratWorld.
// Ne remplace jamais une description ou un prix saisis par le cabinet ; ajoute seulement ce qui manque.
async function upgradeCatalog() {
  const r = await rtdb.txn('meta/catalog_v', v => (Number(v) >= 2 ? undefined : 2));
  if (!r.committed) return;
  const services = await all('services');
  const key = x => `${x.domain}|${String(x.name).toLowerCase()}`;
  const byKey = new Map(services.map(x => [key(x), x]));
  const patch = {};
  let next = Math.max(Number(await rtdb.get('counters/services')) || 0, ...services.map(x => Number(x.id) || 0));
  const t = new Date().toISOString();
  for (const row of seedServiceRows()) {
    const cur = byKey.get(key(row));
    if (cur) { if (!cur.description && row.description) patch[`tables/services/${cur.id}/description`] = row.description; continue; }
    const id = ++next;
    patch[`tables/services/${id}`] = { id, domain: row.domain, group_name: row.group, name: row.name, description: row.description || null,
      price: row.price, price_unit: row.unit || null, sort_order: row.sort, active: true, created_at: t };
  }
  if (next) patch['counters/services'] = next;
  const news = await all('news');
  const gav = news.find(n => n.slug === 'garde-a-vue-vos-droits' && n.body === OLD_GAV_BODY);
  if (gav) patch[`tables/news/${gav.id}/body`] = NEWS[1].body;
  if (Object.keys(patch).length) await rtdb.patch('', patch);
}
