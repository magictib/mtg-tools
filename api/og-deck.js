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
      bodyHtml = '<article class="deck-public">';
      bodyHtml += '<header><h1>' + escHtml(name) + '</h1>';
      bodyHtml += '<p class="meta">' + escHtml(description) + '</p>';
      if (notes) bodyHtml += '<p class="notes"><em>' + escHtml(notes.slice(0, 400)) + (notes.length > 400 ? '…' : '') + '</em></p>';
      bodyHtml += '</header>';
      if (commander && commander.name) {
        bodyHtml += '<section class="commander"><h2>Commandant</h2><p><strong>' + escHtml(commander.name) + '</strong></p></section>';
      }
      bodyHtml += '<section class="cards"><h2>Liste des cartes (' + total + ')</h2>';
      Object.keys(groups).forEach(function (key) {
        if (!groups[key].length) return;
        bodyHtml += '<div class="card-group"><h3>' + escHtml(groupLabels[key]) + ' (' + groups[key].length + ')</h3><ul>';
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
      bodyHtml += '<p class="cta"><a href="' + escHtml(appUrl) + '" rel="canonical">→ Ouvrir ce deck dans ManaLAB pour l\'analyser, l\'éditer ou jouer avec</a></p>';
      bodyHtml += '<footer><p>Deck partagé via <a href="' + escHtml(origin) + '/">ManaLAB</a>, l\'outil d\'analyse et gestion de decks Magic: The Gathering.</p>';
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
    + 'body{font-family:Georgia,serif;background:#0c0a07;color:#e4d5b7;max-width:880px;margin:0 auto;padding:32px 20px;line-height:1.55}'
    + 'h1{font-family:Georgia,serif;color:#e8c96e;font-size:1.9rem;margin:0 0 .3em;text-shadow:0 0 14px rgba(201,168,76,.3)}'
    + 'h2{color:#c9a84c;font-size:1.25rem;border-bottom:1px solid rgba(201,168,76,.3);padding-bottom:4px;margin-top:1.6em}'
    + 'h3{color:#a09070;font-size:1rem;margin-top:1em}'
    + 'a{color:#e8c96e;text-decoration:underline}a:hover{color:#fff}'
    + '.meta{color:#a09070;font-size:.95rem;margin:0 0 1em}'
    + '.notes{color:#7a6856;font-size:.92rem;border-left:2px solid rgba(201,168,76,.3);padding-left:12px}'
    + '.commander p{font-size:1.05rem}'
    + '.card-group{margin:.8em 0 1.2em}'
    + 'ul{list-style:none;padding-left:0;columns:2;column-gap:24px}'
    + 'li{font-size:.92rem;padding:2px 0;break-inside:avoid;color:#bcae8e}'
    + '.cta{text-align:center;padding:18px 14px;margin:24px 0;background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.03));border:1px solid rgba(201,168,76,.4);border-radius:10px;font-size:1.05rem}'
    + '.engagement{margin-top:1.6em}'
    + '.likes{color:#e07070;font-size:.95rem}'
    + '.comment-count{color:#a09070;font-size:.85rem;margin-bottom:.6em}'
    + '.comments{display:flex;flex-direction:column;gap:10px}'
    + '.comment{background:rgba(255,255,255,.03);border-left:2px solid #c9a84c;border-radius:0 6px 6px 0;padding:8px 12px;margin:0;font-style:normal}'
    + '.comment cite{display:block;font-size:.78rem;color:#c9a84c;margin-bottom:4px;font-style:normal;font-weight:600}'
    + '.comment cite time{color:#7a6856;font-weight:400}'
    + '.comment p{margin:0;font-size:.88rem;color:#bcae8e;line-height:1.45}'
    + 'footer{margin-top:2em;padding-top:1em;border-top:.5px solid rgba(201,168,76,.2);color:#7a6856;font-size:.82rem}'
    + '@media(max-width:600px){body{padding:18px 14px}ul{columns:1}h1{font-size:1.5rem}}'
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
