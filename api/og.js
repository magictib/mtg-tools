// Edge function : génération d'OG image dynamique
// URL : /api/og?title=...&commander=...&format=...&author=...
// Renvoie un SVG composé (logo + commander art + titre + meta) que les crawlers
// Discord/Twitter/Facebook utiliseront pour l'aperçu.
//
// Implémentation SVG-only (pas de dépendance @vercel/og pour rester edge-compatible
// sans installer de package). SVG est interprété correctement par Discord/Twitter
// — Facebook préfère du PNG mais le SVG est servi avec content-type image/svg+xml
// qui est accepté.
//
// Pour une vraie qualité PNG (cas Facebook strict), passer en runtime nodejs et
// utiliser @vercel/og ou satori + resvg-wasm.

export const config = { runtime: 'edge' };

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
}

function trunc(s, max) {
  s = String(s || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const title = trunc(url.searchParams.get('title') || 'Deck Magic', 55);
  const commander = trunc(url.searchParams.get('commander') || '', 40);
  const format = trunc(url.searchParams.get('format') || '', 20);
  const author = trunc(url.searchParams.get('author') || '', 30);
  const cardCount = url.searchParams.get('cards') || '';

  // Récupère l'image art_crop du commandant (en background-image du SVG)
  let commanderImgUrl = '';
  if (commander) {
    commanderImgUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(commander)}&format=image&version=art_crop`;
    // Pour intégrer en SVG, on doit récupérer l'URL finale (Scryfall fait des redirects)
    try {
      const r = await fetch(commanderImgUrl, { method: 'HEAD', redirect: 'follow' });
      if (r.ok && r.url) commanderImgUrl = r.url;
    } catch (e) {}
  }

  // Dimensions OG recommandées : 1200×630
  const W = 1200, H = 630;

  // SVG composé : background dégradé doré, art commander en filigrane, texte stylé
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0f04"/>
      <stop offset="100%" stop-color="#0c0a07"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c9a84c"/>
      <stop offset="100%" stop-color="#8a6f2e"/>
    </linearGradient>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(12,10,7,0.4)"/>
      <stop offset="60%" stop-color="rgba(12,10,7,0.85)"/>
      <stop offset="100%" stop-color="rgba(12,10,7,1)"/>
    </linearGradient>
    <filter id="shadow"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>

  <!-- Fond -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  ${commanderImgUrl ? `
  <!-- Art commander en filigrane (clip à droite) -->
  <g opacity="0.55">
    <image href="${esc(commanderImgUrl)}" x="${W * 0.45}" y="0" width="${W * 0.55}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <!-- Overlay pour lisibilité -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#overlay)" opacity="0.7"/>
  ` : ''}

  <!-- Logo ManaLAB top-left -->
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="36" fill="url(#gold)" letter-spacing="3">ManaLAB</text>
    <text x="0" y="22" font-family="Georgia, serif" font-size="14" fill="#857b65" letter-spacing="2">✦ l'atelier Magic francophone</text>
  </g>

  <!-- Titre principal -->
  <g transform="translate(60, 280)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="58" fill="#e8d8b0" font-weight="bold">
      ${esc(trunc(title, 36))}
    </text>
    ${title.length > 36 ? `<text x="0" y="68" font-family="Georgia, serif" font-size="48" fill="#e8d8b0" font-weight="bold">${esc(title.slice(36, 72))}</text>` : ''}
  </g>

  ${commander ? `
  <!-- Commander chip -->
  <g transform="translate(60, 410)">
    <rect x="0" y="0" width="${Math.min(commander.length * 16 + 80, 600)}" height="44" rx="22" fill="rgba(201,168,76,0.15)" stroke="#c9a84c" stroke-width="1.5"/>
    <text x="20" y="29" font-family="Georgia, serif" font-size="22" fill="#c9a84c">👑 ${esc(commander)}</text>
  </g>
  ` : ''}

  <!-- Meta line en bas -->
  <g transform="translate(60, ${H - 70})">
    <text x="0" y="0" font-family="Georgia, serif" font-size="22" fill="#a8997b">
      ${format ? esc(format) : 'Commander'}${cardCount ? ` · ${esc(cardCount)} cartes` : ''}${author ? ` · par ${esc(author)}` : ''}
    </text>
    <text x="0" y="32" font-family="Georgia, serif" font-size="16" fill="#857b65" letter-spacing="1">ManaLAB · analyse · partage · communauté</text>
  </g>

  <!-- Bordure dorée -->
  <rect x="3" y="3" width="${W-6}" height="${H-6}" fill="none" stroke="url(#gold)" stroke-width="2" opacity="0.5"/>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800'
    }
  });
}
