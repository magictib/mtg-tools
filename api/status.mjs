// Edge function : statuspage publique
// URL : /status
// Vérifie en temps réel : Firestore, Scryfall, OG image, sitemap.
// Pour les vraies pannes : utiliser BetterStack ou UptimeRobot en plus.

export const config = { runtime: 'edge' };

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'mtg-tools-5ea4b';

async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    return { name, ok: true, latency: Date.now() - t0 };
  } catch (e) {
    return { name, ok: false, latency: Date.now() - t0, error: String(e).slice(0, 200) };
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const json = url.searchParams.get('format') === 'json';

  const checks = await Promise.all([
    check('Firestore (public_decks)', async () => {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/public_decks?pageSize=1`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    check('Scryfall API', async () => {
      // Scryfall exige User-Agent + Accept headers depuis 2024
      const r = await fetch('https://api.scryfall.com/cards/named?fuzzy=sol+ring', {
        headers: {
          'User-Agent': 'ManaLAB/1.0 (status-check)',
          'Accept': 'application/json'
        }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    check('Sitemap', async () => {
      const r = await fetch(`${url.origin}/sitemap.xml`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    check('Manifest PWA', async () => {
      const r = await fetch(`${url.origin}/manifest.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    })
  ]);

  const allOk = checks.every(c => c.ok);
  const status = allOk ? 'operational' : 'degraded';
  const statusColor = allOk ? '#78c890' : '#e26d6d';
  const statusEmoji = allOk ? '✓' : '⚠';

  if (json) {
    return new Response(JSON.stringify({ status, checks, ts: Date.now() }), {
      status: allOk ? 200 : 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
    });
  }

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statut — ManaLAB</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0c0a07;color:#d8c8a8;font-family:Georgia,serif;line-height:1.6;padding:40px 20px}
  .wrap{max-width:680px;margin:0 auto}
  h1{font-size:2rem;color:#c9a84c;margin-bottom:24px;text-align:center}
  .status{text-align:center;padding:20px;border-radius:12px;background:rgba(120,200,144,.08);border:1px solid ${statusColor};margin-bottom:30px}
  .status-emoji{font-size:3rem;display:block;margin-bottom:8px}
  .status-text{font-size:1.4rem;color:${statusColor};font-family:Georgia,serif;letter-spacing:.04em;text-transform:uppercase}
  .checks{display:flex;flex-direction:column;gap:8px}
  .check{display:flex;align-items:center;gap:12px;padding:14px 18px;background:#1f1912;border:.5px solid rgba(201,168,76,.2);border-radius:9px}
  .check-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0}
  .ok{background:rgba(120,200,144,.2);color:#78c890}
  .ko{background:rgba(226,109,109,.2);color:#e26d6d}
  .check-name{flex:1;color:#d8c8a8}
  .check-meta{font-size:.78rem;color:#857b65}
  .footer{margin-top:40px;text-align:center;color:#857b65;font-size:.84rem}
  .footer a{color:#c9a84c;text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <h1>État du service</h1>
  <div class="status">
    <div class="status-emoji">${statusEmoji}</div>
    <div class="status-text">${status === 'operational' ? 'Tous les systèmes opérationnels' : 'Service dégradé'}</div>
    <div style="font-size:.78rem;color:#857b65;margin-top:6px">Mise à jour : ${new Date().toISOString()}</div>
  </div>
  <div class="checks">
    ${checks.map(c => `
      <div class="check">
        <div class="check-icon ${c.ok ? 'ok' : 'ko'}">${c.ok ? '✓' : '✕'}</div>
        <div class="check-name">${c.name}</div>
        <div class="check-meta">${c.ok ? c.latency + 'ms' : '<span style="color:#e26d6d">' + (c.error || 'erreur') + '</span>'}</div>
      </div>
    `).join('')}
  </div>
  <div class="footer">
    <a href="/">← Retour à ManaLAB</a><br>
    <span style="margin-top:10px;display:inline-block">Statut JSON : <a href="/status?format=json">/status?format=json</a></span>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    status: allOk ? 200 : 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30'
    }
  });
}
