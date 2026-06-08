// Page SEO/social pour un deck public ManaLAB.
// URL canonique (via rewrite Vercel) : /deck/PUB_ID
// URL legacy/direct : /api/og-deck?id=PUB_ID
//
// Production v2 (P2 #9) : le HTML rendu contient désormais le CONTENU LISIBLE
// du deck (liste des cartes, manabase, commandant, prix), un JSON-LD structuré,
// et une redirection JS différée (1.5s) au lieu d'une meta refresh immédiate.
// Cela permet :
//   - Aux crawlers Discord/Twitter de lire les Open Graph tags (inchangé)
//   - À Googlebot d'indexer le contenu réel du deck (nouveau)
//   - Aux humains d'être redirigés vers l'app SPA pour interagir avec le deck
//
// Données lues : public_decks/{id} via REST Firestore (pas de Firebase Admin SDK
// pour rester sur Vercel functions standard sans secrets).

var PROJECT_ID = 'mtg-tools-5ea4b';

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firestoreValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(firestoreValue);
  if ('mapValue' in v) {
    var out = {};
    var f = (v.mapValue.fields) || {};
    Object.keys(f).forEach(function (k) { out[k] = firestoreValue(f[k]); });
    return out;
  }
  return null;
}

// Catégorise une carte par type (très simple — assez pour le SEO body).
function cardCategory(c) {
  var t = String(c && c.type || c && c.typeLine || '').toLowerCase();
  if (t.indexOf('land') >= 0) return 'lands';
  if (t.indexOf('creature') >= 0) return 'creatures';
  if (t.indexOf('planeswalker') >= 0) return 'planeswalkers';
  if (t.indexOf('instant') >= 0) return 'instants';
  if (t.indexOf('sorcery') >= 0) return 'sorceries';
  if (t.indexOf('artifact') >= 0) return 'artifacts';
  if (t.indexOf('enchantment') >= 0) return 'enchantments';
  return 'other';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var id = (req.query && req.query.id) || '';
  if (!/^[A-Za-z0-9_\-]{4,128}$/.test(id)) {
    res.status(400).send('Invalid id');
    return;
  }

  var origin = 'https://' + (req.headers.host || 'valebro-bhce.vercel.app');
  // Lien canonique côté SPA : /#shareddeck=ID. C'est l'URL utilisée par le client SPA.
  var appUrl = origin + '/#shareddeck=' + encodeURIComponent(id);
  // L'URL canonique SEO est la route propre /deck/{id}
  var canonical = origin + '/deck/' + encodeURIComponent(id);

  // Defaults (fallback si la requête Firestore échoue : on redirige quand même)
  var title = 'ManaLAB — deck Magic';
  var description = 'Découvre ce deck partagé sur ManaLAB.';
  var ogImage = origin + '/icon.svg';
  var bodyHtml = '';
  var jsonLd = null;

  try {
    var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/public_decks/' + encodeURIComponent(id);
    var r = await fetch(url);
    if (r.ok) {
      var doc = await r.json();
      var fields = (doc && doc.fields) || {};
      var name = firestoreValue(fields.name) || 'Deck Magic';
      var ownerName = firestoreValue(fields.ownerName) || '';
      var format = firestoreValue(fields.format) || '';
      var commander = firestoreValue(fields.commander) || null;
      var cards = firestoreValue(fields.cards) || [];
      var notes = firestoreValue(fields.notes) || '';
      var pw = firestoreValue(fields.pw) || null;
      var sharedAt = firestoreValue(fields.sharedAt) || null;
      // Engagement social (P0 #3 audit concurrentiel) : likes + 3 derniers commentaires
      // injectés dans le HTML → signal Google "page vivante", boost ranking
      var likes = firestoreValue(fields.likes) || [];
      var comments = firestoreValue(fields.comments) || [];
      var likeCount = Array.isArray(likes) ? likes.length : 0;
      var commentCount = Array.isArray(comments) ? comments.length : 0;
      var total = 0;
      if (Array.isArray(cards)) cards.forEach(function (c) { total += (c && c.qty) || 1; });

      // Meta tags
      title = name + ' — Deck ' + (format ? format + ' ' : '') + 'sur ManaLAB';
      var bits = [];
      if (ownerName) bits.push('par ' + ownerName);
      if (format) bits.push('format ' + format);
      if (total) bits.push(total + ' cartes');
      if (commander && commander.name) bits.push('commandant : ' + commander.name);
      if (pw && pw.score != null) bits.push('Score ManaLAB ' + Math.round(pw.score) + '/100');
      if (likeCount > 0) bits.push(likeCount + ' like' + (likeCount > 1 ? 's' : ''));
      if (commentCount > 0) bits.push(commentCount + ' commentaire' + (commentCount > 1 ? 's' : ''));
      description = bits.length ? bits.join(' · ') : 'Deck partagé sur ManaLAB.';

      // ── Body lisible pour les moteurs de recherche : regroupe les cartes par
      // catégorie (terrains, créatures, sorts…). Texte plat = idéal pour Google.
      var groups = { creatures: [], planeswalkers: [], instants: [], sorceries: [], artifacts: [], enchantments: [], lands: [], other: [] };
      if (Array.isArray(cards)) {
        cards.forEach(function (c) {
          if (!c || !c.name) return;
          var cat = cardCategory(c);
          groups[cat].push(c);
        });
      }
      var groupLabels = {
        creatures: 'Créatures', planeswalkers: 'Planeswalkers', instants: 'Éphémères',
        sorceries: 'Rituels', artifacts: 'Artefacts', enchantments: 'Enchantements',
        lands: 'Terrains', other: 'Autres'
      };
      // Fetch image du commandant via Scryfall (rapide, single card)
      var cmdImg = '';
      if (commander && commander.name) {
        try {
          var sR = await fetch('https://api.scryfall.com/cards/named?exact=' + encodeURIComponent(commander.name) + '&format=json');
          if (sR.ok) {
            var sC = await sR.json();
            cmdImg = (sC && sC.image_uris && sC.image_uris.normal)
              || (sC && sC.card_faces && sC.card_faces[0] && sC.card_faces[0].image_uris && sC.card_faces[0].image_uris.normal)
              || '';
          }
        } catch (_) {}
      }

      // Compteurs par type pour la stripe de composition
      var typeOrder = ['lands', 'creatures', 'instants', 'sorceries', 'enchantments', 'artifacts', 'planeswalkers', 'other'];
      var typeColors = {
        lands: '#7ec86a',
        creatures: '#c8a878',
        instants: '#7eb3d9',
        sorceries: '#b48cdc',
        enchantments: '#e8c14a',
        artifacts: '#9d9d9d',
        planeswalkers: '#c14ad9',
        other: '#666'
      };
      var typeCounts = {};
      typeOrder.forEach(function (k) {
        typeCounts[k] = (groups[k] || []).reduce(function (s, c) { return s + (c.qty || 1); }, 0);
      });
      var totalNonZero = Object.values(typeCounts).reduce(function (s, v) { return s + v; }, 0) || 1;
      // Score visuel (cercle gauge SVG)
      var scoreVal = (pw && pw.score != null) ? Math.round(pw.score) : null;
      var scoreCol = scoreVal == null ? '#7a6856' : (scoreVal >= 80 ? '#7ec86a' : scoreVal >= 60 ? '#e8c14a' : scoreVal >= 40 ? '#e88a4a' : '#d9645a');
      function scoreSvg() {
        if (scoreVal == null) return '';
        var c = 2 * Math.PI * 40; // r=40
        var dash = c * (scoreVal / 100);
        return '<svg width="100" height="100" viewBox="0 0 100 100" style="display:block">'
          + '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>'
          + '<circle cx="50" cy="50" r="40" fill="none" stroke="' + scoreCol + '" stroke-width="8" stroke-dasharray="' + dash + ' ' + (c - dash) + '" stroke-dashoffset="0" transform="rotate(-90 50 50)" stroke-linecap="round"/>'
          + '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="' + scoreCol + '" font-size="24" font-weight="700" font-family="Georgia,serif">' + scoreVal + '</text>'
          + '<text x="50" y="68" text-anchor="middle" fill="#7a6856" font-size="9" font-family="Georgia,serif">/100</text>'
          + '</svg>';
      }

      bodyHtml = '<article class="deck-public">';
      // ── HERO carte d'identité du deck ──
      bodyHtml += '<header class="deck-hero">';
      bodyHtml += '<div class="hero-bg" style="background:linear-gradient(135deg,rgba(201,168,76,.10),rgba(74,160,232,.05))"></div>';
      bodyHtml += '<div class="hero-inner">';
      if (cmdImg) {
        bodyHtml += '<div class="hero-cmd-img"><img src="' + escHtml(cmdImg) + '" alt="' + escHtml(commander.name) + '" loading="lazy"></div>';
      }
      bodyHtml += '<div class="hero-meta">';
      bodyHtml += '<div class="hero-tag">ManaLAB · Deck partagé</div>';
      bodyHtml += '<h1>' + escHtml(name) + '</h1>';
      if (commander && commander.name) {
        bodyHtml += '<div class="hero-cmd">👑 ' + escHtml(commander.name) + '</div>';
      }
      bodyHtml += '<div class="hero-kpis">';
      bodyHtml += '<div class="hero-kpi"><div class="hk-val">' + total + '</div><div class="hk-lbl">Cartes</div></div>';
      if (format) bodyHtml += '<div class="hero-kpi"><div class="hk-val">' + escHtml(format.charAt(0).toUpperCase() + format.slice(1)) + '</div><div class="hk-lbl">Format</div></div>';
      if (ownerName) bodyHtml += '<div class="hero-kpi"><div class="hk-val">' + escHtml(ownerName) + '</div><div class="hk-lbl">Auteur</div></div>';
      if (likeCount > 0) bodyHtml += '<div class="hero-kpi"><div class="hk-val" style="color:#e07070">❤ ' + likeCount + '</div><div class="hk-lbl">J\'aime</div></div>';
      if (commentCount > 0) bodyHtml += '<div class="hero-kpi"><div class="hk-val" style="color:#7eb3d9">💬 ' + commentCount + '</div><div class="hk-lbl">Avis</div></div>';
      bodyHtml += '</div>';
      bodyHtml += '</div>'; // /hero-meta
      if (scoreVal != null) {
        bodyHtml += '<div class="hero-score">' + scoreSvg() + '<div class="hs-lbl">Score ManaLAB</div></div>';
      }
      bodyHtml += '</div>'; // /hero-inner
      bodyHtml += '</header>';

      // ── Composition visuelle (stripe colorée + chips) ──
      bodyHtml += '<section class="composition">';
      bodyHtml += '<h2>Composition</h2>';
      bodyHtml += '<div class="comp-stripe">';
      typeOrder.forEach(function (k) {
        if (!typeCounts[k]) return;
        var pct = (typeCounts[k] / totalNonZero * 100).toFixed(1);
        bodyHtml += '<div class="comp-seg" style="background:' + typeColors[k] + ';width:' + pct + '%" title="' + escHtml(groupLabels[k]) + ' : ' + typeCounts[k] + '"></div>';
      });
      bodyHtml += '</div>';
      bodyHtml += '<div class="comp-chips">';
      typeOrder.forEach(function (k) {
        if (!typeCounts[k]) return;
        bodyHtml += '<span class="comp-chip"><span class="cc-dot" style="background:' + typeColors[k] + '"></span>' + escHtml(groupLabels[k]) + ' <b>' + typeCounts[k] + '</b></span>';
      });
      bodyHtml += '</div>';
      bodyHtml += '</section>';

      // ── Notes (si présentes) ──
      if (notes) {
        bodyHtml += '<section class="notes-section"><h2>Stratégie</h2><p class="notes">' + escHtml(notes.slice(0, 800)) + (notes.length > 800 ? '…' : '') + '</p></section>';
      }

      // ── Liste des cartes par catégorie ──
      bodyHtml += '<section class="cards"><h2>Liste des cartes (' + total + ')</h2>';
      Object.keys(groups).forEach(function (key) {
        if (!groups[key].length) return;
        bodyHtml += '<div class="card-group"><h3><span class="cg-dot" style="background:' + (typeColors[key] || '#666') + '"></span>' + escHtml(groupLabels[key]) + ' <span class="cg-count">' + groups[key].length + '</span></h3><ul>';
        groups[key].slice(0, 200).forEach(function (c) {
          var qty = c.qty || 1;
          bodyHtml += '<li>' + qty + '× ' + escHtml(c.name) + '</li>';
        });
        bodyHtml += '</ul></div>';
      });
      bodyHtml += '</section>';
      // Engagement social (likes + commentaires) — visible par les bots ET utiles aux humains.
      // Affichage simple, pas d'interaction depuis cette page (lecture seule SEO ; pour interagir
      // l'utilisateur doit cliquer sur le lien ManaLAB → SPA).
      if (likeCount > 0 || commentCount > 0) {
        bodyHtml += '<section class="engagement"><h2>Communauté</h2>';
        if (likeCount > 0) bodyHtml += '<p class="likes">❤ <strong>' + likeCount + '</strong> joueur' + (likeCount > 1 ? 's ont' : ' a') + ' aimé ce deck</p>';
        if (commentCount > 0) {
          // 3 derniers commentaires (les plus récents), tronqués à 280 chars
          var sortedComments = comments.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 3);
          bodyHtml += '<p class="comment-count">' + commentCount + ' commentaire' + (commentCount > 1 ? 's' : '') + ' au total</p>';
          bodyHtml += '<div class="comments">';
          sortedComments.forEach(function (c) {
            var when = c.ts ? new Date(c.ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            var text = (c.text || '').slice(0, 280) + ((c.text || '').length > 280 ? '…' : '');
            bodyHtml += '<blockquote class="comment"><cite>' + escHtml(c.name || 'Anonyme') + (when ? ' <time>· ' + escHtml(when) + '</time>' : '') + '</cite><p>' + escHtml(text) + '</p></blockquote>';
          });
          bodyHtml += '</div>';
        }
        bodyHtml += '</section>';
      }
      bodyHtml += '<div class="cta"><div style="font-size:.74rem;color:#a09070;margin-bottom:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:600">⚡ Tu veux jouer avec ce deck ?</div><a href="' + escHtml(appUrl) + '" rel="canonical">Ouvrir dans ManaLAB →</a><div style="font-size:.72rem;color:#7a6856;margin-top:10px">Analyse profonde · suggestions de swaps · simulation mana base · partage social</div></div>';
      bodyHtml += '<footer><p>Deck partagé via <a href="' + escHtml(origin) + '/">ManaLAB</a> — outil gratuit d\'analyse et de gestion de decks Magic: The Gathering.</p>';
      if (sharedAt) bodyHtml += '<p><small>Publié le ' + escHtml(new Date(sharedAt).toLocaleDateString('fr-FR')) + '</small></p>';
      bodyHtml += '</footer></article>';

      // ── Structured data JSON-LD pour Google Rich Results
      // InteractionCounter sur likes/commentaires = signal Rich Results pour les social actions
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        'name': name,
        'description': description,
        'url': canonical,
        'inLanguage': 'fr',
        'isPartOf': { '@type': 'WebSite', 'name': 'ManaLAB', 'url': origin + '/' }
      };
      if (ownerName) jsonLd.author = { '@type': 'Person', 'name': ownerName };
      if (sharedAt) jsonLd.datePublished = new Date(sharedAt).toISOString();
      // Engagement counters (visible dans les Rich Results SERP)
      if (likeCount > 0 || commentCount > 0) {
        jsonLd.interactionStatistic = [];
        if (likeCount > 0) jsonLd.interactionStatistic.push({
          '@type': 'InteractionCounter',
          'interactionType': { '@type': 'LikeAction' },
          'userInteractionCount': likeCount
        });
        if (commentCount > 0) jsonLd.interactionStatistic.push({
          '@type': 'InteractionCounter',
          'interactionType': { '@type': 'CommentAction' },
          'userInteractionCount': commentCount
        });
      }
      // Commentaires top en aggregateRating-like (les 3 plus récents)
      if (commentCount > 0) {
        var topComments = comments.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 3);
        jsonLd.comment = topComments.map(function (c) {
          return {
            '@type': 'Comment',
            'author': { '@type': 'Person', 'name': c.name || 'Anonyme' },
            'text': (c.text || '').slice(0, 280),
            'dateCreated': c.ts ? new Date(c.ts).toISOString() : undefined
          };
        });
      }
    }
  } catch (e) {
    // silent fallback
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  // X-Robots-Tag : on autorise l'indexation explicitement
  res.setHeader('X-Robots-Tag', 'index, follow');

  var html = '<!DOCTYPE html><html lang="fr"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + escHtml(title) + '</title>'
    + '<meta name="description" content="' + escHtml(description) + '">'
    + '<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">'
    + '<link rel="canonical" href="' + escHtml(canonical) + '">'
    + '<meta property="og:type" content="article">'
    + '<meta property="og:site_name" content="ManaLAB">'
    + '<meta property="og:title" content="' + escHtml(title) + '">'
    + '<meta property="og:description" content="' + escHtml(description) + '">'
    + '<meta property="og:image" content="' + escHtml(ogImage) + '">'
    + '<meta property="og:url" content="' + escHtml(canonical) + '">'
    + '<meta property="og:locale" content="fr_FR">'
    + '<meta name="twitter:card" content="summary_large_image">'
    + '<meta name="twitter:title" content="' + escHtml(title) + '">'
    + '<meta name="twitter:description" content="' + escHtml(description) + '">'
    + '<meta name="twitter:image" content="' + escHtml(ogImage) + '">'
    + (jsonLd ? '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>' : '')
    + '<style>'
    + '*{box-sizing:border-box}'
    + 'body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;background:linear-gradient(180deg,#0e1117 0%,#070a0e 100%);color:#e4d5b7;max-width:920px;margin:0 auto;padding:24px 20px;line-height:1.55;min-height:100vh}'
    + 'h1{font-family:Georgia,serif;color:#e8c96e;font-size:2rem;margin:0 0 .2em;text-shadow:0 0 14px rgba(201,168,76,.3);line-height:1.15;letter-spacing:-0.01em}'
    + 'h2{color:#c9a84c;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;border-bottom:1px solid rgba(201,168,76,.3);padding-bottom:6px;margin:2em 0 .8em;font-family:-apple-system,"Segoe UI",sans-serif}'
    + 'h3{color:#a09070;font-size:.9rem;margin:1em 0 .4em;display:flex;align-items:center;gap:8px;font-family:-apple-system,"Segoe UI",sans-serif;font-weight:600}'
    + 'a{color:#e8c96e;text-decoration:underline}a:hover{color:#fff}'
    /* HERO — carte d'identité du deck */
    + '.deck-hero{position:relative;border:1px solid rgba(201,168,76,.32);border-radius:16px;overflow:hidden;margin-bottom:18px;box-shadow:0 8px 32px rgba(0,0,0,.4)}'
    + '.hero-bg{position:absolute;inset:0;z-index:0}'
    + '.hero-inner{position:relative;z-index:1;padding:22px 24px;display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center}'
    + '.hero-cmd-img{flex-shrink:0;width:130px;border-radius:9px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.6)}'
    + '.hero-cmd-img img{width:100%;display:block}'
    + '.hero-meta{min-width:0}'
    + '.hero-tag{font-size:.62rem;color:#7a6856;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:5px}'
    + '.hero-cmd{color:#c9a84c;font-size:.96rem;margin:6px 0 14px;font-weight:500}'
    + '.hero-kpis{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}'
    + '.hero-kpi{padding:7px 12px;background:rgba(0,0,0,.3);border:.5px solid rgba(201,168,76,.25);border-radius:8px;min-width:0}'
    + '.hk-val{font-size:1.1rem;color:#e8c96e;font-weight:700;line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px}'
    + '.hk-lbl{font-size:.6rem;color:#7a6856;letter-spacing:.08em;text-transform:uppercase;margin-top:3px;font-weight:600}'
    + '.hero-score{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px}'
    + '.hs-lbl{font-size:.62rem;color:#7a6856;letter-spacing:.1em;text-transform:uppercase;font-weight:600}'
    /* COMPOSITION stripe */
    + '.composition{margin-bottom:16px}'
    + '.comp-stripe{display:flex;height:18px;border-radius:5px;overflow:hidden;background:rgba(0,0,0,.4);margin-bottom:10px;box-shadow:inset 0 0 6px rgba(0,0,0,.4)}'
    + '.comp-seg{transition:opacity .15s}.comp-seg:hover{opacity:.7}'
    + '.comp-chips{display:flex;flex-wrap:wrap;gap:6px}'
    + '.comp-chip{padding:4px 9px;background:rgba(255,255,255,.04);border:.5px solid rgba(201,168,76,.25);border-radius:11px;font-size:.74rem;color:#bcae8e;display:inline-flex;align-items:center;gap:5px}'
    + '.cc-dot{display:inline-block;width:8px;height:8px;border-radius:50%}'
    /* CARDS LIST par catégorie */
    + '.notes-section .notes{color:#9a8a72;font-size:.92rem;border-left:3px solid rgba(201,168,76,.4);padding:8px 12px;background:rgba(255,255,255,.02);border-radius:0 6px 6px 0;font-style:italic}'
    + '.cards .card-group{margin:.6em 0 1em;background:rgba(255,255,255,.018);border-radius:8px;padding:10px 14px;border:.5px solid rgba(201,168,76,.12)}'
    + '.cg-dot{display:inline-block;width:9px;height:9px;border-radius:50%}'
    + '.cg-count{color:#7a6856;font-size:.78rem;margin-left:auto;font-weight:400}'
    + 'ul{list-style:none;padding-left:0;columns:2;column-gap:24px;margin:.4em 0 0}'
    + 'li{font-size:.88rem;padding:2px 0;break-inside:avoid;color:#bcae8e}'
    /* CTA */
    + '.cta{text-align:center;padding:20px 16px;margin:24px 0;background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(74,160,232,.04));border:1px solid rgba(201,168,76,.45);border-radius:12px;font-size:1.05rem;font-weight:500}'
    + '.cta a{display:inline-block;background:linear-gradient(180deg,#c9a84c,#7a5a1f);color:#0a0805;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;letter-spacing:.02em;transition:transform .15s}'
    + '.cta a:hover{transform:translateY(-2px);color:#0a0805}'
    /* ENGAGEMENT */
    + '.engagement{margin-top:1.6em}'
    + '.likes{color:#e07070;font-size:.95rem}'
    + '.comment-count{color:#a09070;font-size:.85rem;margin-bottom:.6em}'
    + '.comments{display:flex;flex-direction:column;gap:10px}'
    + '.comment{background:rgba(255,255,255,.03);border-left:2px solid #c9a84c;border-radius:0 6px 6px 0;padding:8px 12px;margin:0;font-style:normal}'
    + '.comment cite{display:block;font-size:.78rem;color:#c9a84c;margin-bottom:4px;font-style:normal;font-weight:600}'
    + '.comment cite time{color:#7a6856;font-weight:400}'
    + '.comment p{margin:0;font-size:.88rem;color:#bcae8e;line-height:1.45}'
    + 'footer{margin-top:2.5em;padding-top:1.2em;border-top:.5px solid rgba(201,168,76,.18);color:#7a6856;font-size:.82rem;text-align:center}'
    /* RESPONSIVE */
    + '@media(max-width:700px){'
    +   '.hero-inner{grid-template-columns:1fr;gap:14px;text-align:center;padding:18px}'
    +   '.hero-cmd-img{width:120px;margin:0 auto}'
    +   '.hero-kpis{justify-content:center}'
    +   '.hero-score{margin:0 auto}'
    +   'h1{font-size:1.5rem}'
    +   'ul{columns:1}'
    +   'body{padding:14px 12px}'
    + '}'
    + '</style>'
    + '</head><body>'
    + (bodyHtml || ('<h1>' + escHtml(title) + '</h1><p>' + escHtml(description) + '</p><p><a href="' + escHtml(appUrl) + '">→ Ouvrir le deck sur ManaLAB</a></p>'))
    // Redirection JS différée : 1.5s laisse le bot Google parser le contenu, et
    // le humain qui regarde voit brièvement la page SEO avant le passage en SPA.
    // Le bot ignore les setTimeout > 200ms (selon docs Google) — il indexera donc
    // le contenu HTML rendu côté serveur.
    + '<script>(function(){var ua=navigator.userAgent.toLowerCase();var isBot=/bot|crawl|spider|googlebot|bingbot|yandex|duckduck|baidu|facebookexternalhit|twitterbot|slack|discord/.test(ua);if(!isBot)setTimeout(function(){window.location.replace(' + JSON.stringify(appUrl) + ');},1500);})();</script>'
    + '</body></html>';

  res.status(200).send(html);
};
