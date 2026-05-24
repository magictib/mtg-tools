# Setup Firestore pour les nouvelles fonctionnalités

Les chantiers récents (decks publics, explorer, likes, commentaires, profil public, recos communauté, follow system, notifications sociales) reposent sur la collection Firestore `public_decks` et sur deux sous-collections de `users/`.

**Statut actuel** : `firestore.rules` a été patché pour inclure tous les blocs nécessaires. Tu peux déployer directement avec `firebase deploy --only firestore:rules`.

## 1. Schéma de données

### `public_decks/{deckId}`
Doc plat, lecture publique. Champs :

```
createdBy: string (uid auteur)
ownerName: string (nom affiché de l'auteur)
name, format, commander: string
colors: array<string>      // ex: ['W','U','B']
cardCount: int
rawName: string             // liste brute "1 Card name\n2 Other\n..."
isPublic: true
likes: int                  // compteur
likedBy: array<uid>         // qui a liké
comments: array<{id, uid, name, text, ts}>  // commentaires inline
createdAt, updatedAt: timestamp
```

**Pourquoi inline ?** Les règles Firestore préexistantes du projet permettent à n'importe quel user connecté d'updater `likes` et `comments` sans toucher au reste du doc (clause `affectedKeys().hasOnly(['likes','likedBy','comments'])`). Pas de sous-collections séparées à gérer.

### `users/{uid}/social_notifs/{notifId}`
Notifications de likes, commentaires, follows, nouveaux decks d'amis.

```
ts: timestamp
read: bool
fromUid, fromName: string
kind: 'like' | 'comment' | 'follow' | 'new_deck'
deckId, deckName, text: string (selon le kind)
```

Création par n'importe quel user connecté à condition que `fromUid == request.auth.uid` et `kind` ∈ liste autorisée. Lecture/update/delete par le destinataire uniquement.

### `users/{me}/follows/{targetUid}` et `users/{target}/followers/{fromUid}`
Symétriques. Écrits en batch côté client. Couverts par la règle générique `users/{uid}/{subcollection}/{doc}` existante (pas de bloc dédié nécessaire).

## 2. Règles Firestore

Les règles sont **déjà dans `firestore.rules`** (vérifiées au [scroll de la section public_decks](firestore.rules)). Résumé :

- `public_decks/{id}` :
  - lecture publique
  - create : `createdBy == auth.uid`
  - delete : créateur OU admin
  - update : créateur OU admin OU si seuls les champs `likes`/`likedBy`/`comments` sont touchés

- `users/{uid}/social_notifs/{id}` :
  - read/update/delete : destinataire uniquement
  - create : tout user connecté, à condition que `fromUid == auth.uid` et `kind` ∈ liste valide

- `users/{me}/follows/*` et `users/{target}/followers/*` : couverts par la règle générique des sous-collections de `users`.

## 3. Déployer les règles

```bash
firebase deploy --only firestore:rules
```

## 4. Index Firestore requis

À créer une fois dans la console Firebase (Firestore → Index) — ou laisser l'erreur de la console JS proposer un lien direct au premier appel.

| Collection | Champs | Sens |
|---|---|---|
| `public_decks` | `createdBy` (asc) + `updatedAt` (desc) | Profil public d'un user |
| `public_decks` | `commander` (asc) | Recos communauté |
| `users/{uid}/social_notifs` | `read` (asc) + `ts` (desc) | Compteur de notifs non lues |
| `users/{uid}/social_notifs` | `ts` (desc) | Affichage de l'historique |

Les requêtes single-field (`orderBy('updatedAt', 'desc').limit(40)` pour l'explorer) n'ont pas besoin d'index composite.

## 5. Utilisation côté UI

- **Publier un deck** → bouton `🔒 Privé / 🌐 Public ✓` sur la page deck (apparaît quand un deck est chargé).
- **Explorer** → bouton `🌐 Explorer` sur le home, ou Ctrl+K → "Explorer".
- **Profil public** → Ctrl+K → "Mon profil public", ou clic sur un nom dans la vue d'un deck partagé. URL directe : `?u=UID`.
- **Recos communauté** → Ctrl+K → "Recos communauté (par commandant)". Demande > 2 decks publics avec le même commandant pour fonctionner.
- **Suivre un utilisateur** → bouton "+ Suivre" sur la page profil public.
- **Notifications sociales** → cloche dorée flottante en bas à droite (badge si non lues), ou Ctrl+K → "Notifications sociales". Couvre likes, commentaires, follows, nouveaux decks d'un user suivi.
- **Modération admin** → si `users/{toi}.role == 'admin'`, un bouton 🛡 Retirer apparaît dans la vue d'un deck public, et tu peux supprimer n'importe quel commentaire (pas seulement les tiens).

## 6. OG dynamique (Vercel)

Le fichier `api/share.js` est une edge function Vercel. Pour que les liens partagés affichent un aperçu correct dans Discord/Twitter/Facebook :

1. Déployer le projet sur Vercel (`vercel --prod`).
2. Le `vercel.json` réécrit déjà `/s/:enc` → `/api/share?s=:enc`.
3. Le bouton "Partager" génère automatiquement `/s/<enc>` quand on est sur un domaine HTTPS non-localhost.

Tester avec [opengraph.xyz](https://www.opengraph.xyz/) : entrer une URL `/s/...` doit montrer le nom du deck et l'art du commandant.

## 7. Modération

- Le propriétaire d'un deck peut supprimer **tout** commentaire sur son deck.
- L'auteur d'un commentaire peut supprimer son propre commentaire.
- Un admin (`users/{uid}.role == 'admin'`) peut :
  - supprimer n'importe quel deck public (bouton 🛡 Retirer)
  - supprimer n'importe quel commentaire
  - update un deck public d'autrui (changer un champ inapproprié)
- Pour retirer son propre deck public : depuis la page deck, cliquer "🌐 Public ✓" pour repasser en privé. Le doc est supprimé de la collection.

## 8. Coûts Firestore

Estimations à 100 utilisateurs actifs, ~5 decks publics chacun :

- Lectures : 500 decks publics × 10 ouvertures explorer/jour = 5 000 reads/jour → free tier (50k/jour).
- Écritures : likes + commentaires + publications + notifs, < 2k/jour facilement.
- Storage : ~12 KB par deck public (rawName ~10 KB + comments inline + likedBy array) → 6 MB pour 500 decks. Négligeable.

À 10k utilisateurs, surveiller :
- Le compteur `likedBy` croît dans le doc parent (1 KB pour 30 likes). Au-delà de quelques centaines de likes par deck, il faudrait dénormaliser dans une sous-collection. Mais on est très loin de cette limite.
- L'array `comments` est plafonné à 500 chars par texte. Si un deck devient très populaire (>50 commentaires), envisager une sous-collection. À traiter le moment venu.
