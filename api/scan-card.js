// OCR de carte MTG via GitHub Models (gpt-4o-mini Vision) ou Gemini en fallback.
// Reçoit { image: "<base64 ou dataURL>" } en POST, retourne { name, scryfall? }.
// Voir api/_llm.js pour la config des providers.

var llm = require('./_llm.js');

function serializeScryfall(sd) {
  if (!sd) return null;
  return {
    id: sd.id,
    name: sd.name,
    set: sd.set,
    set_name: sd.set_name,
    collector_number: sd.collector_number,
    rarity: sd.rarity,
    type_line: sd.type_line,
    mana_cost: sd.mana_cost,
    colors: sd.colors,
    cmc: sd.cmc,
    oracle_text: sd.oracle_text,
    image_uris: sd.image_uris || (sd.card_faces && sd.card_faces[0] && sd.card_faces[0].image_uris),
    prices: sd.prices,
    scryfall_uri: sd.scryfall_uri
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!llm.llmAvailable()) {
    res.status(503).json(llm.llmSetupHint());
    return;
  }

  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    var image = body && body.image;
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'image (base64) required' });
      return;
    }
    // Détecte le mime type si data URL, sinon assume jpeg
    var mime = 'image/jpeg';
    var dataUrlMatch = image.match(/^data:(image\/\w+);base64,/);
    if (dataUrlMatch) mime = dataUrlMatch[1];
    var base64 = image.replace(/^data:image\/\w+;base64,/, '');

    var ident = null;
    try {
      ident = await llm.identifyCard(base64, mime);
    } catch (e) {
      res.status(502).json({ error: e.message, detail: e.detail || '' });
      return;
    }
    var name = (ident && ident.name) || '';
    name = String(name || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\.$/, '')
      .replace(/^card name:\s*/i, '')
      .trim();
    var setCode = (ident && ident.set) ? String(ident.set).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0, 5) : '';
    var collector = (ident && ident.collector_number) ? String(ident.collector_number).replace(/^0+/, '').replace(/[^a-z0-9\-★]/gi,'').slice(0, 12) : '';

    if (!name || /^unknown$/i.test(name)) {
      res.status(200).json({ name: null, message: 'Carte non identifiée. Réessaie avec une photo plus nette ou un meilleur cadrage.' });
      return;
    }

    // Lookup Scryfall : si on a set + collector, on tape la VERSION exacte ;
    // sinon fallback sur fuzzy par nom.
    var scry = null;
    var triedExactVersion = false;
    if (setCode && collector) {
      triedExactVersion = true;
      try {
        var exactUrl = 'https://api.scryfall.com/cards/' + encodeURIComponent(setCode) + '/' + encodeURIComponent(collector);
        var er = await fetch(exactUrl);
        if (er.ok) {
          var ed = await er.json();
          scry = serializeScryfall(ed);
          if (ed.name) name = ed.name;
        }
      } catch (e) { /* fallback ci-dessous */ }
    }
    if (!scry) {
      try {
        var sr = await fetch('https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(name));
        if (sr.ok) {
          var sd = await sr.json();
          scry = serializeScryfall(sd);
          if (sd.name) name = sd.name;
        }
      } catch (e) { /* on garde le name brut */ }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      name: name,
      scryfall: scry,
      detected_set: setCode || null,
      detected_collector: collector || null,
      exact_version_matched: triedExactVersion && !!scry
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
