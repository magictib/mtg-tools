module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  var path = (req.query.path || '').replace(/\.\./g, '');
  if (!/^pages\/[a-z0-9\-\/]+\.json$/.test(path)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    // Cloudflare devant json.edhrec.com bloque (403) toute requête qui ressemble à un bot.
    // Pour passer, on doit mimer un fetch « same-site » du SPA edhrec.com :
    // - Origin + Referer sur edhrec.com (obligatoires)
    // - Sec-Fetch-Site: same-site (sinon CF voit cross-site → bot)
    // - User-Agent moderne (le UA Chrome 124 d'il y a 18 mois était devenu suspect)
    var r = await fetch('https://json.edhrec.com/' + path, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://edhrec.com',
        'Referer': 'https://edhrec.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      }
    });
    if (!r.ok) return res.status(r.status).json({ error: 'EDHREC ' + r.status });
    var d = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
