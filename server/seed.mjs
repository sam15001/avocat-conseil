// Contenu de départ, inséré une seule fois dans une base Firebase vide :
// catalogue des prestations (module pénal + actes) et 3 actualités d'exemple.
import { rtdb } from './store.mjs';
import { seedServiceRows } from '../shared/domains.mjs';

const NEWS = [
  { slug: 'ouverture-cabinet-los-santos', title: 'Le cabinet ouvre ses bureaux à Rockford Hills', category: 'Le cabinet',
    excerpt: 'Après plusieurs mois de préparation, AVOCAT & CONSEIL accueille ses premiers clients dans ses nouveaux locaux.',
    body: "Le cabinet AVOCAT & CONSEIL ouvre officiellement ses portes à Rockford Hills. Nos avocats reçoivent sur rendez-vous, du lundi au samedi.\n\nLes demandes peuvent être déposées directement depuis votre espace client, après connexion avec votre compte Discord. Chaque demande reçoit un numéro de dossier et vous pouvez en suivre l'avancement en temps réel." },
  { slug: 'garde-a-vue-vos-droits', title: 'Garde à vue : ce que vous pouvez exiger', category: 'Droit pénal',
    excerpt: "Droit au silence, droit à un avocat, durée de la retenue : les règles à connaître avant d'être interrogé.",
    body: "Toute personne interpellée par le LSPD ou le BCSO peut demander l'assistance d'un avocat avant son interrogatoire.\n\nDemandez explicitement votre avocat, ne signez aucune déclaration sans l'avoir relue et notez l'heure de votre interpellation. Notre permanence pénale peut être contactée depuis le site ou depuis notre serveur Discord." },
  { slug: 'contester-une-amende', title: 'Contester une amende routière : délais et méthode', category: 'Droit routier',
    excerpt: "Une contravention n'est pas définitive tant que les délais de contestation ne sont pas expirés.",
    body: "Vous avez reçu une amende que vous estimez injustifiée ? Conservez le ticket, les captures et le nom de l'agent.\n\nDéposez une demande dans la catégorie « Droit administratif et routier » en joignant ces éléments. L'avocat attribué vous indiquera la procédure applicable sur le serveur." }
];

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
  done = true;
}
