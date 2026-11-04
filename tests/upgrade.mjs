// Vérifie le retrait des références légales sur une base déjà en ligne (mise à jour v3).
process.env.FIREBASE_DATABASE_URL = 'http://localhost:9998'; process.env.FIREBASE_DATABASE_SECRET = 'test-firebase-secret';
const { rtdb, all } = await import('../server/store.mjs');
const { ensureSeeded } = await import('../server/seed.mjs');
const { REVERT, ADDED } = await import('../server/revert-legal.mjs');
await fetch('http://localhost:9998/__reset', { method: 'POST' });
const [d1, n1, legal1] = REVERT.find(r => r[1] === 'Demande de libération sous caution');
const [d2, n2, legal2] = ADDED[0], [d3, n3, legal3] = ADDED[1];
await rtdb.patch('', {
  'meta/seeded': '2026-11-01', 'meta/catalog_v': 2,
  'tables/services/1': { id: 1, domain: d1, name: n1, description: legal1, price: 14900, active: true },
  'tables/services/2': { id: 2, domain: 'penal', name: 'Assistance en garde à vue', description: 'Texte du cabinet', price: 99, active: true },
  'tables/services/3': { id: 3, domain: d2, name: n2, description: legal2, price: null, active: true },
  'tables/services/4': { id: 4, domain: d3, name: n3, description: legal3, price: 5000, active: true },
  'tables/services/5': { id: 5, domain: 'affaires', group_name: "Rédaction d'actes · Création et vie des sociétés", name: 'Pacte d\'actionnaires', price: 0, active: true },
  'tables/services/6': { id: 6, domain: 'affaires', group_name: "Rédaction d'actes · Droit du travail (employeurs)", name: 'Promesse d\'embauche', price: 1234, price_unit: '/ acte', active: true },
  'counters/services': 6
});
await ensureSeeded();
const s = await all('services');
const ok = (name, c) => { console.log((c ? 'OK ' : 'ÉCHEC ') + name); if (!c) process.exitCode = 1; };
ok('Référence légale retirée de la description', !s.find(x => x.id === 1).description);
ok('Description personnalisée conservée', s.find(x => x.id === 2).description === 'Texte du cabinet');
ok('Prestation ajoutée non retouchée : supprimée', !s.find(x => x.id === 3));
ok('Prestation ajoutée avec un prix fixé par le cabinet : conservée', !!s.find(x => x.id === 4));
const p5 = s.find(x => x.id === 5), p6 = s.find(x => x.id === 6);
ok('v4 : module « Offert » passé au tarif (39 900 / mois) et au nouveau groupe', p5.price === 39900 && p5.price_unit === '/ mois' && p5.group_name.includes('Vie sociale'));
ok('v4 : prix fixé par le cabinet conservé', p6.price === 1234 && p6.price_unit === '/ acte');
ok('v4 : nouveaux modules ajoutés (CDI, CGV, accès B2B, grille)', ['Contrat à Durée Indéterminée (CDI)', 'Conditions Générales de Vente (CGV)', 'Accès au service de rédaction — formule trimestrielle', 'Heure d’avocat associé'].every(n => s.some(x => x.name === n)));
ok('v4 : accès trimestriel facturé au trimestre', s.find(x => x.name === 'Accès au service de rédaction — formule trimestrielle').price_unit === '/ trimestre');
ok('Identifiants nouveaux au-delà du compteur', Math.min(...s.filter(x => x.id > 6).map(x => x.id)) === 7);
const total = s.length; await ensureSeeded();
ok('Exécutée une seule fois', (await rtdb.get('meta/catalog_v')) === 4 && (await all('services')).length === total);
