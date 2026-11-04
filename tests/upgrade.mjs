// Vérifie la mise à jour d'une base déjà en ligne (catalogue sans références légales).
process.env.FIREBASE_DATABASE_URL = 'http://localhost:9998'; process.env.FIREBASE_DATABASE_SECRET = 'test-firebase-secret';
const { rtdb, all } = await import('../server/store.mjs');
const { ensureSeeded } = await import('../server/seed.mjs');
await fetch('http://localhost:9998/__reset', { method: 'POST' });
await rtdb.patch('', {
  'meta/seeded': '2026-11-01', 'counters/services': 40,
  'tables/services/1': { id: 1, domain: 'penal', group_name: 'Défense et procédure pénale', name: 'Demande de libération sous caution', description: null, price: 14900, active: true },
  'tables/services/2': { id: 2, domain: 'penal', group_name: 'Défense et procédure pénale', name: 'Assistance en garde à vue', description: 'Texte du cabinet', price: 99, active: true },
  'tables/news/2': { id: 2, slug: 'garde-a-vue-vos-droits', title: 'x', body: "Toute personne interpellée par le LSPD ou le BCSO peut demander l'assistance d'un avocat avant son interrogatoire.\n\nDemandez explicitement votre avocat, ne signez aucune déclaration sans l'avoir relue et notez l'heure de votre interpellation. Notre permanence pénale peut être contactée depuis le site ou depuis notre serveur Discord.", published: true }
});
await ensureSeeded();
const s = await all('services'), n = await all('news');
const ok = (name, c) => { console.log((c ? 'OK ' : 'ÉCHEC ') + name); if (!c) process.exitCode = 1; };
ok('Description légale ajoutée là où elle manquait', s.find(x => x.id === 1).description.includes('CPP 405-5'));
ok('Description et prix du cabinet conservés', s.find(x => x.id === 2).description === 'Texte du cabinet' && s.find(x => x.id === 2).price === 99);
ok('Nouvelles prestations FratWorld ajoutées', s.some(x => x.name === 'Négociation d’une CRPC') && s.some(x => x.name === 'Réclamation préalable auprès de l’IRS'));
ok('Identifiants sans collision (au-delà du compteur)', Math.min(...s.filter(x => x.id > 2).map(x => x.id)) === 41);
ok('Article garde à vue mis à jour (non modifié par le cabinet)', n[0].body.includes('CPP 226-4'));
const before = s.length; await (await import('../server/seed.mjs')).ensureSeeded();
ok('Mise à jour exécutée une seule fois', (await rtdb.get('meta/catalog_v')) === 2 && (await all('services')).length === before);
