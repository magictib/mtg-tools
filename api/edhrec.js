module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  var path = (req.query.path || '').replace(/\.\./g, '');
  if (!/^pages\/[a-z0-9\-\/]+\.json$/.test(path)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    var r = await fetch('https://json.edhrec.com/' + path, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) return res.status(r.status).json({ error: 'EDHREC ' + r.status });
    var d = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
