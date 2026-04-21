# MTG Tools — Contexte projet pour Claude Code

## Description
Application web single-file (index.html) de gestion de collection Magic: The Gathering.

## Structure
- `index.html` — toute l'application (HTML + CSS + JS dans un seul fichier)
- Pas de framework, pas de build tool, vanilla JS uniquement
- Données stockées dans localStorage du navigateur

## Profils
- 3 profils fixes : Thibaud, Gérémy, Antoine
- Clé localStorage : `mtg_profs` (tableau de 3 éléments)
- Clé localStorage : `mtg_decks` (objet {id: deck})

## Fonctionnalités
1. **Convertisseur CSV** : CardNexus (A) ↔ Mythic Tools (B) ↔ Moxfield (C)
2. **Scryfall** : recherche carte via API publique
3. **Deck Manager** : création/sauvegarde decks par profil, comparaison possession

## Bugs connus à corriger
- Comparatif possession deck : colonnes affichent ✗ même si cartes présentes dans profil
- Bouton "Nouveau deck" manquant dans l'éditeur (2e encadré)

## API utilisées
- Scryfall : https://api.scryfall.com (publique, pas de clé)
- Google Fonts : Cinzel + Crimson Pro

## Lancer en local
Ouvrir index.html avec Live Preview (extension VS Code) ou via Python :
`python -m http.server 7432`
Puis ouvrir http://localhost:7432
