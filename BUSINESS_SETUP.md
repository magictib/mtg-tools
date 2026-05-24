# Setup business — passer de "outil perso" à "produit qui génère"

Ce document liste les actions externes à mener pour activer les leviers d'acquisition, monétisation et rétention que le code prépare déjà. Tout le frontend est en place — il reste à ouvrir les comptes et configurer les clés.

## Ordre d'attaque recommandé

1. **Cardmarket Partner Program** (1 jour de setup, 0€/mois) → revenus passifs immédiats
2. **SEO Vercel** (déjà déployé via `/api/c`, `/api/sitemap`, `robots.txt`) → trafic Google sous 4-8 semaines
3. **Resend + cron digest** (1h de setup, 0€ jusqu'à 3000 emails/mois) → rétention
4. **Stripe Premium** (½ journée de setup) → monétisation directe
5. **Web Push VAPID** (15 min de setup, 0€) → engagement
6. **Partenariats créateurs MTG FR** (continu) → distribution

---

## 1. Cardmarket Partner Program

**Quoi** : Cardmarket reverse 5% des achats faits depuis tes liens d'affiliation.

**Comment** :
1. Inscription sur [cardmarket.com/Magic/Partner-Program](https://www.cardmarket.com/en/Magic/Partner-Program) (le formulaire est en anglais).
2. Cardmarket valide manuellement (2-7 jours). Ils demandent l'URL du site (manalab.app) et un volume estimé.
3. Une fois validé, ils donnent un **tag d'affiliation** (format `?utm_source=manalab&aff_id=XXXX` ou `?ref=XXXX`).
4. Coller ce tag dans `index.html`, ligne où `CARDMARKET_AFFILIATE_TAG = ''` :
   ```js
   var CARDMARKET_AFFILIATE_TAG = 'utm_source=manalab&aff_id=12345';
   ```
5. Redéployer. Tous les boutons "🛒 CM" du site appliqueront automatiquement le tag.

**Estimation** : 500 utilisateurs × 1 commande/mois × 20€ × 5% = **500€/mois**. À 5000 users : 5000€/mois.

**Points d'achat déjà câblés dans l'UI** :
- Bouton 🛒 CM à côté de chaque entrée wishlist
- Bouton 🛒 CM sur chaque jauge de complétude de deck (cartes manquantes)
- Lien Wants Builder pour décharger une liste complète

---

## 2. SEO / contenu indexable

**Quoi** : pages publiques `/c/atraxa-praetors-voice` agrégeant les decks publics par commandant, indexables Google.

**Comment** : déjà déployé dans `api/c.js`. Vérifier après push :
- `https://manalab.app/c/atraxa-praetors-voice` doit rendre du HTML statique avec OG correct.
- `https://manalab.app/sitemap.xml` doit lister tous les commandants qui ont au moins un deck public.
- `https://manalab.app/robots.txt` doit pointer le sitemap.

**Actions externes** :
1. Soumettre le sitemap à [Google Search Console](https://search.google.com/search-console) : ajouter la propriété manalab.app, vérifier via DNS ou meta tag, puis Sitemaps → ajouter `https://manalab.app/sitemap.xml`.
2. Soumettre aussi à [Bing Webmaster](https://www.bing.com/webmasters).
3. Patienter 2-4 semaines pour les premières indexations. Surveiller le rapport "Couverture" dans Search Console.

**Stratégie de contenu long-terme** : enrichir les pages `/c/:slug` avec :
- Combos détectés
- Bracket Commander moyen
- Liens vers articles de la communauté (à venir)
- Plus la collection de decks publics grandit, plus les pages sont fournies → mécanique vertueuse.

---

## 3. Resend pour les emails (récap mensuel)

**Quoi** : envoi automatique du récap mensuel le 1er de chaque mois à 10h.

**Comment** :
1. Créer un compte sur [resend.com](https://resend.com) (free tier : 100 emails/jour, 3000/mois).
2. Vérifier le domaine `manalab.app` (Resend te donne 3 records DNS — SPF, DKIM, DMARC — à ajouter chez ton registrar).
3. Une fois vérifié, créer une API key sur le dashboard Resend.
4. Configurer sur Vercel (`vercel env add` ou via le dashboard) :
   ```
   RESEND_API_KEY=re_xxxxxxxx
   RESEND_FROM=ManaLAB <noreply@manalab.app>
   DIGEST_SECRET=<token aléatoire long>
   FIREBASE_PROJECT_ID=<ton-projet-id>
   ```
5. Redéployer. Le cron `0 10 1 * *` se déclenche automatiquement le 1er du mois.

**Test manuel** : `curl https://manalab.app/api/digest?token=<DIGEST_SECRET>` doit envoyer un email à tous les users actifs.

**Améliorations futures** :
- Personnaliser le digest par user (cartes ajoutées, decks modifiés, likes reçus) en utilisant Firebase Admin SDK (clé service account dans `FIREBASE_SA` env).
- Ajouter un bouton "Se désabonner" qui set `digestOptOut: true` dans le doc user.

---

## 4. Stripe — abonnement Pro

**Quoi** : permettre aux users de souscrire à ManaLAB Pro (3€/mois ou 24€/an).

**Comment** :
1. Créer un compte sur [stripe.com](https://stripe.com), mode **Test** d'abord.
2. Dans le dashboard Stripe : Produits → Créer un produit "ManaLAB Pro" avec deux prix :
   - 3€/mois récurrent (price_id_monthly)
   - 24€/an récurrent (price_id_yearly)
3. Activer **Customer Portal** (Settings → Billing → Customer portal) pour que les users puissent annuler eux-mêmes.
4. Récupérer la **publishable key** (`pk_test_...`) et la **secret key** (`sk_test_...`).
5. Créer 2 nouvelles edge functions (TODO — pas dans ce repo) :
   - `api/create-checkout-session.js` : reçoit `{plan, uid, email}`, appelle l'API Stripe pour créer une Checkout Session, retourne `{url}` pour rediriger l'utilisateur.
   - `api/stripe-webhook.js` : reçoit les events `checkout.session.completed` et `customer.subscription.updated/deleted`, met à jour `users/{uid}.tier` et `proUntil` dans Firestore.
6. Configurer Stripe env Vercel :
   ```
   STRIPE_SECRET_KEY=sk_test_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   STRIPE_PRICE_MONTHLY=price_xxxxx
   STRIPE_PRICE_YEARLY=price_xxxxx
   ```
7. Dans `index.html`, juste avant `</body>`, ajouter :
   ```html
   <script>window.STRIPE_CONFIGURED=true;window.STRIPE_PUBLIC_KEY='pk_test_xxxxx';</script>
   ```
   (Sans cette ligne, le bouton "S'abonner" affiche un toast amical "Pas encore activé".)
8. Webhook URL à enregistrer dans Stripe Dashboard : `https://manalab.app/api/stripe-webhook`.
9. Passer en mode **Live** quand tout fonctionne en test.

**Skeleton du webhook** (à compléter quand Stripe est ready) :
```js
// api/stripe-webhook.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export const config = { runtime: 'nodejs' };
export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  if (event.type === 'checkout.session.completed') {
    const uid = event.data.object.metadata.uid;
    const sub = await stripe.subscriptions.retrieve(event.data.object.subscription);
    // Update users/{uid}.tier='pro', proUntil=sub.current_period_end*1000 via Firebase Admin
  }
  res.status(200).json({ received: true });
}
```

**Pourquoi 3€/an plutôt que freemium plus complexe** : tu testes le marché. Si personne ne paie 3€, personne ne paiera 9,99€. Si beaucoup paient, tu pourras itérer.

---

## 5. Web Push notifications

**Quoi** : notifier les users hors-app (likes, commentaires, nouveaux decks d'amis, alertes prix).

**Comment** :
1. Générer une paire VAPID :
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Coller la **public key** dans `index.html` juste avant `</body>` :
   ```html
   <script>window.PUSH_PUBLIC_KEY='BFv...la-cle-publique';</script>
   ```
3. Stocker la **private key** dans Vercel env :
   ```
   PUSH_PRIVATE_KEY=KZf...la-cle-privee
   PUSH_SUBJECT=mailto:thibaud.combes31@gmail.com
   ```
4. Créer une edge function `api/push-send.js` qui sera appelée par les triggers Firestore (likes/commentaires) :
   ```js
   import webpush from 'web-push';
   webpush.setVapidDetails(process.env.PUSH_SUBJECT, process.env.PUSH_PUBLIC_KEY, process.env.PUSH_PRIVATE_KEY);
   // Pour chaque sub dans users/{uid}/push_subs, webpush.sendNotification(sub, JSON.stringify({title, body, url}))
   ```
5. Ou utiliser **Firebase Cloud Messaging (FCM)** intégré au reste du stack (plus simple si tu n'as pas envie d'edge functions custom).

L'UI côté client est prête : Ctrl+K → "Notifications push (activer/désactiver)" déclenche `pushSubscribe()` qui demande la permission et stocke la subscription dans Firestore.

---

## 6. Partenariats créateurs MTG francophones

**Pas de code à écrire** — c'est du business dev.

**Cible** : créateurs Magic FR avec entre 1k et 50k followers, pas les très gros (inaccessibles, pas alignés).

**Liste de départ** :
- YouTubers : ManaPirates, Magic Vault, Mistakeur, EDH France, La Tannière du Drake
- Streamers Twitch : LeStreamerDuPlateau, ManaSorcière
- Discord communautés : r/MagicFrance, Discord EDH France, Discord MTG Genève/Lyon/Marseille
- Magasins indé : Sortilèges (Lyon), Le Comptoir des Jeux (Toulouse), Magic Bazar (Paris)

**Pitch type** (1 minute) :
> Bonjour [Prénom], je suis dev d'une app Magic francophone (manalab.app). Elle gère collection, decks, analyse bracket Commander et arène en ligne. C'est gratuit, open-source côté UI. Je cherche 5-10 créateurs FR pour leur offrir un compte Pro à vie en échange d'une mention par mois sur leurs decks/replays. Aucune obligation, aucun deal commercial — juste partager si l'outil te plaît. Tu as 5 minutes pour me dire ce que t'en penses ?

**KPIs à suivre** :
- Inscriptions/mois (avant/après chaque mention)
- Trafic référent depuis YouTube/Twitch (Google Analytics ou Plausible)
- Conversion vers Pro

**Coût** : 0€ direct. Quelques comptes Pro offerts (coût marginal ≈ 0).

---

## 7. Plan global de monétisation à 12 mois

| Mois | Action | Revenu cible | Trafic cible |
|---|---|---|---|
| M1 | Cardmarket Partner + SEO live + Stripe Pro | 50€ | 500 vues/mois |
| M3 | + Resend digest + Push + 3 partenariats | 200€ | 2000 vues/mois |
| M6 | + 10 partenariats + 50 abonnés Pro | 500€ | 10k vues/mois |
| M12 | + indexation SEO mature + 200 Pro | 2000€ | 50k vues/mois |

À ce niveau (M12 : ~2k€/mois revenus), ManaLAB devient un side-project viable sans concurrencer un emploi. Au-delà, il faut décider : recruter / passer en produit principal, ou plafonner et garder en passive.

---

## Checklist déploiement final

Avant de pousser en prod :
- [ ] `firebase deploy --only firestore:rules` (les nouvelles règles social_notifs/public_decks)
- [ ] Créer les index Firestore composites (voir FIRESTORE_SETUP.md)
- [ ] `vercel --prod` pour pousser le code
- [ ] `vercel env add` pour toutes les clés ci-dessus
- [ ] Submit sitemap à Google Search Console
- [ ] Valider domaine Resend (DNS records)
- [ ] Tester le flux complet : inscription → publication deck → like depuis un autre compte → vérifier la notif Firestore + l'email digest manuellement
