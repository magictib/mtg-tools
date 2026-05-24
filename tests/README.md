# Tests E2E ManaLAB

Playwright. Pas de framework lourd : 5 fichiers de tests qui couvrent les parcours critiques sans authentification (les tests authentifiés nécessitent un compte de test Firebase + mock).

## Installation

```bash
cd tests
npm install
npm run install-browsers   # télécharge Chromium (~150 Mo)
```

## Lancer

```bash
# Tous les tests
npm test

# Avec UI graphique
npm run test:ui

# Voir les navigateurs s'ouvrir
npm run test:headed

# Mode debug pas-à-pas
npm run test:debug

# Cible un test précis
npx playwright test landing.spec.js
```

Par défaut le serveur est lancé via `python -m http.server 7432` automatiquement. Si tu utilises Live Preview de VS Code, change le port dans `playwright.config.js`.

## Couverture actuelle

- `landing.spec.js` : 4 tests — landing publique, switch FR/EN, footer légal, démo deck
- `share.spec.js` : 3 tests — lien partagé valide/invalide, métas OG dynamiques
- `legal.spec.js` : 5 tests — pages CGU/mentions/privacy + contenu RGPD
- `a11y.spec.js` : 4 tests — lang attribute, ARIA, Escape, focus visible
- `seo.spec.js` : 3 tests — titres/OG, robots.txt, manifest.json

**Total : 19 tests**. Lance < 30 secondes en local.

## À ajouter (à mesure des features)

- [ ] Tests authentifiés (inscription, login, création deck, publication, like) — nécessite Firebase emulator suite
- [ ] Tests visuels (snapshot screenshots des overlays)
- [ ] Tests performance (Lighthouse CI intégré)
- [ ] Tests sur Firefox + WebKit (currently Chromium + iPhone seulement)

## CI/CD

Pour faire tourner dans GitHub Actions, ajouter `.github/workflows/test.yml` :

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    timeout-minutes: 15
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: cd tests && npm ci
      - run: cd tests && npx playwright install --with-deps chromium
      - run: cd tests && npm test
        env: { CI: true }
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: tests/playwright-report
```

## Helpers utiles

Le fichier `share.spec.js` montre comment reproduire `_shareEncodeDeck` côté test pour générer des liens valides. Pour les tests authentifiés futurs, on pourra :
- Bypasser l'auth via injection dans `localStorage`
- Ou utiliser Firebase emulator (`firebase emulators:start`)
