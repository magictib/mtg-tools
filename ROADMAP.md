# ROADMAP — De "scaffold qui compile" à "produit qui mérite d'être référence"

## Préambule honnête

Les sessions précédentes ont **empilé du scaffold** : des fonctions qui marchent en démo, des intégrations préparées mais pas branchées, des règles Firestore théoriquement valides mais jamais testées en charge. Le code passe la validation syntaxique, ça ne veut pas dire qu'il passe la réalité.

L'estimation initiale de "14 semaines" couvrait une V1 acceptable. **Pour un produit qui devient référence**, le travail réel est plutôt :

- **Phase 1 — Solid Foundation** : 6-8 semaines
- **Phase 2 — Activation & Acquisition** : 6-10 semaines
- **Phase 3 — Monétisation complète** : 4-6 semaines
- **Phase 4 — Scaling & Resilience** : 8-12 semaines
- **Phase 5 — Excellence continue** : permanent

Soit **6 à 12 mois à temps plein** pour atteindre un standard "Moxfield-grade" tout en gardant ta différenciation. Et encore — ça suppose que tu ne dévies pas du plan.

Ce document liste **tout ce qui n'est pas vraiment fait**, organisé par phase, avec estimation jour-homme et critère de "fait". Si tu y passes 2h/jour en soirée, multiplie par 3-4 le temps calendaire.

Légende :
- ❌ Pas fait du tout
- 🚧 Scaffold/ébauche, à finir
- ⚠️ Fonctionne mais à durcir/tester
- ✅ Fait correctement

---

## Phase 1 — Foundation (avant d'ouvrir aux utilisateurs)

Tu ne peux pas inviter 100 personnes tant que ce niveau n'est pas solide.

### 1.1 ⚖️ Légal & RGPD (obligatoire dès le premier euro)
**État : ❌**
- [ ] Page CGU (conditions d'utilisation) — modèle juriste ou template solide
- [ ] Page politique de confidentialité (RGPD-compliant)
- [ ] Mentions légales (éditeur, hébergeur Vercel/Firebase, contact)
- [ ] Cookie banner si analytics (Plausible/Umami sont sans cookies, GA4 oui)
- [ ] Process suppression de compte (déjà partiellement en place — vérifier qu'on supprime *tout* : public_decks, comments, follows)
- [ ] Email RGPD pour les demandes d'export/suppression de données
- [ ] Bandeau "données stockées en UE" si tu veux jouer sur l'argument vs US

**Estimation : 3-5 jours** (rédaction + intégration)
**Bloquant pour** : monétisation Stripe (Stripe refuse les comptes sans CGU)

### 1.2 🧾 Statut juridique & comptabilité
**État : ❌**
- [ ] Création micro-entreprise (auto-entrepreneur) — gratuit, en ligne
- [ ] Compte bancaire pro séparé (obligatoire au-delà de 10k€/an de CA)
- [ ] Plan comptable simple (Tiime, Indy, ou Google Sheet)
- [ ] Activation TVA si CA > 36 800€/an (pas urgent)
- [ ] Stripe Tax pour gérer la TVA EU sur les abonnements (Stripe le fait automatiquement)

**Estimation : 2-3 jours**

### 1.3 🔒 Sécurité applicative
**État : 🚧**
- [ ] Audit règles Firestore complet (notamment les sous-collections users/{uid}/* — la règle générique est-elle assez stricte ?)
- [ ] Rate limiting : Cloudflare ou Firebase App Check sur les writes Firestore
- [ ] reCAPTCHA / hCaptcha sur inscription (anti-bots)
- [ ] Validation côté serveur : Firebase Cloud Functions pour valider les paramètres avant write (taille texte, format colors, etc.)
- [ ] CSP (Content Security Policy) dans les headers HTML
- [ ] Audit XSS : tu fais beaucoup de `innerHTML` — vérifier que `esc()` est *toujours* appliqué sur les données utilisateur
- [ ] HTTPS strict (Vercel le fait) + HSTS header
- [ ] Backup Firestore quotidien automatique (gcloud firestore export sur Cloud Scheduler)

**Estimation : 5-8 jours**
**Risque** : tu vas trouver des trous. Plusieurs.

### 1.4 🐛 Tests automatisés des helpers critiques
**État : ❌**
- [ ] Setup Vitest ou Jest (même en single-file, on peut extraire les helpers en bloc testable)
- [ ] Tests `_anaWhoOwns`, `_deckCoverage`, `_recoCommanders`, `_shareEncodeDeck/Decode`, `cmLink`, `_ptStart`, `_anaDetectCombos`, helpers de tags/wishlist
- [ ] Tests E2E Playwright sur 5 parcours clés :
  - Inscription → ajout carte → création deck
  - Publication deck → like depuis autre compte → notif reçue
  - Lien partagé → fork → deck dans le compte
  - Wishlist → ami a la carte → badge visible
  - Switch FR↔EN persistant après refresh
- [ ] CI GitHub Actions : tests à chaque push

**Estimation : 8-12 jours**

### 1.5 📊 Monitoring & observability
**État : ❌**
- [ ] Sentry pour erreurs front (free tier suffit jusqu'à 5k events/mois)
- [ ] Analytics Plausible ou Umami (no-cookie, RGPD-friendly) — gratuit self-hosted ou ~6€/mois cloud
- [ ] Uptime monitor : UptimeRobot ou Better Stack (gratuit)
- [ ] Alertes Firebase budget (avant d'exploser le free tier en silence)
- [ ] Dashboard interne : nombre d'inscrits, decks publics, alertes prix, Pro actifs
- [ ] Funnel analytics : où les nouveaux users abandonnent

**Estimation : 4-6 jours**

### 1.6 📱 Audit mobile + accessibilité
**État : ❌**
- [ ] Audit Lighthouse sur les 5 écrans principaux (cible : >90 perf, >95 a11y)
- [ ] Test manuel iPhone SE (375×667) et iPhone 14 Pro Max (430×932)
- [ ] Test Android Chrome
- [ ] ARIA labels sur tous les boutons icon-only (il y en a ~50)
- [ ] Focus traps dans les overlays (~20 overlays récents)
- [ ] Keyboard navigation : Tab visible, Esc ferme partout, Enter soumet
- [ ] Contrast ratio WCAG AA sur les gris sur fond noir (certains failent)
- [ ] Screen reader pass : NVDA ou VoiceOver, parcours inscription + ajout deck
- [ ] Touch targets ≥44×44px (audit des petits boutons 🏷, ✕, etc.)

**Estimation : 6-10 jours**

### Total Phase 1 : **28-44 jours-homme**, soit **6-9 semaines à plein temps**

---

## Phase 2 — Activation & Acquisition

### 2.1 🌐 SEO production-ready
**État : 🚧 (scaffold dans api/c.js)**
- [ ] Mapping nom officiel ↔ slug canonique (ex: "Atraxa, Praetors' Voice" ↔ "atraxa-praetors-voice") — table dans Firestore, peuplée depuis Scryfall
- [ ] Pages `/c/:slug` enrichies :
  - Bracket Commander moyen (calculé sur les decks publics)
  - Courbe de mana moyenne
  - Combos détectés
  - Cross-link vers commandants similaires (CI + thème)
  - Hreflang FR/EN avec versions /en/c/:slug
  - Schema.org Article + ItemList + BreadcrumbList
- [ ] Pages `/combo/:slug` (Dramatic Scepter + Isochron, etc.)
- [ ] Pages `/meta/:format` (Standard, Modern, EDH)
- [ ] Pages `/card/:slug` (synergies, decks qui jouent cette carte, prix historique)
- [ ] Génération automatique du sitemap (déjà fait, mais à enrichir avec combos/cards)
- [ ] OG image générée dynamiquement avec Vercel OG ou Satori (composition logo + commander art + nom du deck) — actuellement on prend juste l'art_crop Scryfall direct
- [ ] Submit Google + Bing Webmaster
- [ ] Surveillance positions SEO (Ahrefs/Semrush ou gratuit Search Console)

**Estimation : 10-15 jours**
**ROI** : 0 à 8 semaines (le temps que Google crawle), puis compound

### 2.2 👋 Onboarding optimisé
**État : 🚧 (5 étapes statiques)**
- [ ] Variantes selon le profil (a une coll vs n'a rien)
- [ ] Persistance de la progression (peut quitter et reprendre)
- [ ] Animation de fin (confetti minimal, pas Cookie Clicker)
- [ ] Analytics : % complétion par étape, abandon où
- [ ] A/B test : avec onboarding vs sans (mesurer D1 retention)
- [ ] Email J+1 si l'user n'a pas ajouté de carte : "Voici 3 façons d'importer ta collec"
- [ ] Email J+7 si l'user n'a pas créé de deck : suggestions de decks selon sa coll

**Estimation : 5-8 jours**

### 2.3 📨 Email digest production-ready
**État : 🚧 (edge function générique)**
- [ ] Firebase Admin SDK pour stats personnelles par user (cartes ajoutées, decks modifiés, likes reçus, parties jouées)
- [ ] Template HTML responsive (Mailchimp Email Designer ou MJML)
- [ ] Test sur Litmus ou Email on Acid (Gmail, Outlook, Apple Mail, mobile)
- [ ] Lien unsubscribe one-click (RFC 8058)
- [ ] DKIM/SPF/DMARC + warm-up domaine (envoyer progressivement de 10/jour à 1000/jour sur 4-6 semaines)
- [ ] Tracking ouverture/clic (Resend le fait)
- [ ] Variante "ré-engagement" : si user inactif depuis 30j

**Estimation : 6-10 jours**

### 2.4 🔔 Push notifications complètes
**État : 🚧 (subscribe OK, send manquant)**
- [ ] `api/push-send.js` : endpoint qui prend uid + payload, lit push_subs, envoie via `web-push`
- [ ] Trigger automatique : Cloud Function Firebase qui écoute les writes dans social_notifs et appelle push-send
- [ ] Gestion des subscriptions expirées (HTTP 410 → delete sub)
- [ ] Préférences user : choisir quels types de notifs (likes / comments / follows / new_deck)
- [ ] Frequency cap : max 3 push/jour pour ne pas spammer
- [ ] Test cross-browser (Chrome, Firefox, Safari iOS — Safari iOS depuis iOS 16.4)

**Estimation : 5-8 jours**

### 2.5 🎁 Programme parrainage
**État : ❌**
- [ ] Lien unique par user `?ref=UID` (à intégrer dans l'invite ami existante)
- [ ] Tracking : parrainage compté quand le parrainé crée son 1er deck
- [ ] Récompense : X Pétales de Lotus + 1 mois Pro offert au parrain + 1 mois Pro au parrainé
- [ ] Anti-fraude basique (même IP, même device, comptes créés en chaîne)
- [ ] Dashboard "Mes parrainages"

**Estimation : 4-6 jours**

### 2.6 🤝 Partenariats créateurs MTG FR
**État : ❌ (liste fournie, pas contactés)**
- [ ] Identifier 15-20 créateurs (YouTube, Twitch, Discord, magasins)
- [ ] Pitch personnalisé pour chacun
- [ ] Setup tracking referrer pour mesurer l'impact de chaque mention
- [ ] Offrir compte Pro à vie + customisation profil
- [ ] Re-pitcher tous les 3 mois avec les nouveautés

**Estimation : continu, 1-2 jours/mois**

### Total Phase 2 : **30-47 jours-homme**, soit **6-10 semaines à plein temps**

---

## Phase 3 — Monétisation complète

### 3.1 💳 Stripe production-ready
**État : 🚧 (UI prête, backend doc seulement)**
- [ ] `api/create-checkout-session.js` — code complet, gestion des erreurs, retour URL custom
- [ ] `api/stripe-webhook.js` — signature verify, idempotency, gestion de tous les events :
  - `checkout.session.completed` → activer Pro
  - `customer.subscription.updated` → maj proUntil
  - `customer.subscription.deleted` → désactiver Pro
  - `invoice.payment_failed` → email "moyen de paiement à jour"
  - `customer.subscription.trial_will_end` → si trial activé
- [ ] Firebase Admin SDK côté webhook pour update sécurisé `users/{uid}.tier`
- [ ] Stripe Customer Portal intégré (lien dans paramètres pour annuler/changer carte)
- [ ] Page "Mon abonnement" avec : plan, prochaine facture, historique, lien portal
- [ ] Stripe Tax activé (TVA EU automatique)
- [ ] Mode Test → tester 10 scénarios : nouveau sub, upgrade, downgrade, cancel, échec paiement, refund, dispute
- [ ] Passage en mode Live + premier paiement réel
- [ ] Notifications par email à chaque event (paiement OK, échec, annulation)

**Estimation : 8-12 jours**

### 3.2 ❖ Features Pro réellement implémentées
**État : 🚧 (UI annonce, code partiel)**

Sur les 8 features Pro annoncées :

- [ ] **Analyse IA en langage naturel** : NON IMPLÉMENTÉ
  - Choix API (Claude Sonnet est le sweet spot qualité/prix)
  - Prompt avec contexte deck (cartes, format, bracket, themes)
  - Coûts à modéliser (~0.05€ par analyse → marge fine à 3€/mois si user en lance 60)
  - Rate limit : max 20 analyses/mois en Pro
  - Cache des résultats (hash du deck → réponse)
  - Fallback texte si l'API échoue
  - **Estimation : 5-8 jours**

- [ ] **Alertes prix illimitées** : ✅ gate fait
- [ ] **Snapshots illimités** : ⚠️ gate à coder (limite actuelle 5, helper à ajouter)
- [ ] **Decks privés illimités** : ❌ logique à coder (free > 3 privés → force isPublic=true)
- [ ] **Customisation profil public** : ❌ pas implémenté du tout (bannière, thème, signature)
- [ ] **Export PDF stylé** : ❌ pas implémenté (jsPDF + template ou Puppeteer serveur)
- [ ] **Sans liens affiliés** : ❌ à coder (hide les boutons 🛒 CM si isPro())
- [ ] **Badge ❖ Pro visible** : ❌ à afficher sur les commentaires + profil public + cmd palette

**Estimation totale features Pro : 15-22 jours**

### 3.3 🛒 Cardmarket affiliation étendue
**État : ⚠️ (déjà branché 2 endroits, beaucoup d'autres possibles)**
- [ ] Bouton "🛒 CM" sur la page deck (cartes manquantes individuelles)
- [ ] Sur la page Scryfall (un produit affiché)
- [ ] Sur les alertes prix : "Acheter au seuil"
- [ ] Sur les recos communauté
- [ ] Sur les imports CSV : "Compléter via CM"
- [ ] Dashboard interne : revenus mensuels par lien
- [ ] Inscription effective au programme + tag configuré

**Estimation : 2-3 jours + délai validation Cardmarket**

### Total Phase 3 : **25-37 jours-homme**, soit **5-7 semaines**

---

## Phase 4 — Scaling & Resilience

### 4.1 ⚡ Performance
**État : ⚠️**
- [ ] Audit Lighthouse : 2.2 MB de JS dans une seule page, Largest Contentful Paint probablement >3s
- [ ] Splitter le JS : extraire les fonctionnalités secondaires (proxys, banlist, conv) en chunks chargés à la demande
  - **Mais** : single-file est une décision projet. Si tu veux garder, optimiser autrement.
- [ ] Lazy-load images Scryfall (déjà partiel avec `loading="lazy"`)
- [ ] Preconnect/preload polices Google
- [ ] CSS critique inlined
- [ ] Service worker cache strategy plus agressive sur les assets statiques
- [ ] HTTP/2 push (Vercel le fait)
- [ ] Brotli compression (Vercel le fait)
- [ ] Audit bundle : combien de bytes utilisés réellement par les fonctions ? Probablement 30% du code n'est jamais exécuté par 80% des users.

**Estimation : 8-15 jours**

### 4.2 🌍 i18n complet
**État : ⚠️ (387 clés, beaucoup de FR statique restant)**
- [ ] Audit complet : extraire toutes les chaînes FR restantes (script qui grep et propose)
- [ ] Compléter à ~1500-2000 clés EN
- [ ] Traduction EN par un natif (Fiverr ~200€ ou demande à un ami bilingue)
- [ ] Gestion plurals (Intl.PluralRules)
- [ ] Format dates/nombres selon locale (déjà toLocaleDateString partiellement)
- [ ] Switch hreflang sur les pages SEO
- [ ] Ouvrir à d'autres langues si demande (ES, DE, IT — Magic FR n'est que 10% du marché EU)

**Estimation : 10-15 jours** (sans la traduction native)

### 4.3 🧰 Modération & confiance communauté
**État : 🚧**
- [ ] Système de report user (deck inapproprié, commentaire insultant)
- [ ] File de modération pour l'admin
- [ ] Auto-modération : filtre mots-clés sur les commentaires (liste de termes interdits)
- [ ] Bans temporaires avec raison + délai
- [ ] CGU mises à jour avec règles communauté
- [ ] Système d'appel pour les bannis

**Estimation : 5-8 jours**

### 4.4 📈 A/B testing infrastructure
**État : ❌**
- [ ] Framework simple maison (GrowthBook self-hosted ou maison)
- [ ] Variations sur : page d'accueil, onboarding, prix Pro, copy CTA
- [ ] Mesure conversion par variant
- [ ] Tests stat significatifs avant conclusion

**Estimation : 5-8 jours**

### 4.5 🚨 Disaster recovery
**État : ❌**
- [ ] Backup Firestore quotidien automatique (gcloud firestore export)
- [ ] Test de restauration trimestriel (sinon le backup ne sert à rien)
- [ ] Plan B si Firebase down : message "service temporairement indisponible" cohérent
- [ ] Statuspage publique (Better Uptime gratuit)

**Estimation : 3-5 jours**

### Total Phase 4 : **31-51 jours-homme**, soit **6-10 semaines**

---

## Phase 5 — Excellence continue (chantier permanent)

### 5.1 📝 Contenu / community
- [ ] Blog devlog (~1 article/mois) — bon pour SEO et confiance
- [ ] Discord ManaLAB officiel
- [ ] Compte X/Twitter actif (annonces features, decks à l'honneur)
- [ ] Guides "Comment construire un Atraxa", "10 combos méconnus", etc. (référence + SEO)
- [ ] Newsletter mensuelle (différente du digest perso)
- [ ] Sondages users (Typeform) pour orienter la roadmap

**Effort : 1-2 jours/mois**

### 5.2 🎯 Features secondaires manquantes
Listées en vrac, à prioriser selon demande user :
- Diff visuel cross-deck (comparateur)
- Tournament tracker (rounds, opponents, rématches)
- Cube builder
- Tag templates partagés communauté
- Brawl/Pioneer/Modern méta importé depuis MTGTop8
- Marketplace P2P (gros chantier, pas avant N1 utilisateurs)
- API publique (avec auth + rate limit)
- Webhook user (notif Discord/Slack quand quelqu'un like ton deck)

### 5.3 🔁 Itération
- Lire les feedbacks users chaque semaine
- Tracker la North Star Metric (decks créés/semaine ? Pro actifs ? probablement "DAU x decks publics créés")
- Tuer les features inutilisées (les Pétales sont utilisées par combien de gens ?)
- Refactor incrémental du code (40k lignes vanilla — un jour il faudra moduler)

---

## Grille de priorité honnête (si tu n'as que 4h/semaine)

Si tu ne peux pas tout faire, voici l'ordre :

**Avant TOUT** :
1. **CGU + RGPD** (3-5j) — pas négociable, bloquant pour ouvrir aux gens et pour Stripe
2. **Backup quotidien Firestore** (½ jour) — risque catastrophe sinon
3. **Audit règles Firestore** (2-3j) — risque sécurité sinon
4. **Sentry + Plausible** (1j) — tu codes en aveugle sans

**Pour ouvrir aux utilisateurs (50 invités)** :
5. **Audit mobile + accessibilité** (5j)
6. **Tests E2E des 5 parcours clés** (4-6j)
7. **Email digest perso avec Firebase Admin SDK** (4-6j)

**Pour monétiser** :
8. **Stripe webhook production** (5-8j)
9. **Compte micro-entreprise** (½ jour)
10. **Au moins 3 features Pro vraiment codées** (analyse IA + decks privés gate + bannière profil) (~10j)

**Pour croître** :
11. **SEO `/c/:slug` enrichi + sitemap** (5-8j)
12. **Contacter 5 créateurs MTG FR** (1j × 5)

**Tout le reste** peut attendre.

---

## Estimation totale honnête

| Phase | Jours-homme | Calendaire (plein temps) | Calendaire (4h/semaine) |
|---|---|---|---|
| Phase 1 | 28-44 | 6-9 semaines | 7-11 mois |
| Phase 2 | 30-47 | 6-10 semaines | 8-12 mois |
| Phase 3 | 25-37 | 5-7 semaines | 6-9 mois |
| Phase 4 | 31-51 | 6-10 semaines | 8-13 mois |
| Phase 5 | continu | continu | continu |
| **Total V1-V4** | **114-179 jours** | **6-9 mois** | **2-3 ans** |

À 4h/semaine, atteindre "produit de référence stable et monétisable" demande **2-3 ans**. À 20h/semaine, **1 an**. À temps plein, **6-9 mois**.

Mes estimations précédentes ("14 semaines") étaient en réalité pour avoir **un MVP qui peut accueillir 50 utilisateurs** — pas un produit de référence. C'est légitime de viser le MVP d'abord et d'itérer ensuite, mais soyons clairs sur l'écart.

---

## Recommandation finale

Ne vise PAS la perfection sur tous les axes. Choisis un **MVP volontairement étroit** :

1. Focus sur **un seul format** d'abord (Commander/EDH, c'est ton public principal en FR)
2. Lance avec **CGU + monitoring + monétisation** seulement (Phases 1.1, 1.5, 3.1 minimum)
3. Ouvre à **50 beta testeurs** invités personnellement
4. Itère selon leurs retours pendant 3 mois
5. Décide ensuite : passer en public ou rester niche

Tout ce que tu n'as pas validé avec des utilisateurs réels est de la spéculation. Le code peut être parfait — si personne ne s'en sert, c'est zéro. Si beaucoup s'en servent, leurs feedbacks t'éviteront 50% du travail listé ci-dessus (parce qu'ils te diront ce qui les bloque vraiment, pas ce que toi tu imagines).

Bonne route.
