// Proxy Moxfield — contournement du blocage Cloudflare via User-Agent compliant + fallback HTML scraping

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  var id = (req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id || id.length < 4 || id.length > 64) {
    return res.status(400).json({ error: 'Invalid deck id' });
  }

  // Headers conformes aux guidelines Moxfield (UA identifiant + accept)
  // Cf. https://www.moxfield.com/help/api : tools doivent envoyer un UA descriptif
  var commonHeaders = {
    'User-Agent': 'ManaLAB/1.0 (+https://valebro.vercel.app; +https://github.com/magictib/mtg-tools) MTG-deck-importer',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.moxfield.com/',
    'Origin': 'https://www.moxfield.com'
  };

  // Strategie : essai en cascade des endpoints connus
  var endpoints = [
    'https://api2.moxfield.com/v3/decks/all/' + id,
    'https://api.moxfield.com/v2/decks/all/' + id,
    'https://api.moxfield.com/v3/decks/all/' + id
  ];

  var lastStatus = 0;
  var lastError = '';

  for (var i = 0; i < endpoints.length; i++) {
    try {
      var r = await fetch(endpoints[i], { headers: commonHeaders });
      lastStatus = r.status;
      if (r.ok) {
        var d = await r.json();
        if (d && (d.boards || d.mainboard || d.name)) {
          res.setHeader('Cache-Control', 's-maxage=600');
          return res.json(d);
        }
        lastError = 'unexpected payload';
        continue;
      }
      lastError = 'HTTP ' + r.status;
    } catch (e) {
      lastError = e.message || String(e);
    }
  }

  // Dernier recours : scraper la page HTML publique pour extraire le JSON Next.js (__NEXT_DATA__)
  try {
    var pageR = await fetch('https://www.moxfield.com/decks/' + id, {
      headers: Object.assign({}, commonHeaders, { 'Accept': 'text/html,application/xhtml+xml' })
    });
    if (pageR.ok) {
      var html = await pageR.text();
      var m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (m && m[1]) {
        try {
          var nextData = JSON.parse(m[1]);
          // Cherche un objet ressemblant a un deck Moxfield
          var deckData = _findDeckInNextData(nextData);
          if (deckData) {
            res.setHeader('Cache-Control', 's-maxage=600');
            return res.json(deckData);
          }
        } catch (e) { lastError = 'parse __NEXT_DATA__: ' + e.message; }
      } else {
        lastError = 'pas de __NEXT_DATA__ dans la page';
      }
    } else {
      lastError = 'HTML ' + pageR.status;
    }
  } catch (e) {
    lastError = 'HTML scrape: ' + (e.message || String(e));
  }

  return res.status(lastStatus || 502).json({
    error: 'Moxfield bloque les requêtes API (' + lastError + '). Essayez de copier-coller la liste manuellement.'
  });
};

function _findDeckInNextData(obj, depth) {
  depth = depth || 0;
  if (depth > 12 || !obj || typeof obj !== 'object') return null;
  // Heuristique : un objet deck Moxfield a name + (boards || mainboard || commanders)
  if (obj.name && (obj.boards || obj.mainboard || obj.commanders)) return obj;
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      var r = _findDeckInNextData(obj[i], depth + 1);
      if (r) return r;
    }
    return null;
  }
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      var r2 = _findDeckInNextData(obj[k], depth + 1);
      if (r2) return r2;
    }
  }
  return null;
}
