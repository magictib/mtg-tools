// OCR de carte MTG via Google Gemini 1.5 Flash (Vision).
// Reçoit { image: "<base64>" } en POST, retourne { name, scryfall? }.
//
// Variables d'environnement Vercel requises :
//   GEMINI_API_KEY   = clé obtenue sur https://aistudio.google.com/apikey
//
// Free tier Gemini 1.5 Flash : 15 req/min, 1500 req/jour — largement suffisant
// pour un usage perso ou petit groupe. Si la clé manque, on renvoie 503 avec
// un message clair côté client.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  var key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(503).json({
      error: 'GEMINI_API_KEY non configurée sur Vercel.',
      hint: 'Crée une clé gratuite sur https://aistudio.google.com/apikey puis ajoute GEMINI_API_KEY dans les Environment Variables du projet Vercel.'
    });
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
    // Strip data URL prefix si présent
    var base64 = image.replace(/^data:image\/\w+;base64,/, '');
    var mime = 'image/jpeg';
    var dataUrlMatch = image.match(/^data:(image\/\w+);base64,/);
    if (dataUrlMatch) mime = dataUrlMatch[1];

    var prompt = 'You are a Magic: The Gathering card identification expert. Identify the card visible in this image. Respond with ONLY the EXACT ENGLISH NAME of the card as it appears in Scryfall, nothing else — no quotes, no explanation, no commentary. If you cannot identify it confidently, respond with "UNKNOWN".';

    var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(key);
    var r = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 60 }
      })
    });
    if (!r.ok) {
      var txt = await r.text();
      res.status(502).json({ error: 'Gemini ' + r.status, detail: txt.slice(0, 400) });
      return;
    }
    var data = await r.json();
    var name = '';
    try {
      var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      if (parts && parts[0] && parts[0].text) name = parts[0].text.trim();
    } catch (e) { /* ignore */ }
    // Nettoyage : enlève les guillemets, points finaux, "Card name: " parasites
    name = name.replace(/^["'`]+|["'`]+$/g, '').replace(/\.$/, '').replace(/^card name:\s*/i, '').trim();

    if (!name || /^unknown$/i.test(name)) {
      res.status(200).json({ name: null, message: 'Carte non identifiée. Réessaie avec une photo plus nette ou un meilleur cadrage.' });
      return;
    }

    // Lookup Scryfall pour valider et enrichir
    var scryUrl = 'https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(name);
    var sr = await fetch(scryUrl);
    var scry = null;
    if (sr.ok) {
      var sd = await sr.json();
      scry = {
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
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ name: name, scryfall: scry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
