// Configuration éditoriale du site. Modifier ici, puis relancer « npm run build » (Netlify le fait à chaque déploiement).
export default {
  name: 'AVOCAT & CONSEIL',
  tagline: 'Votre défense, notre engagement.',
  notice: 'Cabinet d’avocats · Droit de l’État de FratWorld · Consultations sur rendez-vous',
  address: ['Portola Drive, Rockford Hills', 'Los Santos, San Andreas'],
  phone: '555-0142',               // numéro en jeu
  hours: 'Sur rendez-vous, du lundi au samedi',
  discordInvite: 'https://discord.gg/votre-invitation',
  // Photos : remplacer par vos captures en jeu (JPG/WEBP dans src/assets/img/), ou par des URLs https.
  photos: {
    hero: '/assets/img/hero-nuit.svg',      // grande image d'accueil (façade du cabinet de nuit)
    facade: '/assets/img/facade.svg',
    bureau: '/assets/img/bureau.svg',
    reunion: '/assets/img/reunion.svg',
    bibliotheque: '/assets/img/bibliotheque.svg',
    tribunal: '/assets/img/tribunal.svg'
  }
};
