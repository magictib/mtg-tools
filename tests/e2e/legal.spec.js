// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Pages légales (RGPD)', () => {
  for (const page of ['cgu', 'mentions', 'privacy']) {
    test(`/legal/${page}.html charge et a un titre + nav retour`, async ({ page: pw }) => {
      const response = await pw.goto(`/legal/${page}.html`);
      expect(response?.status()).toBe(200);
      // h1 présent
      await expect(pw.locator('h1')).toBeVisible();
      // Lien retour vers /
      await expect(pw.locator('.back')).toHaveAttribute('href', '/');
      // Cross-links vers les 3 pages légales
      await expect(pw.locator('a[href="/legal/cgu.html"]').first()).toBeVisible();
      await expect(pw.locator('a[href="/legal/mentions.html"]').first()).toBeVisible();
      await expect(pw.locator('a[href="/legal/privacy.html"]').first()).toBeVisible();
    });
  }

  test('Politique de confidentialité mentionne les droits RGPD', async ({ page }) => {
    await page.goto('/legal/privacy.html');
    const body = await page.locator('body').textContent();
    expect(body).toContain('CNIL');
    expect(body).toContain('Effacement');
    expect(body).toContain('Portabilité');
    expect(body).toContain('Rectification');
  });

  test('Mentions légales identifient hébergeur et éditeur', async ({ page }) => {
    await page.goto('/legal/mentions.html');
    const body = await page.locator('body').textContent();
    expect(body).toContain('Vercel');
    expect(body).toContain('Firebase');
    expect(body).toContain('Thibaud');
  });
});
