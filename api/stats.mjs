// Edge function : page stats globales communauté ManaLAB
// URL : /stats (public, indexable)
// Pour les visiteurs : "Voilà l'activité actuelle, rejoins-nous"
// Pour Google : page riche en données fraîches, bonne pour la confiance SEO
//
// Mise en cache 1h. Les compteurs sont calculés à la volée — quand l'app
// dépasse ~5000 utilisateurs, déplacer dans `community_stats/global` mis à jour
// via Cloud Function quotidienne.

export const config = { runtime: 'edge' };

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'mtg-tools-5ea4b';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function countCollection(name, opts = {}) {
  // Approximation : on récupère une page et on prend la longueur. Pour un vrai count,
  // utiliser l'aggregation API (count()) côté nodejs runtime.
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${name}?pageSize=${opts.pageSize || 300}`;
    const r = await fetch(url);
    const data = await r.json();
    return (data.documents || []).length;
  } catch (e) {
    return 0;
  }
}

async function fetchTopCommanders() {
  // Agrège les commandants des decks publics — top 10
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/public_decks?pageSize=300`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    if (!data.documents) return [];
    const counts = {};
    data.documents.forEach(d => {
      const c = d.fields?.commander?.stringValue;
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  } catch (e) {
    return [];
  }
}

async function fetchTopLikedDecks() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'public_decks' }],
          orderBy: [{ field: { fieldPath: 'likes' }, direction: 'DESCENDING' }],
          limit: 10
        }
      })
    });
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.filter(x => x.document).map(x => {
      const f = x.document.fields || {};
      return {
        id: x.document.name.split('/').pop(),
        name: f.name?.stringValue || '',
        ownerName: f.ownerName?.stringValue || '',
        commander: f.commander?.stringValue || '',
        likes: parseInt(f.likes?.integerValue || '0', 10)
      };
    });
  } catch (e) {
    return [];
  }
}

function slugify(name) {
  return String(name || '').toLowerCase()
    .replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function handler(req) {
  const url = new URL(req.url);
  const [publicDecks, commanders, combos, users, topCmds, topDecks] = await Promise.all([
    countCollection('public_decks', { pageSize: 300 }),
    countCollection('commanders'),
    countCollection('combos'),
    countCollection('users', { pageSize: 300 }),
    fetchTopCommanders(),
    fetchTopLikedDecks()
  ]);

  const title = 'Stats communauté ManaLAB — l\'atelier Magic francophone';
  const desc = `${publicDecks} decks publics, ${commanders} commandants indexés, ${combos} combos. La communauté Magic francophone sur ManaLAB.`.slice(0, 160);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: desc,
    url: `${url.origin}/stats`,
    inLanguage: 'fr',
    publisher: { '@type': 'Organization', name: 'ManaLAB', url: url.origin }
  };

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url.origin}/stats">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${url.origin}/api/og?title=Stats%20communaut%C3%A9&commander=&format=ManaLAB">
<meta property="og:url" content="${url.origin}/stats">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="theme-color" content="#0c0a07">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0c0a07;color:#d8c8a8;font-family:Georgia,serif;line-height:1.6}
  .wrap{max-width:920px;margin:0 auto;padding:32px 20px 60px}
  .hero{text-align:center;padding:24px 0 30px;border-bottom:1px solid rgba(201,168,76,.3);margin-bottom:30px}
  .hero h1{font-size:2.4rem;color:#c9a84c;margin-bottom:10px;line-height:1.15}
  .hero .sub{color:#a8997b;font-size:1rem}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:30px 0}
  .stat{background:#1f1912;border:.5px solid rgba(201,168,76,.3);border-radius:12px;padding:20px 18px;text-align:center}
  .stat-val{font-family:Georgia,serif;font-size:2.6rem;color:#c9a84c;line-height:1}
  .stat-lbl{font-size:.84rem;color:#857b65;margin-top:6px;letter-spacing:.03em}
  h2{font-size:1.4rem;color:#c9a84c;margin:32px 0 14px}
  .top-list{background:#1f1912;border:.5px solid rgba(201,168,76,.2);border-radius:11px;padding:18px 22px}
  .top-item{display:flex;align-items:center;gap:14px;padding:8px 0;border-bottom:.5px solid rgba(201,168,76,.1)}
  .top-item:last-child{border-bottom:none}
  .top-rank{width:30px;color:#857b65;text-align:right;font-family:Georgia,serif}
  .top-name{flex:1;color:#d8c8a8}
  .top-name a{color:#d8c8a8;text-decoration:none}
  .top-name a:hover{color:#c9a84c}
  .top-count{color:#c9a84c;font-weight:bold;font-variant-numeric:tabular-nums}
  .cta{background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(201,168,76,.03));border:1px solid #c9a84c;border-radius:12px;padding:20px 24px;margin:32px 0;text-align:center}
  .cta a{display:inline-block;background:#c9a84c;color:#000;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px}
  .footer{text-align:center;padding:24px 0 0;border-top:1px solid rgba(201,168,76,.3);color:#857b65;font-size:.84rem;margin-top:40px}
  .footer a{color:#c9a84c;text-decoration:none}
  .updated{text-align:center;font-size:.78rem;color:#857b65;font-style:italic;margin-top:14px}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>📊 Stats communauté</h1>
    <div class="sub">L'activité de l'atelier Magic francophone</div>
  </header>

  <div class="stats-grid">
    <div class="stat"><div class="stat-val">${publicDecks}</div><div class="stat-lbl">decks publics</div></div>
    <div class="stat"><div class="stat-val">${commanders}</div><div class="stat-lbl">commandants indexés</div></div>
    <div class="stat"><div class="stat-val">${combos}</div><div class="stat-lbl">combos documentés</div></div>
    <div class="stat"><div class="stat-val">${users}+</div><div class="stat-lbl">utilisateurs</div></div>
  </div>

  ${topCmds.length ? `<h2>🏆 Commandants les plus joués</h2>
  <div class="top-list">
    ${topCmds.map((c, i) => `<div class="top-item">
      <div class="top-rank">#${i + 1}</div>
      <div class="top-name"><a href="/c/${slugify(c.name)}">${esc(c.name)}</a></div>
      <div class="top-count">${c.count}</div>
    </div>`).join('')}
  </div>` : ''}

  ${topDecks.length ? `<h2>❤ Decks les plus aimés</h2>
  <div class="top-list">
    ${topDecks.map((d, i) => `<div class="top-item">
      <div class="top-rank">#${i + 1}</div>
      <div class="top-name"><a href="/?deck=${esc(d.id)}">${esc(d.name)}</a> <span style="color:#857b65;font-size:.84rem">par ${esc(d.ownerName)}${d.commander ? ' · 👑 ' + esc(d.commander) : ''}</span></div>
      <div class="top-count">${d.likes} ❤</div>
    </div>`).join('')}
  </div>` : ''}

  <section class="cta">
    <h2 style="margin-top:0">Rejoins la communauté</h2>
    <p style="margin-bottom:0">Construis, partage, like, suis. Trouve tes prochains adversaires en arène. C'est gratuit.</p>
    <a href="/">Ouvrir ManaLAB →</a>
  </section>

  <div class="updated">Mise à jour : ${new Date().toISOString()}</div>

  <footer class="footer">
    <a href="/">ManaLAB</a> ·
    <a href="/about/">À propos</a> ·
    <a href="/legal/cgu.html">CGU</a> ·
    <a href="/legal/privacy.html">Confidentialité</a>
  </footer>
</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
