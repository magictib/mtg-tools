// Sitemap dynamique : liste les pages SEO ManaLAB pour Google
// URL : /sitemap.xml
// Ré-écrit via vercel.json. Régénéré toutes les heures.

export const config = { runtime: 'edge' };

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'mtg-tools-5ea4b';

// Slugifie un nom de commandant pour URL
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchAllCommanders() {
  // Source primaire : collection `commanders/` seedée depuis Scryfall (script seed-commanders.js)
  // Fallback : commandants extraits des decks publics
  const all = new Set();
  try {
    let url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/commanders?pageSize=300`;
    for (let i = 0; i < 30; i++) { // max 30 pages × 300 = 9000 commandants
      const r = await fetch(url);
      const data = await r.json();
      if (!data.documents) break;
      data.documents.forEach(d => {
        const slug = d.fields?.slug?.stringValue || d.name.split('/').pop();
        if (slug) all.add(slug);
      });
      if (!data.nextPageToken) break;
      url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/commanders?pageSize=300&pageToken=${data.nextPageToken}`;
    }
  } catch (e) {}

  // Fallback : extraire les commandants des decks publics (si collection commanders pas seedée)
  if (all.size < 50) {
    try {
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery`;
      const r = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'public_decks' }],
            select: { fields: [{ fieldPath: 'commander' }] },
            limit: 500
          }
        })
      });
      const data = await r.json();
      if (Array.isArray(data)) {
        data.forEach(x => {
          const c = x.document?.fields?.commander?.stringValue;
          if (c) all.add(slugify(c));
        });
      }
    } catch (e) {}
  }
  return [...all];
}

async function fetchAllCombos() {
  const all = [];
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/combos?pageSize=300`);
    const data = await r.json();
    if (data.documents) {
      data.documents.forEach(d => {
        const slug = d.fields?.slug?.stringValue || d.name.split('/').pop();
        if (slug) all.push(slug);
      });
    }
  } catch (e) {}
  return all;
}

// Decks publics partagés : URL canonique /deck/:id (P2 #9). On limite à 1000
// pour éviter un sitemap trop gros — au-delà, on segmenterait en sitemap index.
async function fetchPublicDecks() {
  const all = [];
  try {
    let url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/public_decks?pageSize=300`;
    for (let i = 0; i < 4; i++) { // 4 × 300 = 1200 max
      const r = await fetch(url);
      const data = await r.json();
      if (!data.documents) break;
      data.documents.forEach(d => {
        const id = d.name.split('/').pop();
        const sharedAt = parseInt(d.fields?.sharedAt?.integerValue || '0', 10);
        if (id) all.push({ id, sharedAt });
      });
      if (!data.nextPageToken) break;
      url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/public_decks?pageSize=300&pageToken=${data.nextPageToken}`;
    }
  } catch (e) {}
  return all;
}

export default async function handler(req) {
  const origin = new URL(req.url).origin;
  const [slugs, combos, decks] = await Promise.all([fetchAllCommanders(), fetchAllCombos(), fetchPublicDecks()]);
  const now = new Date().toISOString().slice(0, 10);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  // Home FR/EN
  xml += `  <url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${now}</lastmod>\n`;
  xml += `    <xhtml:link rel="alternate" hreflang="fr" href="${origin}/"/>\n`;
  xml += `    <xhtml:link rel="alternate" hreflang="en" href="${origin}/en/"/>\n`;
  xml += `  </url>\n`;
  // Pages générales (about, stats)
  xml += `  <url><loc>${origin}/about/</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  xml += `  <url><loc>${origin}/stats</loc><changefreq>daily</changefreq><priority>0.7</priority><lastmod>${now}</lastmod></url>\n`;
  // Pages légales
  ['cgu', 'mentions', 'privacy'].forEach(p => {
    xml += `  <url><loc>${origin}/legal/${p}.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>\n`;
  });
  // Pages commandants FR+EN avec hreflang
  slugs.forEach(slug => {
    if (!slug) return;
    xml += `  <url><loc>${origin}/c/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="fr" href="${origin}/c/${slug}"/>\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="en" href="${origin}/en/c/${slug}"/>\n`;
    xml += `  </url>\n`;
  });
  // Pages combos
  combos.forEach(slug => {
    if (!slug) return;
    xml += `  <url><loc>${origin}/combo/${slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority><lastmod>${now}</lastmod></url>\n`;
  });
  // Decks publics partagés (P2 #9) — utilise sharedAt comme lastmod si disponible.
  decks.forEach(deck => {
    if (!deck.id) return;
    const lastmod = deck.sharedAt ? new Date(deck.sharedAt).toISOString().slice(0, 10) : now;
    xml += `  <url><loc>${origin}/deck/${deck.id}</loc><changefreq>monthly</changefreq><priority>0.6</priority><lastmod>${lastmod}</lastmod></url>\n`;
  });
  xml += '</urlset>\n';

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
