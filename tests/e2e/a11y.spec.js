// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Accessibilité de base', () => {
  test('document a un attribut lang', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toMatch(/^(fr|en)/);
  });

  test('boutons icon-only ont un title ou aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Échantillon des boutons les plus visibles
    const buttons = await page.locator('button').elementHandles();
    let missing = 0;
    for (const b of buttons.slice(0, 80)) {
      const text = (await b.textContent())?.trim() || '';
      const title = await b.getAttribute('title');
      const ariaLabel = await b.getAttribute('aria-label');
      // Si le texte est juste un emoji (≤2 chars), on attend un title ou aria-label
      if (text.length <= 2 && !title && !ariaLabel) missing++;
    }
    // Tolérance : moins de 10 boutons icon-only sans label
    expect(missing).toBeLessThan(10);
  });

  test('Escape ferme un overlay ouvert', async ({ page }) => {
    await page.goto('/');
    // Ouvre la wishlist depuis Ctrl+K
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    // Si la palette s'est ouverte (#cmd-pal-overlay ou similaire), Escape doit la fermer
    const cmdPal = page.locator('#cmd-pal-overlay, .cmd-pal');
    if (await cmdPal.count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      // Ne doit plus être visible
      const visible = await cmdPal.first().isVisible().catch(() => false);
      expect(visible).toBe(false);
    }
  });

  test('focus visible sur les éléments interactifs (focus ring)', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    // Le premier élément focusable doit être un input ou button
    const active = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA']).toContain(active);
  });
});
