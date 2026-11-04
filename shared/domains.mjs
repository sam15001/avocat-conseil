// Données partagées entre le serveur et le navigateur.

export const DOMAINS = [
  {
    slug: 'penal',
    tag: 'Défendez vos droits',
    name: 'Droit pénal',
    short: 'Interpellation, garde à vue, audience : nous vous défendons à chaque étape.',
    intro: "Une interpellation se joue dans les premières minutes. Nos pénalistes interviennent dès la garde à vue et vous accompagnent jusqu'au verdict, avec une stratégie construite sur le dossier réel, pas sur des promesses.",
    services: [
      ['Défense des personnes arrêtées', "Intervention rapide après une interpellation par le FRPD, le BCSO ou les US Marshals ; contrôle de l'Habeas Corpus (CP 110-1)."],
      ['Assistance lors des interrogatoires', "Aucune audition sans avocat avant 30 minutes de carence, entretien confidentiel de 15 minutes (CPP 226-4)."],
      ['Défense devant le tribunal', "Préparation de l'audience, plaidoirie, appel sous 10 jours et Cour Suprême sous 1 mois (CPP 625-1, 635-1)."],
      ['Contestation des accusations', "Nullités de garde à vue, de fouille et de perquisition (CPP 226-6, 232-4, 227-1) ; images de caméra piéton (décret 2026-022)."],
      ['Demande de réduction de peine', "Négociation d'une CRPC : peine réduite d'au moins moitié pour un délit (CPP 315-3)."],
      ['Libération sous caution', "Obligatoire pour un délit, interdite pour un crime ; l'État conserve 25 % à la restitution (CPP 405-5)."]
    ]
  },
  {
    slug: 'civil',
    tag: 'Résolvez vos litiges',
    name: 'Droit civil',
    short: 'Litiges entre citoyens, voisinage, dettes et réparation des préjudices.',
    intro: "La plupart des conflits entre citoyens se règlent mieux par la négociation que par le tribunal. Nous cherchons d'abord l'accord, et nous plaidons quand il le faut.",
    services: [
      ['Litiges entre citoyens', "Différends personnels, engagements non tenus, promesses de vente."],
      ['Conflits de voisinage', "Empiètements (CP 430-2), dégradations avec réparation intégrale (CP 420-1)."],
      ['Réclamations financières', "Recouvrement de sommes dues, mises en demeure."],
      ['Dommages et intérêts', "Faute, préjudice et lien de causalité (CPP 325-3) ; jury garanti au civil au-delà de 20 $ (BOR-VII)."],
      ['Résolution des conflits', "Médiation et protocole d'accord signé par les parties."]
    ]
  },
  {
    slug: 'affaires',
    tag: 'Sécurisez vos projets',
    name: 'Droit des affaires',
    short: 'Créer, protéger et transmettre votre entreprise à Los Santos.',
    intro: "Les entreprises de Los Santos vivent de contrats. Nous les rédigeons pour qu'ils tiennent le jour où un associé, un fournisseur ou un client conteste.",
    services: [
      ["Création d'entreprise", "Statuts, direction inscrite au Barreau pour un cabinet (Déonto III-1), demande de licence auprès du Secrétaire au Commerce (décret 2026-006)."],
      ['Contrats commerciaux', "Fourniture, partenariat, exclusivité, prestations de service."],
      ['Litiges entre entreprises', "Impayés, concurrence déloyale, rupture de contrat."],
      ['Accompagnement des entrepreneurs', "Conformité fiscale hebdomadaire (CGI 110-4, 220-5), tenue de travail obligatoire (décret 2026-011), registre conservé 8 semaines (CGI 220-3)."],
      ["Cession et reprise d'entreprise", "Audit, protocole de cession, transfert des actifs."],
      ['Contentieux fiscal (IRS)', "Vérification sur place (CGI 510-2), redressement (CGI 510-3), réclamation sous 7 jours puis recours sous 10 jours (CGI 530-1, 530-2)."]
    ]
  },
  {
    slug: 'immobilier',
    tag: 'Protégez vos biens',
    name: 'Droit immobilier',
    short: 'Achat, vente, location et litiges sur les biens.',
    intro: "Une propriété représente souvent l'investissement d'une vie RP. Nous sécurisons chaque transaction et défendons vos droits en cas de litige.",
    services: [
      ['Achat et vente de propriétés', "Compromis, vérification du titre, acte de vente."],
      ['Litiges immobiliers', "Vices cachés, intrusion et occupation sans droit (CP 420-4), désaccords sur le prix."],
      ['Contrats de location', "Baux d'habitation et commerciaux, état des lieux."],
      ['Conseil aux propriétaires', "Gestion locative, impayés, expulsion."]
    ]
  },
  {
    slug: 'administratif-routier',
    tag: 'Contestez vos sanctions',
    name: 'Droit administratif et routier',
    short: 'Amendes, permis, sanctions et litiges avec les administrations.',
    intro: "Une décision administrative se conteste dans des délais courts. Nous vérifions la procédure, rassemblons les preuves et portons la contestation devant l'autorité compétente.",
    services: [
      ['Contestation de contraventions', "Amendes prononcées par le procureur ou le juge (CP 380-1 à 380-7). L'amende nominale appliquée sur place est définitive (CP 110-5)."],
      ['Litiges avec les administrations', "IRS, Secrétaire au Commerce, licences refusées ; réclamation préalable sous 7 jours (CGI 530-1)."],
      ['Contestation de sanctions', "Sanctions administratives et décisions disciplinaires."],
      ['Permis de conduire', "Conduite sans permis (CP 380-1), suspension, retrait."],
      ['Déclaration de manifestation', "Déclaration au Département de la Défense et accord écrit préalable (décret 2026-023, CP 320-6)."]
    ]
  },
  {
    slug: 'conseil',
    tag: 'Un soutien sur mesure',
    name: 'Conseil et accompagnement',
    short: 'Consultations, médiation et rédaction de vos documents officiels.',
    intro: "Avant de signer, de vous engager ou de répondre à une mise en demeure, prenez conseil. Une consultation coûte toujours moins cher qu'un procès.",
    services: [
      ['Consultations juridiques', "Réponse claire à une question précise, couverte par le secret professionnel absolu (Déonto I-3)."],
      ['Conseils personnalisés', "Suivi régulier pour particuliers et organisations."],
      ['Médiation', "Un tiers neutre pour renouer le dialogue entre les parties."],
      ['Négociation entre parties', "Mandat de négociation ; toute offre de règlement vous est transmise immédiatement (Déonto II-4)."],
      ['Rédaction de documents officiels', "Attestations, contrats, procurations, courriers formels."]
    ]
  }
];

export const DOMAIN_BY_SLUG = Object.fromEntries(DOMAINS.map(d => [d.slug, d]));

export const STATUSES = [
  { key: 'recue',        label: 'Demande reçue',          step: 1 },
  { key: 'attente',      label: 'En attente de traitement', step: 1 },
  { key: 'attribue',     label: 'Avocat attribué',        step: 2 },
  { key: 'rdv',          label: 'Rendez-vous programmé',  step: 3 },
  { key: 'en_cours',     label: 'En cours de traitement', step: 3 },
  { key: 'attente_docs', label: 'En attente de documents', step: 3 },
  { key: 'cloture',      label: 'Dossier clôturé',        step: 4 },
  { key: 'refuse',       label: 'Demande refusée',        step: 4 }
];

export const STATUS_BY_KEY = Object.fromEntries(STATUSES.map(s => [s.key, s]));
export const CLOSED_STATUSES = ['cloture', 'refuse'];

export const ROLES = ['Citoyen', 'Avocat', 'Responsable juridique', 'Direction'];
export const ROLE = { CITOYEN: 0, AVOCAT: 1, RESPONSABLE: 2, DIRECTION: 3 };

export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ── Actes juridiques rédigés par le cabinet, regroupés par secteur.
// Ajoutez ou retirez des actes ici : pages domaines, prise de rendez-vous et demandes se mettent à jour.
export const CATALOG = {
  affaires: [
    { group: 'Création et vie des sociétés', items: [
      'Statuts de Corporation (Articles of Incorporation)', 'Articles d\'organisation LLC', 'Accord d\'exploitation LLC',
      'Règlement intérieur de Corporation (Bylaws)', 'Déclaration de nom commercial fictif (DBA)', 'Convocation d\'assemblée générale',
      'Procès-verbal d\'assemblée générale', 'Procès-verbal de conseil d\'administration', 'Registre des actionnaires',
      'Pacte d\'actionnaires', 'Cession de parts sociales / actions', 'Certificat de dissolution de société'] },
    { group: 'Contrats et opérations commerciales', items: [
      'Contrat commercial B2B', 'Avenant à contrat commercial', 'Lettre d\'intention (LOI / Term Sheet)',
      'Contrat de location commerciale de biens mobiliers', 'Accord de sûreté et déclaration UCC-1', 'Notification de vente en bloc aux créanciers'] },
    { group: 'Droit du travail (employeurs)', items: [
      'Promesse d\'embauche', 'Contrat d\'alternance', 'Convention de stage', 'Lettre d\'avertissement', 'Mise à pied disciplinaire',
      'Mise en demeure salarié (absence injustifiée)', 'Convocation à entretien préalable de licenciement',
      'Déclaration d\'accident du travail (DRI-SA)', 'Convention collective d\'entreprise', 'Notification WARN de licenciement collectif'] }
  ],
  immobilier: [
    { group: 'Actes immobiliers', items: ['Bail commercial immobilier'] }
  ],
  civil: [
    { group: 'Actes entre particuliers', items: ['Reconnaissance de dette', 'Protocole transactionnel'] }
  ]
};

// ── Module pénal (tarifs du cabinet). Valeurs initiales : ensuite tout se gère dans Administration → Prestations.
export const PENAL_MODULE = [
  { group: 'Défense et procédure pénale', items: [
    ['Consultation juridique pénale', 4900, 'Analyse de votre situation au regard du Code pénal et du Code de procédure pénale de FratWorld.'],
    ['Analyse et étude de dossier pénal', 9900, 'Qualification des faits (CP 110-2), peines encourues, risque de récidive (CP 110-3).'],
    ["Assistance lors d'une interpellation", 7900, 'Droits Miranda (CPP 226-3), palpation et fouille (CPP 232-4), arrestation motivée et notifiée (CP 110-1).'],
    ["Assistance lors d'un interrogatoire", 9900, 'Audition libre : droit de partir, de se taire et d’être assisté (CPP 225-3).'],
    ['Assistance en garde à vue', 12900, 'Entretien confidentiel de 15 min, aucune audition avant 30 min de carence (CPP 226-4) ; durée de 24 h à 96 h (CPP 226-2).'],
    ['Demande de remise en liberté', 14900, 'Contestation de la détention devant un juge (CP 110-1) ; détention provisoire réservée aux peines de 10 ans ou plus (CPP 405-4).'],
    ['Demande de libération sous caution', 14900, 'Possible pour un délit, interdite pour un crime ; 25 % conservés par l’État (CPP 405-5).'],
    ["Contestation d'une arrestation", 12900, 'Habeas Corpus (CP 110-1) ; nullité de la garde à vue et des actes qui en découlent (CPP 226-6).'],
    ["Contestation d'une mise en accusation", 14900, 'Présomption d’innocence et preuve loyale (CPP 105-1, 105-4).'],
    ["Constitution d'un dossier de défense", 19900, 'Pièces, témoins et images de caméra piéton, auxquelles vous avez droit (décret 2026-022).']] },
  { group: 'Représentation et défense', items: [
    ['Représentation devant le tribunal', 24900, 'Juridiction de district (CPP 615-1) ; procès équitable et public (BOR-VI, CPP 105-3).'],
    ['Plaidoirie de défense pénale', 19900, 'Légitime défense, irresponsabilité, circonstances atténuantes (CP 120-2 à 120-7).'],
    ['Défense pour infraction routière', 9900, 'Refus d’obtempérer (CP 310-1), conduite sans permis ou dangereuse (CP 380-1, 380-2).'],
    ['Défense pour délit mineur', 14900, 'Délit : jusqu’à 10 ans (CP 110-2) ; alternatives aux poursuites (CPP 315-4).'],
    ['Défense pour délit majeur', 24900, 'CRPC possible, peine réduite d’au moins moitié (CPP 315-3).'],
    ['Défense pour crime grave', 39900, 'Crime : 10 ans et plus (CP 110-2) ; ni amende nominale (CP 110-5) ni caution (CPP 405-5).'],
    ["Défense dans une affaire de trafic", 29900, 'Stupéfiants (CP 370-1, 370-2), vente d’armes sans licence (CP 360-1).'],
    ['Défense dans une affaire de violences', 24900, 'Agression (CP 220-4), menaces (CP 230-3), Stand Your Ground et légitime défense (CP 120-6, 120-7).'],
    ['Défense en cas d’association criminelle', null, 'Jusqu’à 25 ans, sans visites ni appel téléphonique (CP 350-2) ; dossier pouvant être repris par le Procureur Général (CPP 315-9).']] },
  { group: 'Recours et contestations', items: [
    ["Demande d'annulation de procédure", 19900, 'Nullités : garde à vue (CPP 226-6), fouille (CPP 232-4), perquisition (CPP 227-1, 227-2).'],
    ["Contestation d'une preuve", 14900, 'Preuve libre mais loyale (CPP 105-4).'],
    ["Contestation d'une saisie judiciaire", 12900, 'Saisie limitée à l’objet de l’enquête (CPP 227-3).'],
    ['Demande de réduction de peine', 14900, 'Tentative, discernement altéré, loi plus douce rétroactive (CP 120-2 à 120-4).'],
    ['Demande de révision de peine', 17900, 'Appel sous 10 jours, exécution suspendue (CPP 625-1).'],
    ['Demande de grâce présidentielle', 29900, ''],
    ['Demande de réexamen judiciaire', 19900, 'Saisine de la Cour Suprême sous 1 mois après l’appel (CPP 635-1).'],
    ['Négociation d’une CRPC', null, 'Comparution sur reconnaissance préalable de culpabilité pour un délit : peine réduite d’au moins moitié (CPP 315-3).'],
    ['Demande des images de caméra piéton', null, 'Toute personne interpellée peut obtenir les enregistrements, conservés jusqu’à la clôture (décret 2026-022).']] },
  { group: 'Documents et actes judiciaires', items: [
    ['Lettre de mise en demeure judiciaire', 7900, 'Annoncer une action en justice n’est pas une menace (CP 230-3).'],
    ['Dépôt de plainte', 5900, 'Plainte ou jonction à l’action publique (CPP 325-3).'],
    ["Constitution de partie civile", 12900, 'Victime directe ou par ricochet, personne physique ou morale (CPP 325-1, 325-2).'],
    ['Demande de classement sans suite', 14900, 'Opportunité des poursuites (CPP 315-2) ; classement sans recours (CPP 315-5).'],
    ['Recours contre une décision judiciaire', 19900, 'Cour d’appel sous 10 jours, puis Cour Suprême sous 1 mois (CPP 625-1, 635-1).']] }
];

// Actes et prestations propres au droit de FratWorld (prix fixés ensuite dans Administration → Prestations)
export const FRATWORLD_SERVICES = [
  { domain: 'affaires', group: 'Fiscalité et conformité (IRS)', items: [
    ['Accompagnement de la déclaration hebdomadaire d’IS', 'Dépôt le dimanche de 12 h à 23 h 59, paiement au plus tard le lundi 23 h 59, déclaration néant obligatoire (CGI 110-4, 220-5).'],
    ['Réclamation préalable auprès de l’IRS', 'À déposer sous 7 jours ; le silence de l’IRS pendant 7 jours vaut rejet (CGI 530-1).'],
    ['Recours fiscal devant la juridiction de district', 'Sous 10 jours ; la preuve est à la charge de l’IRS (CGI 530-2).'],
    ['Assistance lors d’une vérification fiscale', 'Locaux professionnels seulement ; chez un avocat, en présence du procureur et du président du Barreau (CGI 510-2, CPP 227-2).'],
    ['Habilitation de collaborateurs fiscaux', 'Le dirigeant enregistré reste personnellement responsable de leurs actes (CGI 110-3).'],
    ['Négociation d’une CJIP (personne morale)', 'Amende réduite de moitié au plus et mise en conformité (CPP 315-4).']] },
  { domain: 'affaires', group: 'Licences et obligations', items: [
    ['Demande de licence (alcool, tabac, jeux)', 'Licence officielle exigée, amende par jour d’exercice sans licence (CP 430-3 à 430-5) ; demandes instruites par le Secrétaire au Commerce (décret 2026-006).'],
    ['Demande de dispense de tenue de travail', 'Dispense sur demande motivée (décret 2026-011, art. 6).']] },
  { domain: 'administratif-routier', group: 'Démarches administratives', items: [
    ['Déclaration de manifestation ou d’événement', 'Déclaration au Département de la Défense et accord écrit préalable, retrait possible à tout moment (décret 2026-023, CP 320-6).']] }
];

// Lignes initiales de la table « services » (générées dans db/schema.sql par scripts/seed-services.mjs)
export function seedServiceRows() {
  const rows = [];
  let order = 0;
  for (const g of PENAL_MODULE) for (const [name, price, description] of g.items) rows.push({ domain: 'penal', group: g.group, name, description: description || '', price, unit: price === null ? '' : '/ mois', sort: order++ });
  for (const d of DOMAINS) {
    if (d.slug === 'penal') continue;
    for (const [name, description] of d.services) rows.push({ domain: d.slug, group: 'Accompagnement', name, description, price: null, unit: '', sort: order++ });
    for (const g of CATALOG[d.slug] || []) for (const name of g.items) rows.push({ domain: d.slug, group: `Rédaction d'actes · ${g.group}`, name, description: '', price: 0, unit: '', sort: order++ });
    for (const g of FRATWORLD_SERVICES.filter(x => x.domain === d.slug)) for (const [name, description] of g.items) rows.push({ domain: d.slug, group: g.group, name, description, price: null, unit: '', sort: order++ });
  }
  return rows;
}

// Prestation libre quand rien ne correspond
export const OTHER_SERVICE = 'Autre demande';

export const PRICE_UNITS = ['', '/ mois', '/ heure', '/ audience', '/ acte'];

// $4 900 / mois · Offert · Sur devis
export function fmtPrice(price, unit = '') {
  if (price === null || price === undefined) return 'Sur devis';
  if (Number(price) === 0) return 'Offert';
  return '$' + Number(price).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, '\u00a0') + (unit ? ' ' + unit : '');
}

// Photos du site remplaçables depuis Administration → Photos du site
export const SITE_PHOTOS = [
  { key: 'hero', label: 'Accueil : grande photo', where: 'Fond de la page d’accueil', ratio: '16/9' },
  { key: 'facade', label: 'Façade du cabinet', where: 'Page Le cabinet, domaine Immobilier', ratio: '16/9' },
  { key: 'bureau', label: 'Bureaux', where: 'Domaine Droit des affaires', ratio: '16/9' },
  { key: 'reunion', label: 'Salle de réunion', where: 'Page Le cabinet, domaine Droit civil', ratio: '3/2' },
  { key: 'bibliotheque', label: 'Bibliothèque', where: 'Accueil, Le cabinet, Recrutement, Conseil', ratio: '4/5' },
  { key: 'tribunal', label: 'Palais de justice', where: 'Expertises, Le cabinet, Pénal, Routier', ratio: '3/2' }
];
