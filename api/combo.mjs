// Edge function : page SEO publique pour un combo Magic
// URL : /combo/:slug (slug = "card-a-and-card-b" ou "card-a-card-b-card-c")
// Agrège les decks publics qui contiennent toutes les cartes du combo.
//
// Le slug est généré côté seed depuis _ANA_COMBOS (catalog interne).
// Pour le seed initial, voir scripts/seed-combos.js.

export const config = { runtime: 'edge' };

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'mtg-tools-5ea4b';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Fetch metadata du combo depuis Firestore (collection combos seedée par script)
async function fetchCombo(slug) {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/combos/${slug}`);
    if (!r.ok) return null;
    const d = await r.json();
    const f = d.fields || {};
    return {
      slug,
      names: (f.names?.arrayValue?.values || []).map(v => v.stringValue),
      type: f.type?.stringValue || '',
      desc: f.desc?.stringValue || '',
      colors: (f.colors?.arrayValue?.values || []).map(v => v.stringValue)
    };
  } catch (e) {
    return null;
  }
}

// Fetch decks publics qui contiennent TOUTES les cartes du combo
async function fetchDecksWithCombo(names) {
  if (!names.length) return [];
  // Firestore ne supporte pas "array contains all" — on récupère les decks
  // matchant la 1ère carte puis on filtre côté serveur.
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'public_decks' }],
      limit: 100,
      orderBy: [{ field: { fieldPath: 'likes' }, direction: 'DESCENDING' }]
    }
  };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    const namesLc = names.map(n => n.toLowerCase().trim());
    return data.filter(x => x.document).map(x => {
      const f = x.document.fields || {};
      return {
        id: x.document.name.split('/').pop(),
        name: f.name?.stringValue || '',
        ownerName: f.ownerName?.stringValue || '',
        commander: f.commander?.stringValue || '',
        format: f.format?.stringValue || '',
        likes: parseInt(f.likes?.integerValue || '0', 10),
        cardCount: parseInt(f.cardCount?.integerValue || '0', 10),
        rawName: f.rawName?.stringValue || ''
      };
    }).filter(d => {
      // Filtre : doit contenir TOUTES les cartes du combo
      const rawLc = d.rawName.toLowerCase();
      return namesLc.every(n => rawLc.includes(n));
    });
  } catch (e) {
    return [];
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || url.pathname.split('/').filter(Boolean).pop();
  if (!slug || slug === 'combo') return new Response(null, { status: 302, headers: { Location: '/' } });

  const combo = await fetchCombo(slug);
  if (!combo) {
    return new Response(`<!doctype html><html><head><title>Combo introuvable — ManaLAB</title><meta name="robots" content="noindex"></head><body style="background:#0c0a07;color:#d8c8a8;font-family:serif;text-align:center;padding:40px"><h1>Combo introuvable</h1><p><a href="/" style="color:#c9a84c">← ManaLAB</a></p></body></html>`, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  const decks = await fetchDecksWithCombo(combo.names);
  const cardsLabel = combo.names.join(' + ');
  const title = `Combo : ${cardsLabel} — ManaLAB`;
  const desc = `${combo.type ? combo.type + ' — ' : ''}${combo.desc || cardsLabel}. ${decks.length} deck${decks.length > 1 ? 's' : ''} public${decks.length > 1 ? 's' : ''} sur ManaLAB.`.slice(0, 160);

  const ogParams = new URLSearchParams({
    title: 'Combo : ' + cardsLabel,
    commander: combo.names[0] || '',
    format: combo.type || 'Combo',
    cards: String(combo.names.length)
  });
  const ogImage = `${url.origin}/api/og?${ogParams.toString()}`;
  const canonical = `${url.origin}/combo/${slug}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: desc,
    image: ogImage,
    url: canonical,
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
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="theme-color" content="#0c0a07">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0c0a07;color:#d8c8a8;font-family:Georgia,serif;line-height:1.6}
  .wrap{max-width:920px;margin:0 auto;padding:24px 18px 60px}
  .hero{text-align:center;padding:30px 0 24px;border-bottom:1px solid rgba(201,168,76,.3);margin-bottom:24px}
  .hero h1{font-size:2.2rem;color:#c9a84c;margin-bottom:10px;line-height:1.2}
  .badge{display:inline-block;background:rgba(201,168,76,.15);border:.5px solid rgba(201,168,76,.4);color:#c9a84c;padding:4px 14px;border-radius:9px;font-size:.85rem;margin-bottom:14px}
  .pieces{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:24px 0}
  .piece{background:#1f1912;border:.5px solid rgba(201,168,76,.3);border-radius:10px;padding:14px;text-align:center}
  .piece img{max-width:100%;height:auto;border-radius:6px;margin-bottom:8px}
  .piece h3{font-size:.92rem;color:#c9a84c;margin-bottom:4px}
  .desc{background:rgba(201,168,76,.04);border-left:3px solid #c9a84c;padding:14px 18px;margin:18px 0;font-style:italic;color:#a8997b;border-radius:0 8px 8px 0}
  h2{font-size:1.3rem;color:#c9a84c;margin:24px 0 10px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
  .card{background:#1f1912;border:.5px solid rgba(201,168,76,.2);border-radius:10px;padding:11px 13px}
  .card h3{font-size:.92rem;color:#c9a84c;margin-bottom:4px}
  .card .meta{font-size:.72rem;color:#857b65}
  .card a{color:#d8c8a8;text-decoration:none}
  .cta{background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(201,168,76,.03));border:1px solid #c9a84c;border-radius:12px;padding:18px 22px;text-align:center;margin-top:24px}
  .cta a{display:inline-block;background:#c9a84c;color:#000;padding:9px 22px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px}
  .footer{text-align:center;padding:24px 0;border-top:1px solid rgba(201,168,76,.3);color:#857b65;font-size:.84rem;margin-top:32px}
  .footer a{color:#c9a84c}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    ${combo.type ? `<div class="badge">${esc(combo.type)}</div><br>` : ''}
    <h1>${esc(cardsLabel)}</h1>
  </header>

  ${combo.desc ? `<div class="desc">${esc(combo.desc)}</div>` : ''}

  <h2>Pièces du combo</h2>
  <div class="pieces">
    ${combo.names.map(n => `<div class="piece">
      <img src="https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(n)}&format=image&version=normal" alt="${esc(n)}" loading="lazy">
      <h3>${esc(n)}</h3>
      <a href="https://scryfall.com/search?q=${encodeURIComponent('!"' + n + '"')}" target="_blank" rel="noopener" style="color:#857b65;font-size:.78rem">Voir sur Scryfall ↗</a>
    </div>`).join('')}
  </div>

  ${decks.length ? `<h2>Decks publics jouant ce combo</h2>
  <div class="grid">
    ${decks.slice(0, 12).map(d => `<div class="card">
      <h3><a href="${url.origin}/?deck=${esc(d.id)}">${esc(d.name)}</a></h3>
      <div class="meta">par ${esc(d.ownerName || '?')}${d.commander ? ' · 👑 ' + esc(d.commander) : ''}${d.likes ? ' · ❤ ' + d.likes : ''}</div>
    </div>`).join('')}
  </div>` : '<p style="color:#857b65;font-style:italic">Aucun deck public ne joue ce combo pour l\'instant — sois le premier à publier le tien !</p>'}

  <section class="cta">
    <strong>Construis ton propre deck avec ce combo</strong><br>
    <span style="font-size:.9rem;color:#a8997b">ManaLAB détecte automatiquement les combos infinis dans tes listes (mode opt-in), te montre ce qui manque, et t'aide à les sécuriser.</span>
    <a href="${url.origin}/">Ouvrir ManaLAB →</a>
  </section>

  <footer class="footer">
    <a href="${url.origin}/">ManaLAB</a> — l'atelier Magic francophone.
    <div style="margin-top:8px">
      <a href="${url.origin}/legal/cgu.html">CGU</a> ·
      <a href="${url.origin}/legal/mentions.html">Mentions légales</a> ·
      <a href="${url.origin}/legal/privacy.html">Confidentialité</a>
    </div>
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
