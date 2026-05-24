// @ts-check
const { test, expect } = require('@playwright/test');

// Encodage minimal (réplique _shareEncodeDeck côté client)
function encodeShare(data) {
  const json = JSON.stringify(data);
  const utf8 = unescape(encodeURIComponent(json));
  // base64
  const b64 = Buffer.from(utf8, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

test.describe('Partage de deck par lien public', () => {
  test('ouvre un deck encodé sans nécessiter de connexion', async ({ page }) => {
    const deck = {
      n: 'Test Deck Atraxa',
      f: 'commander',
      c: { n: 'Atraxa, Praetors\' Voice' },
      l: '1 Atraxa, Praetors\' Voice\n1 Sol Ring\n1 Arcane Signet\n10 Forest',
      co: ['W', 'U', 'B', 'G']
    };
    const enc = encodeShare(deck);
    await page.goto(`/?share=${enc}`);
    await expect(page.locator('#shared-deck-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.shared-title')).toHaveText('Test Deck Atraxa');
    // Commandant affiché
    await expect(page.locator('.shared-chip-cmd')).toContainText('Atraxa');
    // Section avec 4 cartes
    const sections = await page.locator('.shared-sec').count();
    expect(sections).toBeGreaterThanOrEqual(1);
  });

  test('lien invalide ne crash pas', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/?share=invalid_payload!!!');
    // L'app doit charger normalement
    await expect(page.locator('body')).toBeVisible();
    // L'overlay partagé ne s'affiche pas
    await expect(page.locator('#shared-deck-overlay')).not.toBeVisible();
    // Aucune erreur JS non-catchée
    expect(errors.filter(e => !e.includes('Firebase'))).toHaveLength(0);
  });

  test('métas OG mises à jour côté client', async ({ page }) => {
    const deck = { n: 'Sol Ring Test', f: 'modern', c: { n: 'Sol Ring' }, l: '', co: [] };
    const enc = encodeShare(deck);
    await page.goto(`/?share=${enc}`);
    await page.waitForTimeout(500);
    const title = await page.title();
    expect(title).toContain('Sol Ring Test');
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('Sol Ring Test');
  });
});
