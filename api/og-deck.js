// Génère un HTML mini avec Open Graph tags dynamiques pour un deck public,
// puis redirige le navigateur vers l'app sur le bon hash.
// URL : /api/og-deck?id=PUB_ID
// Les crawlers (Discord, Twitter, Facebook…) liront les og:tags ; les
// utilisateurs humains seront redirigés vers /#shareddeck=PUB_ID.

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var id = (req.query && req.query.id) || '';
  if (!/^[A-Za-z0-9_\-]{4,128}$/.test(id)) {
    res.status(400).send('Invalid id');
    return;
  }

  var origin = 'https://' + (req.headers.host || 'valebro-bhce.vercel.app');
  var appUrl = origin + '/#shareddeck=' + encodeURIComponent(id);

  // Defaults (fallback si la requête Firestore échoue : on redirige quand même)
  var title = 'ManaLAB — deck Magic';
  var description = 'Découvre ce deck partagé sur ManaLAB.';
  var ogImage = origin + '/icon.svg';

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
      var total = 0;
      if (Array.isArray(cards)) {
        cards.forEach(function (c) { total += (c && c.qty) || 1; });
      }
      title = name + ' — ManaLAB';
      var bits = [];
      if (ownerName) bits.push('par ' + ownerName);
      if (format) bits.push('format ' + format);
      if (total) bits.push(total + ' cartes');
      if (commander && commander.name) bits.push('commandant : ' + commander.name);
      description = bits.length ? bits.join(' · ') : 'Deck partagé sur ManaLAB.';
    }
  } catch (e) {
    // silent fallback
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(
    '<!DOCTYPE html><html lang="fr"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + escHtml(title) + '</title>'
    + '<meta name="description" content="' + escHtml(description) + '">'
    + '<meta property="og:type" content="article">'
    + '<meta property="og:site_name" content="ManaLAB">'
    + '<meta property="og:title" content="' + escHtml(title) + '">'
    + '<meta property="og:description" content="' + escHtml(description) + '">'
    + '<meta property="og:image" content="' + escHtml(ogImage) + '">'
    + '<meta property="og:url" content="' + escHtml(req.url ? (origin + req.url) : appUrl) + '">'
    + '<meta property="og:locale" content="fr_FR">'
    + '<meta name="twitter:card" content="summary_large_image">'
    + '<meta name="twitter:title" content="' + escHtml(title) + '">'
    + '<meta name="twitter:description" content="' + escHtml(description) + '">'
    + '<meta name="twitter:image" content="' + escHtml(ogImage) + '">'
    + '<meta http-equiv="refresh" content="0; url=' + escHtml(appUrl) + '">'
    + '<link rel="canonical" href="' + escHtml(appUrl) + '">'
    + '<style>body{font-family:Georgia,serif;background:#0c0a07;color:#e4d5b7;text-align:center;padding:48px 16px}a{color:#e8c96e}</style>'
    + '</head><body>'
    + '<h1 style="font-family:Georgia,serif">' + escHtml(title) + '</h1>'
    + '<p>' + escHtml(description) + '</p>'
    + '<p><a href="' + escHtml(appUrl) + '">→ Ouvrir le deck sur ManaLAB</a></p>'
    + '<script>setTimeout(function(){window.location.replace(' + JSON.stringify(appUrl) + ');},50);</script>'
    + '</body></html>'
  );
};
