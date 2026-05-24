// Edge function : page SEO publique pour un commandant
// URL : /c/:slug
// V2 : hreflang FR/EN, schema.org Article + ItemList, bracket moyen, plus de stats,
// inclut le sitemap des decks publics avec ce commandant.

export const config = { runtime: 'edge' };

const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'manalab-app';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function slugToName(slug) {
  // Heuristique : reverse du slugify. Fallback si la collection `commanders` n'est pas seedée.
  return String(slug || '')
    .replace(/-/g, ' ')
    .replace(/\bpraetors\b/g, "praetors'")
    .replace(/\bbolas\b/g, "bolas's")
    .replace(/\byawgmoths\b/g, "yawgmoth's")
    .replace(/\bjeskas\b/g, "jeska's")
    .replace(/\bjeskais\b/g, "jeskai")
    .replace(/\bursulas\b/g, "ursula's")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Lookup canonique : si la collection `commanders/{slug}` existe (seedée), on prend le nom officiel
async function resolveCommanderName(slug) {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/commanders/${slug}`);
    if (r.ok) {
      const d = await r.json();
      const name = d.fields?.name?.stringValue;
      if (name) return name;
    }
  } catch (e) {}
  return slugToName(slug);
}

// Détection bracket simple (réplique côté serveur de la logique client)
function detectBracket(rawName) {
  const GAME_CHANGERS = new Set(['cyclonic rift','fierce guardianship','force of will','mana drain','rhystic study','smothering tithe',"thassa's oracle",'the one ring','drannith magistrate','opposition agent',"bolas's citadel",'necropotence','jin-gitaxias','kinnan, bonder prodigy','urza, lord high artificer','sheoldred, the apocalypse','expropriate','ad nauseam',"yawgmoth's will",'serra ascendant']);
  const FAST_MANA = new Set(['mana crypt','mana vault','mox diamond','mox opal','chrome mox','lotus petal',"lion's eye diamond",'jeweled lotus','grim monolith','dockside extortionist','ancient tomb']);
  const TUTORS = new Set(['demonic tutor','vampiric tutor','imperial seal','mystical tutor','enlightened tutor','worldly tutor',"green sun's zenith",'gamble','diabolic intent','intuition','tainted pact','natural order','survival of the fittest','entomb']);
  let pts = 0;
  String(rawName || '').split('\n').forEach(line => {
    const m = line.trim().toLowerCase().match(/^\d+\s+(.+?)(?:\s+\(.+\))?$/);
    if (!m) return;
    const n = m[1].trim();
    if (GAME_CHANGERS.has(n)) pts += 1.5;
    if (FAST_MANA.has(n)) pts += 1.2;
    if (TUTORS.has(n)) pts += 1;
  });
  if (pts >= 20) return 5;
  if (pts >= 12) return 4;
  if (pts >= 5) return 3;
  if (pts >= 1) return 2;
  return 1;
}

async function fetchDecksForCommander(commanderName) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'public_decks' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'commander' },
          op: 'EQUAL',
          value: { stringValue: commanderName }
        }
      },
      orderBy: [{ field: { fieldPath: 'likes' }, direction: 'DESCENDING' }],
      limit: 30
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
    return data.filter(x => x.document).map(x => {
      const f = x.document.fields || {};
      return {
        id: x.document.name.split('/').pop(),
        name: f.name?.stringValue || '',
        ownerName: f.ownerName?.stringValue || '',
        ownerUid: f.createdBy?.stringValue || '',
        format: f.format?.stringValue || '',
        likes: parseInt(f.likes?.integerValue || '0', 10),
        cardCount: parseInt(f.cardCount?.integerValue || '0', 10),
        rawName: f.rawName?.stringValue || '',
        updatedAt: f.updatedAt?.timestampValue || ''
      };
    });
  } catch (e) {
    return [];
  }
}

function aggregateCards(decks, commanderName) {
  const counts = {};
  const n = decks.length;
  decks.forEach(d => {
    const seen = {};
    (d.rawName || '').split(/\r?\n/).forEach(line => {
      const s = line.trim();
      if (!s || /^\/\/|^#|^SB/i.test(s)) return;
      const m = s.match(/^\d+\s*x?\s+(.+?)(?:\s*\([A-Z0-9]{2,5}\))?(?:\s+\d+)?$/i);
      let name = m ? m[1].trim() : s;
      name = name.replace(/\s*\([A-Z0-9]{2,5}\)\s*\d*\s*$/, '').trim();
      if (!name || name.toLowerCase() === commanderName.toLowerCase()) return;
      const k = name.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      counts[k] = counts[k] || { name, n: 0 };
      counts[k].n++;
    });
  });
  return Object.values(counts).filter(c => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 40).map(c => ({ ...c, pct: Math.round(c.n / n * 100) }));
}

function avgBracket(decks) {
  if (!decks.length) return null;
  const sum = decks.reduce((s, d) => s + detectBracket(d.rawName), 0);
  return Math.round(sum / decks.length * 10) / 10;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || url.pathname.split('/').filter(Boolean).pop();
  if (!slug || slug === 'c') return new Response(null, { status: 302, headers: { Location: '/' } });

  const lang = url.pathname.startsWith('/en/') ? 'en' : 'fr';
  const commanderName = await resolveCommanderName(slug);
  const decks = await fetchDecksForCommander(commanderName);
  const cards = aggregateCards(decks, commanderName);
  const bracket = avgBracket(decks);
  const totalDecks = decks.length;
  const totalLikes = decks.reduce((s, d) => s + (d.likes || 0), 0);
  const avgCardCount = totalDecks ? Math.round(decks.reduce((s, d) => s + d.cardCount, 0) / totalDecks) : 0;

  const T = lang === 'en' ? {
    title: `${commanderName} — Commander decks, recos & stats — ManaLAB`,
    decksFound: `${totalDecks} public ${totalDecks > 1 ? 'decks' : 'deck'} on ManaLAB`,
    discover: `Discover this commander on ManaLAB`,
    descPrefix: `${totalDecks} public decks with ${commanderName} on ManaLAB.`,
    descBody: `Top ${cards.length} recommended cards, average Commander Bracket ${bracket || '—'}, mana curves and more.`,
    descEmpty: `Discover ${commanderName} decks on ManaLAB — the francophone Magic workshop. Deck analysis, Commander bracket, and community.`,
    breadcrumbHome: 'ManaLAB',
    breadcrumbCmds: 'Commanders',
    publicDecks: 'public decks',
    likes: 'likes',
    avgCards: 'avg. cards/deck',
    avgBracket: 'avg. bracket',
    ctaTitle: `Want to build your own ${commanderName} deck?`,
    ctaSub: `ManaLAB analyses your list (manabase, curve, Commander bracket, combos), tracks your collection, and connects you to other players.`,
    cta: 'Open ManaLAB →',
    topCards: 'Most played cards',
    cardCol: 'Card', freqCol: 'Frequency', pctCol: '%',
    recentDecks: 'Recent decks',
    footerLine: `ManaLAB — the francophone Magic workshop. Collection, decks, analysis, community.`
  } : {
    title: `${commanderName} — Decks Commander, recos & stats — ManaLAB`,
    decksFound: `${totalDecks} deck${totalDecks > 1 ? 's' : ''} public${totalDecks > 1 ? 's' : ''} sur ManaLAB`,
    discover: `Découvre ce commandant sur ManaLAB`,
    descPrefix: `${totalDecks} decks publics avec ${commanderName} sur ManaLAB.`,
    descBody: `Top ${cards.length} cartes recommandées, bracket Commander moyen ${bracket || '—'}, courbes et plus.`,
    descEmpty: `Découvre les decks ${commanderName} sur ManaLAB — l'atelier Magic francophone. Analyse de deck, bracket Commander, communauté.`,
    breadcrumbHome: 'ManaLAB',
    breadcrumbCmds: 'Commandants',
    publicDecks: 'decks publics',
    likes: 'likes',
    avgCards: 'cartes en moyenne',
    avgBracket: 'bracket moyen',
    ctaTitle: `Tu veux construire ton propre deck ${commanderName} ?`,
    ctaSub: `ManaLAB analyse ta liste (manabase, courbe, bracket Commander, combos), trace ta collection, et te connecte aux autres joueurs FR.`,
    cta: 'Ouvrir ManaLAB →',
    topCards: 'Cartes les plus jouées',
    cardCol: 'Carte', freqCol: 'Fréquence', pctCol: '%',
    recentDecks: 'Decks récents',
    footerLine: `ManaLAB — l'atelier Magic francophone. Collection, decks, analyse, communauté.`
  };

  const desc = totalDecks > 0
    ? `${T.descPrefix} ${T.descBody}`.slice(0, 160)
    : T.descEmpty.slice(0, 160);
  const ogParams = new URLSearchParams({
    title: commanderName,
    commander: commanderName,
    format: 'Commander',
    cards: totalDecks ? String(avgCardCount) : ''
  });
  const ogImage = `${url.origin}/api/og?${ogParams.toString()}`;
  const canonical = `${url.origin}/${lang === 'en' ? 'en/' : ''}c/${slug}`;
  const altLang = `${url.origin}/${lang === 'en' ? '' : 'en/'}c/${slug}`;

  // Schema.org : Article + ItemList des decks
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: T.breadcrumbHome, item: url.origin },
          { '@type': 'ListItem', position: 2, name: T.breadcrumbCmds, item: `${url.origin}/${lang === 'en' ? 'en/' : ''}commanders` },
          { '@type': 'ListItem', position: 3, name: commanderName, item: canonical }
        ]
      },
      {
        '@type': 'Article',
        headline: T.title,
        description: desc,
        image: ogImage,
        url: canonical,
        inLanguage: lang === 'en' ? 'en' : 'fr',
        publisher: {
          '@type': 'Organization',
          name: 'ManaLAB',
          url: url.origin,
          logo: { '@type': 'ImageObject', url: `${url.origin}/icon.svg` }
        }
      }
    ]
  };
  if (decks.length) {
    ld['@graph'].push({
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: decks.length,
      itemListElement: decks.slice(0, 10).map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: d.name,
        url: `${url.origin}/?deck=${d.id}`
      }))
    });
  }

  let html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(T.title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="${lang === 'en' ? 'fr' : 'en'}" href="${esc(altLang)}">
<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ManaLAB">
<meta property="og:title" content="${esc(T.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'fr_FR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(T.title)}">
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
  .hero h1{font-size:2.4rem;color:#c9a84c;margin-bottom:10px;line-height:1.15}
  .hero .sub{color:#a8997b;font-size:1rem}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;margin-top:18px;text-align:center}
  .stats div{background:rgba(201,168,76,.05);border:.5px solid rgba(201,168,76,.2);border-radius:8px;padding:10px 12px}
  .stats b{display:block;color:#c9a84c;font-size:1.5rem;font-family:Georgia,serif}
  .stats span{font-size:.78rem;color:#857b65}
  .cta{background:linear-gradient(135deg,rgba(201,168,76,.13),rgba(201,168,76,.03));border:1px solid #c9a84c;border-radius:12px;padding:18px 22px;margin-bottom:24px;text-align:center}
  .cta a{display:inline-block;background:#c9a84c;color:#000;padding:9px 22px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px}
  h2{font-size:1.4rem;color:#c9a84c;margin:28px 0 12px;letter-spacing:.02em}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-bottom:24px}
  .card{background:#1f1912;border:.5px solid rgba(201,168,76,.2);border-radius:10px;padding:12px 14px}
  .card h3{font-size:.96rem;color:#c9a84c;margin-bottom:4px}
  .card .meta{font-size:.74rem;color:#857b65;margin-bottom:6px}
  .card a{color:#d8c8a8;text-decoration:none}
  table{width:100%;border-collapse:collapse;font-size:.88rem;margin-bottom:24px}
  table th{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(201,168,76,.3);color:#c9a84c}
  table td{padding:7px 10px;border-bottom:.5px solid rgba(201,168,76,.1)}
  table td.pct{color:#c9a84c;font-weight:600;width:60px;text-align:right}
  .footer{text-align:center;padding:24px 0;border-top:1px solid rgba(201,168,76,.3);color:#857b65;font-size:.84rem;margin-top:32px}
  .footer a{color:#c9a84c}
  .lang-switch{position:absolute;top:18px;right:18px;font-size:.85rem}
  .lang-switch a{color:#c9a84c;text-decoration:none;padding:4px 10px;border:.5px solid rgba(201,168,76,.3);border-radius:6px}
</style>
</head>
<body>
<div class="lang-switch"><a href="${esc(altLang)}">${lang === 'en' ? 'FR' : 'EN'}</a></div>
<div class="wrap">
  <header class="hero">
    <h1>${esc(commanderName)}</h1>
    <div class="sub">${totalDecks > 0 ? esc(T.decksFound) : esc(T.discover)}</div>
    ${totalDecks > 0 ? `<div class="stats">
      <div><b>${totalDecks}</b><span>${esc(T.publicDecks)}</span></div>
      <div><b>${totalLikes}</b><span>${esc(T.likes)} ❤</span></div>
      <div><b>${avgCardCount}</b><span>${esc(T.avgCards)}</span></div>
      ${bracket ? `<div><b>${bracket}</b><span>${esc(T.avgBracket)} /5</span></div>` : ''}
    </div>` : ''}
  </header>

  <section class="cta">
    <strong>${esc(T.ctaTitle)}</strong><br>
    <span style="font-size:.9rem;color:#a8997b">${esc(T.ctaSub)}</span>
    <a href="${url.origin}/">${esc(T.cta)}</a>
  </section>

  ${cards.length ? `<h2>${esc(T.topCards)}</h2>
  <table>
    <thead><tr><th>${esc(T.cardCol)}</th><th>${esc(T.freqCol)}</th><th class="pct">${esc(T.pctCol)}</th></tr></thead>
    <tbody>
    ${cards.map(c => `<tr>
      <td><a href="https://scryfall.com/search?q=${encodeURIComponent('!"' + c.name + '"')}" target="_blank" rel="noopener">${esc(c.name)}</a></td>
      <td>${c.n} / ${totalDecks}</td>
      <td class="pct">${c.pct}%</td>
    </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${decks.length ? `<h2>${esc(T.recentDecks)}</h2>
  <div class="grid">
    ${decks.slice(0, 12).map(d => `<div class="card">
      <h3><a href="${url.origin}/?deck=${esc(d.id)}">${esc(d.name)}</a></h3>
      <div class="meta">par ${esc(d.ownerName || '?')} · ${d.cardCount} cartes${d.likes ? ` · ❤ ${d.likes}` : ''}</div>
    </div>`).join('')}
  </div>` : ''}

  <footer class="footer">
    <a href="${url.origin}/">${esc(T.footerLine)}</a>
    <div style="margin-top:8px">
      <a href="${url.origin}/legal/cgu.html">CGU</a> ·
      <a href="${url.origin}/legal/mentions.html">${lang === 'en' ? 'Legal' : 'Mentions légales'}</a> ·
      <a href="${url.origin}/legal/privacy.html">${lang === 'en' ? 'Privacy' : 'Confidentialité'}</a>
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
