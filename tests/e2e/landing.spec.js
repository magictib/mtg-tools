// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Landing publique (non connecté)', () => {
  test('affiche les 4 piliers produit', async ({ page }) => {
    await page.goto('/');
    // Auth overlay doit être visible
    await expect(page.locator('#auth-overlay')).toBeVisible();
    // Les 4 cartes features doivent être présentes
    const features = await page.locator('.lp-feat').count();
    expect(features).toBeGreaterThanOrEqual(4);
    // Le titre ManaLAB visible
    await expect(page.locator('.lp-h1')).toContainText('Mana');
  });

  test('switch FR → EN met à jour le tagline', async ({ page }) => {
    await page.goto('/');
    const tagFr = await page.locator('.lp-tag').textContent();
    // Switch lang via localStorage (le sélecteur UI nécessite le hub)
    await page.evaluate(() => {
      localStorage.setItem('mtg_lang', 'en');
      location.reload();
    });
    await page.waitForLoadState('domcontentloaded');
    const tagEn = await page.locator('.lp-tag').textContent();
    expect(tagEn).not.toBe(tagFr);
    expect(tagEn?.toLowerCase()).toContain('magic');
  });

  test('liens légaux présents dans le footer landing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/legal/cgu.html"]')).toBeVisible();
    await expect(page.locator('a[href="/legal/mentions.html"]')).toBeVisible();
    await expect(page.locator('a[href="/legal/privacy.html"]')).toBeVisible();
  });

  test('bouton "Voir un exemple" charge un deck partagé', async ({ page }) => {
    await page.goto('/');
    await page.click('.lp-cta');
    // Doit naviguer vers ?share=...
    await page.waitForURL(/\?share=/);
    // L'overlay partagé doit s'afficher
    await expect(page.locator('#shared-deck-overlay')).toBeVisible({ timeout: 5000 });
    // Le titre du deck démo
    await expect(page.locator('.shared-title')).toContainText('Atraxa');
  });
});
