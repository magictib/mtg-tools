// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('SEO & métadonnées', () => {
  test('home a title + description + OG tags', async ({ page }) => {
    await page.goto('/');
    expect(await page.title()).toBeTruthy();
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc?.length).toBeGreaterThan(50);
    expect(desc?.length).toBeLessThan(200); // Google tronque > 160
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/^https?:\/\//);
  });

  test('robots.txt accessible et pointe le sitemap', async ({ page }) => {
    const r = await page.request.get('/robots.txt');
    expect(r.ok()).toBeTruthy();
    const body = await r.text();
    expect(body).toContain('Sitemap:');
    expect(body).toContain('User-agent:');
  });

  test('manifest.json a les champs PWA requis', async ({ page }) => {
    const r = await page.request.get('/manifest.json');
    expect(r.ok()).toBeTruthy();
    const m = await r.json();
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.icons?.length).toBeGreaterThan(0);
  });
});
