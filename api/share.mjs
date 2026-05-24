// Vercel/Netlify Edge Function : reçoit ?s=<base64> et renvoie un HTML
// avec les meta OG dynamiques pour que Discord/Twitter/Facebook affichent
// un aperçu correct du deck partagé. Redirige ensuite vers /index.html?share=...
// pour les vrais visiteurs (navigateurs).
//
// Usage : déploie l'app sur Vercel. Le bouton "Partager" doit générer
// l'URL /api/share?s=<encoded> au lieu de /index.html?share=<encoded>.
// Voir _shareEncodeDeck() côté client.

export const config = { runtime: 'edge' };

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function decodeShare(s) {
  if (!s) return null;
  try {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const json = atob(s);
    // atob ne gère pas l'UTF-8 directement
    const bytes = Uint8Array.from(json, c => c.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const data = JSON.parse(decoded);
    return data && typeof data === 'object' ? data : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const enc = url.searchParams.get('s') || url.searchParams.get('share');
  const data = decodeShare(enc);

  // Aucune data → redirige vers la home
  if (!data) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/index.html' }
    });
  }

  const name = String(data.n || 'Deck Magic');
  const fmt = data.f ? ` · ${data.f}` : '';
  const cmd = data.c && data.c.n ? ` · 👑 ${data.c.n}` : '';
  const title = `${name}${fmt}${cmd} — ManaLAB`;
  const desc = `${name}${data.f ? ' au format ' + data.f : ''}${data.c && data.c.n ? ' avec ' + data.c.n + ' comme commandant' : ''}. Découvre la décomposition complète, le bracket Commander, la heatmap par tour et les suggestions de swap sur ManaLAB.`;
  // OG image composée via /api/og (logo + nom du deck + art commandant)
  const cardCount = (String(data.l || '').match(/^\d+/gm) || []).reduce((s, n) => s + parseInt(n, 10), 0);
  const ogParams = new URLSearchParams({
    title: data.n || 'Deck Magic',
    commander: (data.c && data.c.n) || '',
    format: data.f || '',
    cards: String(cardCount || '')
  });
  const ogImage = `${url.origin}/api/og?${ogParams.toString()}`;

  // Redirection client (ouvre la vraie app) — les crawlers s'arrêtent au <head>
  const clientRedirect = `/index.html?share=${encodeURIComponent(enc)}`;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ManaLAB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(url.toString())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta http-equiv="refresh" content="0; url=${esc(clientRedirect)}">
<link rel="canonical" href="${esc(clientRedirect)}">
<style>
  body{margin:0;background:#0c0a07;color:#d8c8a8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;text-align:center}
  a{color:#c9a84c}
</style>
</head>
<body>
<div>
  <h1 style="color:#c9a84c">${esc(title)}</h1>
  <p>${esc(desc)}</p>
  <p><a href="${esc(clientRedirect)}">Ouvrir le deck →</a></p>
</div>
<script>setTimeout(function(){location.replace(${JSON.stringify(clientRedirect)});},80);</script>
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
