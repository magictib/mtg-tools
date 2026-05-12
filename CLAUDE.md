# MTG Tools — Contexte projet pour Claude Code

## Description
Application web single-file (index.html) de gestion de collection Magic: The Gathering.

## Structure
- `index.html` — toute l'application (HTML + CSS + JS dans un seul fichier)
- Pas de framework, pas de build tool, vanilla JS uniquement
- Données utilisateur dans Firebase Firestore ; localStorage en cache secondaire

## Profils
- Utilisateur principal : Thibaud (compte Firebase authentifié)
- Autres profils : amis Firebase (système d'amis dans l'app)
  - Seul utilisateur ami actif : **Gérébite**
  - Les anciens profils "Gérémy", "Antoine", "test" étaient des comptes de test, ne plus s'y référer
- `profs[0]` = collection du user connecté (slot Firebase)
- `profs[1..n]` = collections des amis chargés via `_epSlots[ctx]`
- `PN[]` = noms affichés (PN[0] = user, PN[1..n] = amis)
- Clé localStorage (legacy, slot 0 uniquement) : `mtg_profs`
- Clé localStorage : `mtg_decks` (objet {id: deck})

## Fonctionnalités
1. **Convertisseur CSV** : CardNexus (A) ↔ Mythic Tools (B) ↔ Moxfield (C)
2. **Scryfall** : recherche carte via API publique
3. **Deck Manager** : création/sauvegarde decks par profil, comparaison possession

## API utilisées
- Scryfall : https://api.scryfall.com (publique, pas de clé)
- Google Fonts : Cinzel + Crimson Pro

## Lancer en local
Ouvrir index.html avec Live Preview (extension VS Code) ou via Python :
`python -m http.server 7432`
Puis ouvrir http://localhost:7432
