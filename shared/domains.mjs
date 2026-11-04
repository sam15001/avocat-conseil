// Données partagées entre le serveur et le navigateur.

export const DOMAINS = [
  {
    slug: 'penal',
    tag: 'Défendez vos droits',
    name: 'Droit pénal',
    short: 'Interpellation, garde à vue, audience : nous vous défendons à chaque étape.',
    intro: "Une interpellation se joue dans les premières minutes. Nos pénalistes interviennent dès la garde à vue et vous accompagnent jusqu'au verdict, avec une stratégie construite sur le dossier réel, pas sur des promesses.",
    services: [
      ['Défense des personnes arrêtées', "Intervention rapide après une interpellation par le LSPD, le BCSO ou les forces fédérales."],
      ['Assistance lors des interrogatoires', "Présence de l'avocat pendant l'audition, contrôle de la procédure et des déclarations."],
      ['Défense devant le tribunal', "Préparation de l'audience, plaidoirie et gestion des témoins."],
      ['Contestation des accusations', "Analyse des preuves, des rapports de police et des vices de procédure."],
      ['Demande de réduction de peine', "Requêtes motivées auprès du juge, négociation avec le procureur."],
      ['Libération sous caution', "Demande de mise en liberté lorsque le règlement du serveur le prévoit."]
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
      ['Conflits de voisinage', "Nuisances, limites de propriété, dégradations."],
      ['Réclamations financières', "Recouvrement de sommes dues, mises en demeure."],
      ['Dommages et intérêts', "Évaluation du préjudice et demande de réparation."],
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
      ["Création d'entreprise", "Statuts, répartition des parts, dossier de licence auprès de la mairie."],
      ['Contrats commerciaux', "Fourniture, partenariat, exclusivité, prestations de service."],
      ['Litiges entre entreprises', "Impayés, concurrence déloyale, rupture de contrat."],
      ['Accompagnement des entrepreneurs', "Conseil juridique régulier pour les dirigeants."],
      ["Cession et reprise d'entreprise", "Audit, protocole de cession, transfert des actifs."]
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
      ['Litiges immobiliers', "Vices cachés, occupation sans droit, désaccords sur le prix."],
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
      ['Contestation de contraventions', "Amendes routières, stationnement, excès de vitesse."],
      ['Litiges avec les administrations', "Mairie, services de l'État, licences refusées."],
      ['Contestation de sanctions', "Sanctions administratives et décisions disciplinaires."],
      ['Permis de conduire', "Suspension, retrait de points, annulation."]
    ]
  },
  {
    slug: 'conseil',
    tag: 'Un soutien sur mesure',
    name: 'Conseil et accompagnement',
    short: 'Consultations, médiation et rédaction de vos documents officiels.',
    intro: "Avant de signer, de vous engager ou de répondre à une mise en demeure, prenez conseil. Une consultation coûte toujours moins cher qu'un procès.",
    services: [
      ['Consultations juridiques', "Réponse claire à une question précise, sur rendez-vous."],
      ['Conseils personnalisés', "Suivi régulier pour particuliers et organisations."],
      ['Médiation', "Un tiers neutre pour renouer le dialogue entre les parties."],
      ['Négociation entre parties', "Mandat de négociation, accord transactionnel."],
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
// ── Modules documentaires (rédaction d'actes), tarifs par mois d'abonnement.
// Valeurs initiales : ensuite tout se gère dans Administration → Prestations.
const M = '/ mois';
export const DOC_MODULES = [
  { domain: 'affaires', group: 'Service B2B documentaire · Accès', items: [
    ['Accès au service de rédaction — formule mensuelle', 99900, M, 'Obligatoire pour souscrire aux modules documentaires. Salon privé Discord avec le secrétariat du cabinet, signature par votre avocat référent.'],
    ['Accès au service de rédaction — formule trimestrielle', 279900, '/ trimestre', 'Même service, réglé par trimestre.']] },
  { domain: 'affaires', group: 'Modules documentaires · Activité commerciale', items: [
    ['Contrat de sous-traitance', 19900], ['Déclaration de nom commercial fictif (DBA)', 14900], ['Conditions Générales de Vente (CGV)', 19900],
    ['Contrat de vente de marchandises', 17900], ['Contrat de location commerciale de biens mobiliers', 16900], ['Accord de sûreté et déclaration UCC-1', 22900],
    ['Notification de vente en bloc aux créanciers', 19900], ['Mise en demeure de paiement (B2B)', 9900], ['Accord de confidentialité (NDA)', 14900],
    ['Lettre d\'intention (LOI / Term Sheet)', 19900], ['Reconnaissance de dette', 9900], ['Protocole transactionnel', 24900],
    ['Bail commercial immobilier', 29900], ['Contrat commercial B2B', 59900], ['Avenant à contrat commercial', 24900]] },
  { domain: 'affaires', group: 'Modules documentaires · Vie sociale et corporative', items: [
    ['Statuts de Corporation (Articles of Incorporation)', 39900], ['Articles d\'organisation LLC', 34900], ['Accord d\'exploitation LLC', 29900],
    ['Règlement intérieur de Corporation (Bylaws)', 24900], ['Procès-verbal d\'assemblée générale', 9900], ['Procès-verbal de conseil d\'administration', 7900],
    ['Convocation d\'assemblée générale', 5900], ['Registre des actionnaires', 7900], ['Certificat de dissolution de société', 24900],
    ['Pacte d\'actionnaires', 39900], ['Cession de parts sociales / actions', 24900]] },
  { domain: 'affaires', group: 'Modules documentaires · Contrats de travail', items: [
    ['Contrat à Durée Indéterminée (CDI)', 14900], ['Contrat à Durée Déterminée (CDD)', 12900], ['Contrat de Travail Temporaire (CTT)', 12900],
    ['Contrat d\'alternance', 11900], ['Convention de stage', 9900]] },
  { domain: 'affaires', group: 'Modules documentaires · Documents RH', items: [
    ['Avenant au contrat de travail', 7900], ['Lettre d\'avertissement', 4900], ['Mise à pied disciplinaire', 6900], ['Certificat de travail', 3900],
    ['Attestation employeur', 3900], ['Reçu pour solde de tout compte', 4900], ['Règlement intérieur d\'entreprise', 39900],
    ['Lettre de promotion / changement de poste', 6900], ['Mise en demeure salarié (absence injustifiée)', 7900],
    ['Programme de Prévention des Risques (IIPP)', 24900], ['Déclaration d\'accident du travail (DRI-SA)', 8900],
    ['Convention collective d\'entreprise', 34900], ['Promesse d\'embauche', 7900]] },
  { domain: 'affaires', group: 'Modules documentaires · Rupture du contrat', items: [
    ['Lettre de licenciement économique', 19900], ['Lettre de licenciement pour faute', 22900], ['Rupture conventionnelle', 17900],
    ['Acceptation de démission', 4900], ['Notification WARN de licenciement collectif', 29900], ['Convocation à entretien préalable de licenciement', 14900]] },
  { domain: 'immobilier', group: 'Rédaction d\'actes · Actes immobiliers', items: [['Bail commercial immobilier', 29900]] },
  { domain: 'civil', group: 'Rédaction d\'actes · Actes entre particuliers', items: [['Reconnaissance de dette', 9900], ['Protocole transactionnel', 24900]] },
  // Grille tarifaire du cabinet (montants indicatifs, devis ferme à l'ouverture du dossier)
  { domain: 'conseil', group: 'Contrats de représentation continue · Particulier', items: [
    ['Représentation continue particulier — hebdomadaire', 49900, '/ semaine', 'Représentation juridique continue, tout inclus (supplément possible pour les très grosses affaires).'],
    ['Représentation continue particulier — mensuelle', 149900, M, 'Représentation juridique continue, tout inclus (supplément possible pour les très grosses affaires).'],
    ['Représentation continue particulier — trimestrielle', 399900, '/ trimestre', 'Représentation juridique continue, tout inclus (supplément possible pour les très grosses affaires).']] },
  { domain: 'conseil', group: 'Contrats de représentation continue · Entreprise', items: [
    ['Représentation continue entreprise — hebdomadaire', 124750, '/ semaine', 'Représentation juridique continue, tout inclus (supplément possible pour les très grosses affaires).'],
    ['Représentation continue entreprise — mensuelle', 374750, M, 'Représentation juridique continue, tout inclus (supplément possible pour les très grosses affaires).'],
    ['Représentation continue entreprise — trimestrielle', 999750, '/ trimestre', 'Représentation juridique continue, tout inclus (supplément possible pour les très grosses affaires).']] },
  { domain: 'conseil', group: 'Conseil juridique', items: [
    ['Analyse de contrat', 14900, '', 'Étude approfondie d’un contrat fourni.'], ['Rédaction d’acte sur mesure', 19900, '', 'Rédaction sur mesure d’un acte ou d’un contrat.']] },
  { domain: 'conseil', group: 'Représentation au tribunal', items: [
    ['Audience pénale', 69900, '/ audience', 'Représentation à une audience pénale.'], ['Audience civile', 49900, '/ audience', 'Représentation à une audience civile.'],
    ['Procédure complète', 99900, '', 'Suivi intégral d’une procédure, de l’instruction au jugement.']] },
  { domain: 'conseil', group: 'Suivi sur dossier', items: [
    ['Heure d’avocat junior', 9900, '/ heure', 'Travail d’un avocat junior, taux horaire.'], ['Heure d’avocat senior', 14900, '/ heure', 'Travail d’un avocat senior, taux horaire.'],
    ['Heure d’avocat associé', 19900, '/ heure', 'Travail d’un avocat associé, taux horaire.']] }
];
// Conditions du service documentaire (affichées sur la page Droit des affaires et dans les honoraires)
export const DOC_TERMS = [
  ['Tarification des modules', 'Mensuelle ou trimestrielle (trimestriel = 3 × mensuel, sans remise).'],
  ['Accès obligatoire', 'L’accès au service de rédaction est obligatoire et ne donne pas accès aux documents : chaque type de document est souscrit séparément.'],
  ['Rédaction illimitée', 'Sur la durée de l’abonnement actif.'],
  ['Corrections', 'Possibles dans les 15 minutes suivant la livraison de chaque document.'],
  ['Confidentialité absolue', 'Un salon privé dédié à votre entreprise, accessible uniquement à vos collaborateurs habilités et à votre avocat référent.'],
  ['Signature', 'Chaque document est signé électroniquement par votre avocat référent et par vous-même (et, en option, par le salarié concerné). Reconductible mensuellement ou trimestriellement.']
];


// ── Module pénal (tarifs du cabinet). Valeurs initiales : ensuite tout se gère dans Administration → Prestations.
export const PENAL_MODULE = [
  { group: 'Défense et procédure pénale', items: [
    ['Consultation juridique pénale', 4900], ['Analyse et étude de dossier pénal', 9900], ["Assistance lors d'une interpellation", 7900],
    ["Assistance lors d'un interrogatoire", 9900], ['Assistance en garde à vue', 12900], ['Demande de remise en liberté', 14900],
    ['Demande de libération sous caution', 14900], ["Contestation d'une arrestation", 12900], ["Contestation d'une mise en accusation", 14900],
    ["Constitution d'un dossier de défense", 19900]] },
  { group: 'Représentation et défense', items: [
    ['Représentation devant le tribunal', 24900], ['Plaidoirie de défense pénale', 19900], ['Défense pour infraction routière', 9900],
    ['Défense pour délit mineur', 14900], ['Défense pour délit majeur', 24900], ['Défense pour crime grave', 39900],
    ["Défense dans une affaire de trafic", 29900], ['Défense dans une affaire de violences', 24900]] },
  { group: 'Recours et contestations', items: [
    ["Demande d'annulation de procédure", 19900], ["Contestation d'une preuve", 14900], ["Contestation d'une saisie judiciaire", 12900],
    ['Demande de réduction de peine', 14900], ['Demande de révision de peine', 17900], ['Demande de grâce présidentielle', 29900],
    ['Demande de réexamen judiciaire', 19900]] },
  { group: 'Documents et actes judiciaires', items: [
    ['Lettre de mise en demeure judiciaire', 7900], ['Dépôt de plainte', 5900], ['Constitution de partie civile', 12900],
    ['Demande de classement sans suite', 14900], ['Recours contre une décision judiciaire', 19900]] }
];

// Lignes initiales de la table « services » (générées dans db/schema.sql par scripts/seed-services.mjs)
export function seedServiceRows() {
  const rows = [];
  let order = 0;
  for (const g of PENAL_MODULE) for (const [name, price] of g.items) rows.push({ domain: 'penal', group: g.group, name, description: '', price, unit: '/ mois', sort: order++ });
  for (const d of DOMAINS) {
    if (d.slug === 'penal') continue;
    for (const [name, description] of d.services) rows.push({ domain: d.slug, group: 'Accompagnement', name, description, price: null, unit: '', sort: order++ });
  }
  for (const g of DOC_MODULES) for (const [name, price, unit = M, description = ''] of g.items) rows.push({ domain: g.domain, group: g.group, name, description, price, unit, sort: order++ });
  return rows;
}

// Prestation libre quand rien ne correspond
export const OTHER_SERVICE = 'Autre demande';

export const PRICE_UNITS = ['', '/ mois', '/ trimestre', '/ semaine', '/ heure', '/ audience', '/ acte'];

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
