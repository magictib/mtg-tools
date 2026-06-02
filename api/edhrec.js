// Proxy EDHREC. Particularité : Cloudflare devant json.edhrec.com renvoie 403
// dès qu'il manque Origin/Referer/Sec-Fetch-Site (testé live). Or le `fetch` natif
// d'undici (Vercel Node 20) supprime ces headers « forbidden » avant d'émettre la
// requête, comme le ferait un navigateur. Conséquence : impossible de passer
// Cloudflare via fetch. On bascule donc sur le module `https` natif qui n'applique
// aucun filtrage et accepte tous les headers que l'on passe.
const https = require('https');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  var path = (req.query.path || '').replace(/\.\./g, '');
  if (!/^pages\/[a-z0-9\-\/]+\.json$/.test(path)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  var opts = {
    hostname: 'json.edhrec.com',
    path: '/' + path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://edhrec.com',
      'Referer': 'https://edhrec.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site'
    }
  };

  var preq = https.request(opts, function(pres){
    var chunks = [];
    pres.on('data', function(c){ chunks.push(c); });
    pres.on('end', function(){
      var body = Buffer.concat(chunks).toString('utf8');
      if (pres.statusCode === 200) {
        res.setHeader('Cache-Control', 's-maxage=3600');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(body);
      } else {
        res.status(pres.statusCode || 502).json({
          error: 'EDHREC ' + pres.statusCode,
          snippet: body.slice(0, 300)
        });
      }
    });
  });
  preq.on('error', function(e){ res.status(500).json({ error: e.message }); });
  preq.setTimeout(15000, function(){ preq.destroy(new Error('timeout')); });
  preq.end();
};
