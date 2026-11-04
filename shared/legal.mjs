// Cadre légal de FratWorld rattaché aux domaines du cabinet.
// Résumés repris de l'« Inventaire de la législation de FratWorld » (LégiFrat, 4 novembre 2026).
// Seul le texte officiel publié sur LégiFrat fait foi : chaque entrée renvoie vers lui.
export const LAW_SOURCE = { label: 'LégiFrat — législation officielle de FratWorld', url: 'https://legifrat.fr/', date: '2026-11-04' };
export const LAW = {
 "penal": [
  {
   "ref": "BOR-V",
   "title": "Garanties judiciaires",
   "summary": "Pas de double poursuite ; droit de ne pas s'auto-incriminer ; procédure régulière ; indemnisation en cas d'expropriation.",
   "url": "https://legifrat.fr/textes/bill-of-rights"
  },
  {
   "ref": "BOR-VI",
   "title": "Procès équitable",
   "summary": "Procès rapide et public, jury impartial, information sur l'accusation, confrontation des témoins, avocat. Exception : en cas de condamnation pour association criminelle (CP 350-2), le juge peut désigner et condamner d'autres membres absents, sans ces garanties.",
   "url": "https://legifrat.fr/textes/bill-of-rights"
  },
  {
   "ref": "CP 110-1",
   "title": "Habeas Corpus",
   "summary": "Pas d'incarcération sans décision judiciaire ; arrestation motivée et notifiée ; contestation devant un juge. Punit l'agent auteur d'une détention arbitraire.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "500 000 $"
  },
  {
   "ref": "CP 110-2",
   "title": "Qualification",
   "summary": "Contravention (amende seule), délit (jusqu'à 10 ans), crime (10 ans et plus).",
   "url": "https://legifrat.fr/textes/code-penal"
  },
  {
   "ref": "CP 110-5",
   "title": "Amende nominale",
   "summary": "30 % de l'amende maximale, arrondie au millier ; appliquée par les forces de l'ordre sans Procureur, avec la durée max de détention pour un délit. Exclue pour les crimes. Définitive.",
   "url": "https://legifrat.fr/textes/code-penal"
  },
  {
   "ref": "CPP 226-2",
   "title": "Durée de la GAV",
   "summary": "24 h ; +24 h (chef d'unité) ; +24 h (procureur, infractions graves) ; jusqu'à 96 h (procureur). Point de départ : l'interpellation ou le début du contrôle d'identité. Dépassement OOC toléré.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 226-4",
   "title": "Assistance d'un avocat",
   "summary": "Avocat contacté immédiatement ; entretien confidentiel de 15 min ; aucune audition sans lui avant 30 min de carence.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 226-6",
   "title": "Nullité",
   "summary": "Tout manquement aux articles 226-1 à 226-5 peut annuler la GAV et les actes qui en découlent.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 232-4",
   "title": "Palpation et fouille",
   "summary": "Palpation seule avant transport ; fouille au poste après notification des droits, sauf danger immédiat motivé ; sinon nullité.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 315-3",
   "title": "Modes de poursuite",
   "summary": "Citation directe ; comparution immédiate (accord du mis en cause) ; CRPC pour les délits de 10 ans max, peine réduite d'au moins moitié, avocat obligatoire pour un mineur.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 405-5",
   "title": "Caution",
   "summary": "Obligatoire en matière délictuelle, interdite pour un crime ; l'État garde 25 % à la restitution.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 625-1, 625-2",
   "title": "Cour d'appel",
   "summary": "Appel sous 10 jours, exécution suspendue ; formation collégiale ; saisine pour avis.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 635-1, 635-2",
   "title": "Cour Suprême",
   "summary": "Saisine sous 1 mois après l'appel, peine exécutée entre-temps ; juges à vie, pouvoir disciplinaire sur les autres juges.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "Décret 2026-022",
   "title": "Accès aux images",
   "summary": "Toute partie concernée (agent ou personne interpellée) peut obtenir les images ; conservation jusqu'à clôture ; altération sanctionnée ; accès égal.",
   "url": "https://legifrat.fr/textes/decret-relatif-a-l-acces-aux-enregistrements-des-cameras-pietons"
  }
 ],
 "civil": [
  {
   "ref": "BOR-VII",
   "title": "Jury en matière civile",
   "summary": "Jury garanti au civil au-delà de 20 $ de litige.",
   "url": "https://legifrat.fr/textes/bill-of-rights"
  },
  {
   "ref": "CP 230-3",
   "title": "Menaces",
   "summary": "Annoncer un crime ou délit contre autrui (saisir la justice n'en est pas une). Aggravées : magistrat, menace de mort, arme, répétition.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "150 000 $ + 3 ans (1 circ. 300 000 $ + 5 ans ; 2+ circ. 500 000 $ + 8 ans)"
  },
  {
   "ref": "CP 230-4",
   "title": "Diffamation",
   "summary": "Nuire à la réputation par des propos mensongers. Immunité pour les propos tenus devant une juridiction et les comptes rendus fidèles.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "150 000 $ + 3 ans"
  },
  {
   "ref": "CP 430-2",
   "title": "Trouble de voisinage",
   "summary": "Empiétement sur la propriété d'autrui.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "85 000 $ + 3 ans"
  },
  {
   "ref": "CPP 325-1",
   "title": "Partie civile (personne physique)",
   "summary": "Victime directe ou par ricochet.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 325-3",
   "title": "Voies d'action",
   "summary": "Plainte ou jonction à l'action publique ; au civil, faute + préjudice + lien de causalité.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CP 330-11",
   "title": "Procédure abusive",
   "summary": "Utiliser la justice de façon dilatoire ou vexatoire.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "250 000 $ + 5 ans"
  }
 ],
 "affaires": [
  {
   "ref": "Déonto III-1",
   "title": "Direction des cabinets",
   "summary": "Tout cabinet doit être dirigé par des membres du Barreau ; condition pour ouvrir l'entreprise.",
   "url": "https://legifrat.fr/textes/code-de-deontologie-du-barreau"
  },
  {
   "ref": "CGI 110-3",
   "title": "Contribuables",
   "summary": "Personnes physiques et morales ; le dirigeant enregistré répond personnellement ; il peut habiliter des collaborateurs fiscaux et reste responsable de leurs actes ; changement d'activité = acte de l'IRS.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CGI 110-4",
   "title": "Cycle hebdomadaire",
   "summary": "Semaine du lundi 00h00 au dimanche 23h59 ; dépôt entre dimanche 12h00 et 23h59 ; paiement au plus tard lundi 23h59 ; déclaration néant obligatoire ; semaine décalée possible sur décision de l'IRS.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CGI 220-1",
   "title": "Assiette de l'IS",
   "summary": "Bénéfice brut = chiffre d'affaires de la semaine − dépenses (achats, carburant, loyer, entretien…). Salaires, primes, impôts et amendes non déductibles. Déficit non reportable.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CGI 220-3",
   "title": "Comptabilité",
   "summary": "Registre des recettes, dépenses, salaires et relevés bancaires, conservé 8 semaines ; recette non inscrite = dissimulée ; dépense non justifiée = réintégrée.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CGI 510-2",
   "title": "Vérification sur place",
   "summary": "Sans mandat, locaux professionnels aux heures d'ouverture, jamais un domicile ; chez un avocat, conditions de CPP 227-2 ; avocat possible.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CGI 530-1",
   "title": "Réclamation préalable",
   "summary": "Sous 7 jours ; silence de 7 jours = rejet ; non suspensive.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CGI 610-4",
   "title": "Amendes forfaitaires",
   "summary": "Registre absent ou non présenté : 500 000 $ ; obstruction à la vérification : 1 M$.",
   "url": "https://legifrat.fr/textes/code-general-des-impots"
  },
  {
   "ref": "CP 330-5",
   "title": "Fraude",
   "summary": "Tromper une institution : fraude fiscale, électorale, aux assurances, aux aides publiques. Remboursement intégral en cas de fraude fiscale.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "1 M$ + 20 ans"
  },
  {
   "ref": "CP 430-3",
   "title": "Alcool",
   "summary": "Vente interdite sans licence officielle, aux ou par les moins de 21 ans, sans contrôle d'identité si le client paraît moins de 27 ans. Amende par jour d'exercice sans licence.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "100 000 $ (par jour sans licence)"
  },
  {
   "ref": "CPP 315-4",
   "title": "Alternatives",
   "summary": "11 mesures pour les personnes physiques (rappel à la loi, amende, TIG…) ; CJIP pour les personnes morales : amende réduite de moitié max + mise en conformité.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "Décret 2026-011",
   "title": "Tenue de travail",
   "summary": "Art. 1-2 toute entreprise d'au moins 1 salarié fournit gratuitement une tenue avec logo ou nom ; art. 3 port obligatoire au contact du public ou visible de la rue ; art. 4 contrôle par l'IRS seul ; art. 5 amende modulée ; art. 6 dispense possible sur demande motivée.",
   "url": "https://legifrat.fr/textes/decret-portant-obligation-du-port-d-une-tenue-de-travail-identifiable-par-les-salaries-d-entreprise"
  },
  {
   "ref": "Décret 2026-006",
   "title": "Nominations",
   "summary": "Jamal Carter, Secrétaire au Commerce et à l'Emploi : reçoit les dirigeants, instruit les demandes de licences et de subventions ; Ilyes Forbes, Secrétaire à la Défense : liaison FRPD, BCSO, Marshals.",
   "url": "https://legifrat.fr/textes/decret-n-2026-006-portant-nomination-de-membres-du-gouvernement"
  }
 ],
 "immobilier": [
  {
   "ref": "CP 420-3",
   "title": "Effraction",
   "summary": "Forcer une fermeture ou utiliser de fausses clés.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "350 000 $ + 8 ans"
  },
  {
   "ref": "CP 420-4",
   "title": "Intrusion",
   "summary": "Entrer ou rester sur une propriété privée sans accord.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "300 000 $ + 5 ans"
  },
  {
   "ref": "CP 430-2",
   "title": "Trouble de voisinage",
   "summary": "Empiétement sur la propriété d'autrui.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "85 000 $ + 3 ans"
  },
  {
   "ref": "BOR-IV",
   "title": "Perquisitions abusives",
   "summary": "Pas de fouille ni de saisie injustifiée ; mandat motivé, sous serment, précisant lieux et objets.",
   "url": "https://legifrat.fr/textes/bill-of-rights"
  },
  {
   "ref": "CPP 227-1",
   "title": "Perquisition",
   "summary": "Sans mandat en flagrance ; avec mandat d'un juge sur réquisition du procureur en préliminaire. Téléphone du gardé à vue et caméras consultables sans mandat.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  },
  {
   "ref": "CPP 227-3",
   "title": "Saisie",
   "summary": "Limitée à l'objet de l'enquête ; sans propriétaire identifié, l'objet est présumé au propriétaire du lieu.",
   "url": "https://legifrat.fr/textes/code-de-procedure-penale"
  }
 ],
 "administratif-routier": [
  {
   "ref": "CP 110-5",
   "title": "Amende nominale",
   "summary": "30 % de l'amende maximale, arrondie au millier ; appliquée par les forces de l'ordre sans Procureur, avec la durée max de détention pour un délit. Exclue pour les crimes. Définitive.",
   "url": "https://legifrat.fr/textes/code-penal"
  },
  {
   "ref": "CP 310-1",
   "title": "Refus d'obtempérer",
   "summary": "Conducteur qui ne s'arrête pas après une sommation claire (gyrophares et sirène valent sommation).",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "250 000 $ + 10 ans"
  },
  {
   "ref": "CP 380-1",
   "title": "Conduite sans permis",
   "summary": "Sans permis valide pour la catégorie ; fourrière immédiate.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "100 000 $ + 3 ans"
  },
  {
   "ref": "CP 380-4",
   "title": "Excès de vitesse",
   "summary": "Dépassement de la vitesse autorisée.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "75 000 $"
  },
  {
   "ref": "CP 380-6",
   "title": "Casque",
   "summary": "Casque homologué obligatoire en deux-roues motorisé.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "30 000 $"
  },
  {
   "ref": "CP 320-6",
   "title": "Manifestation illégale",
   "summary": "Manifestation non déclarée au Département de la Défense, sans accord écrit ou après retrait ; vise l'organisateur et les participants après refus.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "800 000 $ + 10 ans"
  },
  {
   "ref": "Décret 2026-005",
   "title": "Port visible des armes",
   "summary": "Art. 1 toute arme d'un citoyen reste dissimulée (port dans le dos = exhibition) ; art. 2 holster visible = fouille et contrôle du permis systématiques, le permis n'autorise pas le port visible ; art. 3 saisie ; art. 4 retrait d'insigne pour l'agent qui ferme les yeux.",
   "url": "https://legifrat.fr/textes/decret-portant-reglementation-du-port-visible-des-armes-a-feu"
  },
  {
   "ref": "Décret 2026-023",
   "title": "Décret n° 2026-023",
   "summary": "Déclaration et accord écrit pour toute manifestation, retrait sans motif ; crée CP 320-6 et 120-8.",
   "url": "https://legifrat.fr/decrets"
  }
 ],
 "conseil": [
  {
   "ref": "Déonto I-3",
   "title": "Secret professionnel",
   "summary": "Général, absolu, illimité dans le temps : consultations, correspondances, notes, fonds clients. Pas de saisie au cabinet hors cas légaux ; l'avocat le fait respecter par son personnel.",
   "url": "https://legifrat.fr/textes/code-de-deontologie-du-barreau"
  },
  {
   "ref": "Déonto I-4",
   "title": "Conflits d'intérêts",
   "summary": "Pas deux clients aux intérêts opposés ; vaut pour toute la structure ; avis non contraignant possible de la Commission d'éthique.",
   "url": "https://legifrat.fr/textes/code-de-deontologie-du-barreau"
  },
  {
   "ref": "Déonto II-2",
   "title": "Violation de la loi",
   "summary": "Interdiction de conseiller un comportement criminel ou frauduleux ; on peut en expliquer les conséquences juridiques.",
   "url": "https://legifrat.fr/textes/code-de-deontologie-du-barreau"
  },
  {
   "ref": "Déonto II-4",
   "title": "Offres de règlement",
   "summary": "Transmettre immédiatement toute proposition de plaider-coupable ou de règlement écrit.",
   "url": "https://legifrat.fr/textes/code-de-deontologie-du-barreau"
  },
  {
   "ref": "CP 340-4",
   "title": "Secret professionnel",
   "summary": "Divulguer une information confidentielle (médecin, avocat, fonctionnaire). Aggravé si justice ou sûreté de l'État.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "500 000 $ + 15 ans (aggr. 850 000 $ + 20 ans)"
  },
  {
   "ref": "CP 340-7",
   "title": "Exercice illégal d'une profession",
   "summary": "Agir comme avocat, médecin ou autre profession réglementée sans autorisation.",
   "url": "https://legifrat.fr/textes/code-penal",
   "penalty": "300 000 $ + 10 ans"
  }
 ]
};
