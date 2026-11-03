# AVOCAT & CONSEIL — site du cabinet (GTA V RP)

Site complet d'un cabinet d'avocats pour serveur FiveM : pages publiques, espace client, espace avocat, administration, connexion Discord, notifications et commandes Discord.

**Stack** : pages statiques + fonctions Netlify (Node 20) · Firebase Realtime Database (comme PDM) · Discord OAuth2 · bot Discord en mode HTTP (aucun processus à laisser tourner, tout est gratuit).

Le guide pas à pas pour débutant est le document « Guide de mise en ligne — AVOCAT & CONSEIL ». Ce README est la référence technique.

---

## 1. Ce qui est inclus

| Partie | Contenu |
|---|---|
| Pages publiques | Accueil, Le cabinet, Expertises + 6 pages domaines, Notre équipe, Honoraires, Actualités (liste + article), Contact, FAQ, Recrutement, Connexion, 404 |
| Espace client | Tableau de bord, dépôt de demande avec pièces jointes, suivi des dossiers (progression + historique), rendez-vous, profil RP |
| Prestations | Catalogue par module avec prix, géré depuis l'administration (ajout, modification, masquage, suppression). Module pénal complet : 30 prestations tarifées |
| Prise de rendez-vous | Domaine → prestation précise (avec prix) → avocat → date → créneau libre → confirmation (site + Discord). Anti double réservation en base |
| Portefeuilles | Chaque client a un avocat référent unique : fixé à son 1er rendez-vous ou à la 1re attribution d'un dossier. Ensuite : rendez-vous uniquement avec lui, nouveaux dossiers confiés automatiquement, attribution à un autre avocat bloquée. Transfert possible depuis Administration → Clients (avec ou sans ses dossiers en cours) |
| Espace avocat | Portefeuille de clients, dossiers attribués, accepter / refuser, statut, notes internes, documents internes, calendrier, historique, disponibilités, fiche pro |
| Administration | Tableau de bord (indicateurs, courbe d'activité, prochains rendez-vous, dernières demandes), dossiers (recherche, filtres, attribution, archivage), agenda de tous les rendez-vous, avocats (prénom, nom, téléphone, e-mail, photo, spécialités, rôle), clients, candidatures, messages, actualités, paramètres Discord |
| Discord | Connexion OAuth2, rôles Discord → droits sur le site, notifications dans 5 salons, messages privés de confirmation, 9 commandes slash (3 publiques qui renvoient vers le site, 6 pour le cabinet), message d'accueil avec boutons |

Rôles : **Citoyen** (aucun rôle) · **Avocat** · **Responsable juridique** · **Direction**. Le rôle effectif est le plus élevé entre le rôle Discord (relu à chaque connexion) et le rôle attribué depuis l'administration.

Le **premier compte qui se connecte** devient Direction automatiquement, pour pouvoir configurer le site.

---

## 2. Installation (environ 30 minutes)

### Étape A — Base de données Firebase

1. <https://console.firebase.google.com> → **Créer un projet** (nouveau projet dédié, pas celui de PDM : les règles de sécurité sont différentes). Google Analytics : inutile.
2. **Créer** → **Realtime Database** → **Créer une base de données** → emplacement **Belgique (europe-west1)** → **Démarrer en mode verrouillé**.
3. Onglet **Règles** : collez le contenu de `firebase/database.rules.json` (lecture et écriture interdites au public) → **Publier**. Seul le serveur du site accède à la base.
4. Copiez l'adresse affichée en haut de l'onglet **Données** → `FIREBASE_DATABASE_URL`.
5. ⚙ **Paramètres du projet** → **Comptes de service** → **Codes secrets de la base de données** → **Afficher** → copiez → `FIREBASE_DATABASE_SECRET`.
   Si cet onglet n'existe pas : **SDK Admin Firebase** → **Générer une nouvelle clé privée**, ouvrez le fichier téléchargé et recopiez `client_email` → `FIREBASE_CLIENT_EMAIL` et `private_key` (toute la valeur entre guillemets, avec les `\n`) → `FIREBASE_PRIVATE_KEY`.

Rien à créer à la main : au premier appel, le site remplit la base (catalogue des prestations, actualités d'exemple).

### Étape B — Application Discord

Sur <https://discord.com/developers/applications> → **New Application** (nom : AVOCAT & CONSEIL).

1. **General Information** : copiez `APPLICATION ID` → `DISCORD_APPLICATION_ID` et `PUBLIC KEY` → `DISCORD_PUBLIC_KEY`.
2. **OAuth2** :
   - **Reset Secret** → `DISCORD_CLIENT_SECRET`.
   - **Redirects** → ajoutez exactement : `https://VOTRE-SITE.netlify.app/api/auth/callback`
3. **Bot** : **Reset Token** → `DISCORD_BOT_TOKEN`. Aucun « Privileged Intent » n'est nécessaire.
4. **Inviter le bot** : OAuth2 → URL Generator → scopes `bot` + `applications.commands`, permissions `Send Messages`, `Embed Links`, `View Channels`. Ouvrez l'URL générée et ajoutez le bot à votre serveur.
5. Dans Discord : Paramètres → Avancés → **Mode développeur** activé. Clic droit sur le serveur → Copier l'identifiant → `DISCORD_GUILD_ID`. Faites de même pour les 5 salons et les 3 rôles.

### Étape C — Netlify

1. Mettez ce dossier sur GitHub (ou glissez-le avec Netlify CLI), puis **Add new site → Import an existing project**.
2. Paramètres de build : déjà dans `netlify.toml` (build `npm run build`, dossier `dist`).
3. **Site configuration → Environment variables** : ajoutez toutes les variables de `.env.example` (voir tableau ci-dessous).
4. Déployez. Notez l'adresse du site et mettez-la dans `SITE_URL` (sans `/` final), puis redéployez.

### Étape D — Commandes slash

1. Discord Developer Portal → **General Information → Interactions Endpoint URL** :
   `https://VOTRE-SITE.netlify.app/api/discord/interactions` → **Save**. Discord envoie un test signé : il doit être accepté.
2. Sur votre ordinateur, dans ce dossier : copiez `.env.example` en `.env`, remplissez au minimum `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`, puis :

```bash
npm install
npm run discord:commands
```

### Mise à jour d'une installation existante

Rien à faire côté base : Firebase n'a pas de schéma, les nouveaux champs sont ajoutés au fil de l'eau.

### Étape E — Premier lancement

1. Connectez-vous en premier avec le compte de la direction.
2. **Administration → Paramètres Discord** : vérifiez les 4 voyants (OAuth2, bot, commandes, serveur) et les identifiants de salons/rôles.
3. **Administration → Avocats → Ajouter un avocat** : prénom, nom, titre, téléphone en jeu, e-mail, photo (PNG/JPG/WEBP, 2 Mo max), spécialités. L'identifiant Discord est facultatif :
   - **avec** : l'avocat retrouve sa fiche en se connectant, gère ses dossiers et reçoit les notifications ;
   - **sans** : la fiche apparaît sur le site et reste attribuable ; un responsable gère ses dossiers. Le compte Discord peut être lié plus tard depuis « Modifier ».
4. Un membre ayant le rôle Discord « Avocat » obtient aussi une fiche automatiquement à sa première visite de l'espace avocat. Il complète sa fiche (photo comprise) et ses disponibilités.

---

## 3. Variables d'environnement

| Variable | Où la trouver | Obligatoire |
|---|---|---|
| `SITE_URL` | Adresse Netlify, sans `/` final | Oui |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Oui |
| `FIREBASE_DATABASE_URL` | Firebase → Realtime Database → adresse en haut | Oui |
| `FIREBASE_DATABASE_SECRET` | Paramètres → Comptes de service → Codes secrets de la base | Oui (ou les 2 suivantes) |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Clé privée du compte de service | Si pas de code secret |
| `DISCORD_APPLICATION_ID` | Developer Portal → General Information | Oui |
| `DISCORD_PUBLIC_KEY` | Developer Portal → General Information | Pour les commandes slash |
| `DISCORD_CLIENT_SECRET` | Developer Portal → OAuth2 | Oui |
| `DISCORD_BOT_TOKEN` | Developer Portal → Bot | Pour les notifications |
| `DISCORD_GUILD_ID` | Identifiant du serveur | Oui |
| `DISCORD_REQUIRE_MEMBER` | `true` = seuls les membres du serveur se connectent | Non |
| `DISCORD_CHANNEL_*` (6) | Identifiants des salons (dont `DISCORD_CHANNEL_WELCOME` = salon d'accueil) | Modifiables dans l'admin |
| `DISCORD_ROLE_*` (3) | Identifiants des rôles | Modifiables dans l'admin |
| `DISCORD_DM_CONFIRMATIONS` | `false` pour couper les messages privés | Non |
| `CABINET_TIMEZONE` | ex. `Europe/Paris` | Non |

Le token du bot et le secret OAuth2 ne quittent jamais le serveur : aucun secret n'est présent dans le JavaScript du navigateur.

---

## 4. Commandes Discord

| Commande | Qui | Effet |
|---|---|---|
| `/rdv` | Tout le monde | Bouton vers la prise de rendez-vous du site |
| `/demande` | Tout le monde | Bouton vers le dépôt de demande |
| `/site` | Tout le monde (aussi en MP) | Message avec les 4 liens du site |
| `/dossiers [filtre]` | Avocat+ | Nouvelles demandes, mes dossiers, ou tous les actifs |
| `/dossier numero` | Avocat (ses dossiers), Responsable+ | Détail d'un dossier |
| `/agenda` | Avocat (les siens), Responsable+ (tous) | Prochains rendez-vous |
| `/attribuer numero avocat` | Responsable+ | Attribue le dossier, synchronisé avec le site |
| `/statut numero statut [commentaire]` | Avocat attribué, Responsable+ | Change le statut, notifie le client |
| `/stats` | Avocat+ | Compteurs du cabinet |

Pour utiliser `/attribuer` et `/statut`, le membre doit s'être connecté une fois au site. Un citoyen qui tape une commande du cabinet reçoit des boutons vers le site.

**Guider les clients vers le site** : créez un salon `#prendre-rendez-vous` en lecture seule, renseignez son identifiant dans Administration → Paramètres (« Salon d'accueil »), cliquez **Publier le message d'accueil**, puis épinglez le message. Tous les messages privés du bot portent aussi un bouton vers le dossier ou l'espace client.

Après chaque mise à jour du code, recliquez **Installer les commandes Discord**.

---

## 5. Personnaliser

- **Adresse, téléphone en jeu, horaires, lien Discord, photos** : `site.config.mjs`.
- **Image d'accueil** : `hero-nuit.svg` est une illustration de remplacement (Los Santos de nuit + façade du cabinet). Remplacez-la par une capture en jeu de 1920 px de large minimum.
- **Photos des avocats** : envoyées directement depuis l'administration ou la fiche de l'avocat, stockées en base.
- **Autres photos** : les illustrations au trait (`src/assets/img/*.svg`) sont des remplaçants. Le meilleur rendu viendra de **captures en jeu** (bureaux, salle de réunion, palais de justice) : déposez vos JPG dans `src/assets/img/` et changez les chemins dans `site.config.mjs`.
- **Prestations et tarifs** : **Administration → Prestations**. Ajoutez une prestation dans le module (secteur) de votre choix, avec sa rubrique, son prix (vide = sur devis, 0 = offert) et sa facturation (forfait, par mois, par heure, par audience, par acte). Décochez « Visible » pour la retirer du site sans la supprimer. Les pages domaines, la page Honoraires, la prise de rendez-vous et le formulaire de demande se mettent à jour aussitôt.
- **Catalogue de départ** : le module pénal (30 prestations avec prix) et les actes juridiques sont dans `shared/domains.mjs` (`PENAL_MODULE`, `CATALOG`). Ils ne sont insérés qu'une fois, quand la table des prestations est vide.
- **Honoraires** : `src/pages/honoraires.html` (montants à aligner sur l'économie du serveur).
- **Couleurs et typographie** : variables en haut de `src/assets/css/style.css`. Polices Bodoni Moda et Hanken Grotesk auto-hébergées (licence OFL, dans `src/assets/fonts/`).

---

## 6. Lancer en local

```bash
npm install
cp .env.example .env      # remplir
npm run dev               # http://localhost:8888
```

Pour tester la connexion Discord en local, ajoutez `http://localhost:8888/api/auth/callback` dans les Redirects OAuth2 et mettez `SITE_URL=http://localhost:8888`.

### Tests automatisés

`tests/` contient un faux Discord, un faux Firebase et 157 vérifications de bout en bout (Chrome) : connexion, rôles, dépôt de dossier, notifications, attribution, statuts, notes internes, rendez-vous, prestations, commandes slash signées, permissions, mobile.

```bash
node tests/mock-discord.mjs &           # faux Discord sur :9999
node tests/mock-firebase.mjs &          # faux Firebase sur :9998 (FIREBASE_DATABASE_URL=http://localhost:9998, secret test-firebase-secret)
# .env de test : DISCORD_API_BASE=http://localhost:9999/api/v10 et DISCORD_AUTHORIZE_URL=http://localhost:9999/oauth2/authorize
npm run dev &
python3 tests/e2e.py ./captures ./cle-privee-ed25519.hex
```

---

## 7. Limites connues

- **Pièces jointes** : 4 Mo par fichier, 30 par dossier, stockées dans Firebase (limite des fonctions Netlify à 6 Mo par requête). Formats : PNG, JPG, WEBP, GIF, PDF, TXT.
- **Messages privés** : le bot ne peut écrire qu'aux membres du serveur dont les MP sont ouverts. Le site reste la référence.
- **Rôles Discord** : relus à la connexion. Un rôle retiré sur Discord prend effet à la prochaine connexion (session de 7 jours max). Pour un retrait immédiat : Administration → Clients → désactiver le compte.
- **Fuseau horaire** : les créneaux sont en heure du cabinet (`CABINET_TIMEZONE`).
- **Quotas gratuits** : Firebase Spark (gratuit) : 1 Go stocké, 10 Go téléchargés par mois ; Netlify gratuit : 125 000 appels de fonctions par mois. Largement suffisant pour un serveur RP ; les pièces jointes sont ce qui consomme le plus.

## 8. Structure

```
firebase/           règles de sécurité de la base
netlify/functions/  points d'entrée Netlify (api, discord)
server/             API : auth, routes, règles métier, accès Firebase (store.mjs), bot, commandes slash
shared/domains.mjs  domaines, statuts, rôles (serveur + navigateur)
src/pages/          pages HTML
src/assets/         CSS, JS, polices, illustrations
scripts/            build, serveur local, migration, enregistrement des commandes
tests/              faux Discord + tests de bout en bout
site.config.mjs     coordonnées, photos, lien Discord
```
