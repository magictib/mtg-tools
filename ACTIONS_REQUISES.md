# Actions externes à réaliser — checklist consolidée

> Tout ce qui ne peut pas être codé pour toi : créer des comptes, configurer des clés, exécuter des commandes, soumettre à Google. Chaque étape précise **pourquoi** et **combien de temps**.

---

## ⚡ ÉTAPE 0 — Vérifier que ce qui est codé fonctionne (10 min)

**Objectif** : avant de configurer la production, t'assurer en local que rien n'est cassé.

### 0.1 Lancer l'app en local
```bash
python -m http.server 7432
# Ouvrir http://localhost:7432
```
- ✓ La landing doit s'afficher avec les 4 features
- ✓ Tu peux te connecter avec ton compte existant
- ✓ Aucune erreur rouge dans la console navigateur (F12)

### 0.2 Lancer les tests E2E
```bash
cd tests
npm install                    # ~30 secondes
npm run install-browsers       # télécharge Chromium ~150 Mo
npm test                       # ~30 secondes
```
- ✓ Les 19 tests doivent passer
- Si certains échouent, ouvrir `playwright-report/index.html` pour le détail

---

## 🔴 ÉTAPE 1 — Bloquants pour aller en prod (1h30)

**Sans ces étapes, l'app fonctionne en mode dégradé** (règles Firestore non durcies, pas de backup, certaines features renvoient "Action refusée").

### 1.1 Déployer les nouvelles règles Firestore
```bash
firebase deploy --only firestore:rules
```
**Pourquoi** : les règles actuelles en prod sont l'ancienne version. Les nouvelles ajoutent : validation taille `comments` et `likedBy`, validation `cardCount`, règles spécifiques `social_notifs`/`push_subs`, modération admin sur `public_decks`, collection `reports`.

**Risque si pas fait** : l'app fonctionne mais un user peut abuser (commentaires géants, likes négatifs, lire des notifs sociales d'autres users).

### 1.2 Créer les 5 index composites Firestore
Au premier appel de certaines requêtes, Firestore affichera une erreur dans la console JS avec un **lien direct** pour créer l'index. Clique sur le lien, valide, attends 2-5 min.

Index à créer (Firestore Console → Indexes) :
| Collection | Champs |
|---|---|
| `public_decks` | `createdBy` (asc) + `updatedAt` (desc) |
| `public_decks` | `commander` (asc) + `likes` (desc) |
| `public_decks/{id}/comments` | (inline maintenant, plus besoin) |
| `users/{uid}/social_notifs` | `read` (asc) + `ts` (desc) |
| `users/{uid}/social_notifs` | `ts` (desc) |
| `reports` | `status` (asc) + `ts` (desc) |

**Tu peux ignorer cette étape** et laisser l'erreur arriver organiquement — Firestore te donnera le lien à cliquer.

### 1.3 Configurer le backup quotidien Firestore
**Pourquoi** : si Firebase a un incident, sans backup tu perds tout. C'est gratuit et prend 5 minutes.

```bash
# Pré-requis : gcloud CLI installé (https://cloud.google.com/sdk/docs/install)
PROJECT_ID="manalab-app"   # ton vrai project ID
BUCKET="manalab-firestore-backups"

# 1. Bucket EU (RGPD)
gcloud storage buckets create gs://$BUCKET \
  --project=$PROJECT_ID --location=europe-west1 \
  --uniform-bucket-level-access

# 2. Lifecycle : suppression auto à 30j
gcloud storage buckets update gs://$BUCKET \
  --lifecycle-file=scripts/firestore-backup-lifecycle.json

# 3. Permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com \
  --role=roles/datastore.importExportAdmin
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com \
  --role=roles/storage.objectAdmin

# 4. Cron quotidien 3h Paris
gcloud scheduler jobs create http firestore-daily-backup \
  --project=$PROJECT_ID --location=europe-west1 \
  --schedule="0 3 * * *" --time-zone="Europe/Paris" \
  --uri="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email=$PROJECT_ID@appspot.gserviceaccount.com \
  --headers="Content-Type=application/json" \
  --message-body="{\"outputUriPrefix\":\"gs://$BUCKET/\$(date +%Y-%m-%d)\"}"
```
Test manuel immédiat : `bash scripts/firestore-backup.sh`

### 1.4 Compléter les mentions légales
Ouvrir [legal/mentions.html](legal/mentions.html) et remplacer les `à compléter` :
- SIREN (après immatriculation micro-entreprise sur [autoentrepreneur.urssaf.fr](https://www.autoentrepreneur.urssaf.fr) — gratuit, 1 jour de traitement)
- Adresse postale (peut être ton adresse personnelle)

**Bloquant pour** : monétiser (mais c'est mis de côté). **Recommandé même sans monétisation** pour être RGPD-clean.

### 1.5 Déployer le code sur Vercel
```bash
vercel --prod
```
**Pourquoi** : pour activer toutes les nouvelles edge functions (`/api/c/:slug`, `/api/og`, `/api/digest`, `/api/status`, `/sitemap.xml`, `/s/:enc`, `/combo/:slug`).

Si tu n'as pas encore configuré Vercel :
```bash
npm i -g vercel
vercel login
vercel link   # lier le dossier au projet Vercel
```

---

## 🟠 ÉTAPE 2 — Monitoring (15 min, gratuit)

**Sans ça, tu codes en aveugle** : pas d'alertes erreurs, pas d'analytics, tu ne sauras pas si quelqu'un visite ou crash.

### 2.1 Sentry (erreurs front)
1. Créer compte gratuit sur [sentry.io](https://sentry.io/signup/) (free tier : 5k events/mois)
2. Créer un nouveau projet "JavaScript" → récupérer le DSN (format `https://xxxxx@oxxx.ingest.sentry.io/xxxx`)
3. Ajouter dans `index.html` juste avant `</body>` :
   ```html
   <script>window.SENTRY_DSN='https://xxxxx@oxxx.ingest.sentry.io/xxxx';</script>
   ```
4. Redéployer (`vercel --prod`)

**Tu verras** : toutes les erreurs JS de tes utilisateurs en temps réel, avec stack trace et contexte.

### 2.2 Plausible (analytics)
1. Créer compte sur [plausible.io](https://plausible.io) (~6€/mois après 30 jours d'essai) OU self-hosté gratuit
2. Ajouter le domaine `manalab.app`
3. Ajouter dans `index.html` juste avant `</body>` :
   ```html
   <script>window.PLAUSIBLE_DOMAIN='manalab.app';</script>
   ```
4. Redéployer

**Alternative gratuite** : [Umami](https://umami.is) (self-hosted) ou [Goatcounter](https://www.goatcounter.com) (gratuit jusqu'à 100k vues/mois).

### 2.3 UptimeRobot (monitoring uptime)
1. Créer compte gratuit sur [uptimerobot.com](https://uptimerobot.com)
2. Add monitor → "HTTP(s)" → URL : `https://manalab.app/status?format=json` → interval 5 min
3. Configurer alerte par email ou Discord webhook

---

## 🟡 ÉTAPE 3 — SEO (15 min, gratuit)

**Sans ça**, Google ne trouvera jamais ton site. C'est ton **seul levier d'acquisition organique**.

### 3.1 Lancer les seeds (1 fois)
**Pourquoi** : peuple Firestore avec ~10000 commandants Scryfall + 10 combos iconiques pour que les pages SEO `/c/:slug` aient du contenu dès le départ.

```bash
# Pré-requis : télécharger une clé service account Firebase (firebase-service-account.json à la racine)
# Firebase Console → Settings → Service Accounts → Generate new private key
# ⚠️ Ne JAMAIS commit ce fichier (déjà gitignored normalement, vérifie)

cd scripts
npm install firebase-admin
node seed-commanders.js    # ~3 min, scrape ~10000 commandants depuis Scryfall
node seed-combos.js        # <5 sec
```

### 3.2 Soumettre à Google
1. Aller sur [Google Search Console](https://search.google.com/search-console)
2. Add property → `https://manalab.app` (la version avec ou sans www)
3. Vérifier la propriété (méthode DNS recommandée : ajouter un record TXT chez ton registrar)
4. Sitemaps → ajouter `https://manalab.app/sitemap.xml`
5. Patienter 2-4 semaines pour les premières indexations

### 3.3 Soumettre à Bing (optionnel mais 10 min)
1. [Bing Webmaster](https://www.bing.com/webmasters)
2. Import depuis Google Search Console (1 clic)
3. Submit sitemap

---

## 🔵 ÉTAPE 4 — Engagement (rétention, ~45 min)

### 4.1 Resend (récap mensuel email)
1. Compte sur [resend.com](https://resend.com) (gratuit : 100/jour, 3000/mois)
2. Add domain → `manalab.app` → ajouter 3 records DNS chez ton registrar (SPF, DKIM, DMARC) — Resend les fournit, copier-coller
3. Attendre validation domaine (~10 min après ajout DNS, propagation peut prendre 24h)
4. Créer API key dans Resend dashboard
5. Sur Vercel, ajouter ces env vars :
   ```bash
   vercel env add RESEND_API_KEY        # re_xxxxx...
   vercel env add RESEND_FROM           # ManaLAB <noreply@manalab.app>
   vercel env add DIGEST_SECRET         # token aléatoire, ex: openssl rand -hex 32
   vercel env add FIREBASE_PROJECT_ID   # manalab-app
   vercel env add MANALAB_BASE_URL      # https://manalab.app
   ```
6. Redéployer
7. Tester manuellement : `curl "https://manalab.app/api/digest?token=<DIGEST_SECRET>"`

Le cron `0 10 1 * *` envoie automatiquement le 1er de chaque mois à 10h Paris.

### 4.2 Web Push notifications
1. Générer les clés VAPID (1 commande, gratuit) :
   ```bash
   npx web-push generate-vapid-keys
   ```
   Sortie :
   ```
   Public Key: BFv...long
   Private Key: KZ...long
   ```
2. Sur Vercel, ajouter :
   ```bash
   vercel env add PUSH_PUBLIC_KEY     # la public
   vercel env add PUSH_PRIVATE_KEY    # la privée
   vercel env add PUSH_SUBJECT        # mailto:thibaud.combes31@gmail.com
   vercel env add PUSH_TRIGGER_SECRET # autre token aléatoire long
   ```
3. Dans `index.html` juste avant `</body>` :
   ```html
   <script>window.PUSH_PUBLIC_KEY='BFv...long';</script>
   ```
4. Déployer les Cloud Functions Firebase :
   ```bash
   cd functions
   npm install
   firebase functions:config:set push.endpoint="https://manalab.app/api/push-send"
   firebase functions:config:set push.secret="<même valeur que PUSH_TRIGGER_SECRET>"
   firebase deploy --only functions
   ```
5. Redéployer Vercel (`vercel --prod`)

Test : connecte-toi sur l'app, Ctrl+K → "Notifications push (activer/désactiver)" → accepte. Demande à un ami de te liker un deck → tu dois recevoir une notif système.

### 4.3 App Check (anti-bot)
1. [Google reCAPTCHA admin](https://www.google.com/recaptcha/admin) → créer une clé v3 pour `manalab.app`
2. [Firebase Console](https://console.firebase.google.com) → ton projet → App Check → enregistrer ton app web avec la clé reCAPTCHA v3
3. Dans `index.html` :
   ```html
   <script>window.FIREBASE_APP_CHECK_KEY='6Lc...la-cle-publique-recaptcha';</script>
   ```
4. Dans Firebase Console → App Check → choisir "Enforce" sur Firestore (passer du mode "monitor" à "enforce" une fois testé)
5. Redéployer

**Bénéfice** : bloque les bots qui essaieraient de spammer Firestore.

---

## 🟢 ÉTAPE 5 — Code branchements oubliés

### 5.1 Brancher le parrainage à l'inscription
Cherche la fonction `authRegister` dans `index.html` et ajoute `_refApplyReward(cred.user.uid)` juste après la création de compte réussie.

Cherche un pattern comme :
```js
firebase.auth().createUserWithEmailAndPassword(email, pw).then(function(cred){
  // ... code existant ...
});
```

Ajouter à la fin du `.then` :
```js
if(typeof _refApplyReward==='function')_refApplyReward(cred.user.uid);
```

**Sans ça**, ton lien de parrainage capture l'UID en localStorage mais ne crédite jamais les Pétales.

### 5.2 Brancher CI GitHub Actions (optionnel)
Créer `.github/workflows/test.yml` avec le contenu fourni dans `tests/README.md`. Les tests se lanceront à chaque push.

---

## 🟣 ÉTAPE 6 — Distribution (continu, marketing)

### 6.1 Contacter les créateurs MTG FR
Liste dans `BUSINESS_SETUP.md` § 6. Pitch type fourni. Cible : 5-10 contacts par mois.

### 6.2 Annonce publique
- Reddit r/MagicFrance, r/EDH, r/magicTCG
- Discord MTG Genève / Lyon / Paris / France
- X/Twitter MTG FR
- HackerNews "Show HN: ManaLAB"

**Pas avant d'avoir validé** : tests OK, monitoring branché, 5-10 amis ont testé pendant 1 semaine sans bug majeur.

---

## ❌ MIS DE CÔTÉ (monétisation)

Selon ta consigne actuelle, on ne fait pas :
- Stripe (création produits, webhook, Customer Portal)
- Cardmarket Partner Program (tag affiliation)
- Compte bancaire pro
- Stripe Tax / TVA EU
- Code Premium gating sur snapshots / decks privés / IA / PDF

Le code est en place pour activer plus tard sans refactor.

---

## Récapitulatif par durée

| Étape | Durée | Coût | Bloquant ? |
|---|---|---|---|
| 0. Vérifier local | 10 min | 0€ | recommandé |
| 1.1 Deploy rules | 1 min | 0€ | ✅ oui |
| 1.2 Index Firestore | 5 min (à la demande) | 0€ | ✅ oui |
| 1.3 Backup quotidien | 5 min | 0€ | ✅ critique |
| 1.4 Mentions légales | 1 jour (URSSAF) | 0€ | conseillé |
| 1.5 Deploy Vercel | 2 min | 0€ | ✅ oui |
| 2.1 Sentry | 5 min | 0€ | conseillé |
| 2.2 Plausible | 5 min | 6€/mois | conseillé |
| 2.3 UptimeRobot | 5 min | 0€ | conseillé |
| 3.1 Seeds | 5 min | 0€ | ✅ pour SEO |
| 3.2 Google Console | 10 min | 0€ | ✅ pour SEO |
| 4.1 Resend | 30 min (+ DNS) | 0€ | optionnel |
| 4.2 Web Push | 15 min | 0€ | optionnel |
| 4.3 App Check | 10 min | 0€ | conseillé |
| 5.1 Hook parrainage | 2 min | 0€ | ✅ pour activer |

**Minimum vital pour aller en prod (Étapes 0+1+5.1)** : **~30 minutes** + immatriculation URSSAF en parallèle.

**Setup complet sans monétisation** : ~3h cumulées + délais validation domaine Resend.

---

## Variables d'environnement Vercel — récap complet

Quand tu seras prêt, voici toutes les `vercel env add` à exécuter :

```bash
# Firebase / Firestore (toujours)
vercel env add FIREBASE_PROJECT_ID         # manalab-app

# Email digest (étape 4.1)
vercel env add RESEND_API_KEY              # re_xxxxx
vercel env add RESEND_FROM                 # ManaLAB <noreply@manalab.app>
vercel env add DIGEST_SECRET               # openssl rand -hex 32
vercel env add MANALAB_BASE_URL            # https://manalab.app

# Web Push (étape 4.2)
vercel env add PUSH_PUBLIC_KEY             # depuis npx web-push generate-vapid-keys
vercel env add PUSH_PRIVATE_KEY            # idem
vercel env add PUSH_SUBJECT                # mailto:thibaud.combes31@gmail.com
vercel env add PUSH_TRIGGER_SECRET         # openssl rand -hex 32

# Backups (étape 1.3, dans gcloud env)
# Pas Vercel, c'est côté Google Cloud
```

Pour vérifier ce qui est déjà configuré :
```bash
vercel env ls
```
