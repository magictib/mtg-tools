module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  var id = (req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id || id.length < 4 || id.length > 64) {
    return res.status(400).json({ error: 'Invalid deck id' });
  }

  // Endpoint Moxfield public
  var url = 'https://api2.moxfield.com/v3/decks/all/' + id;

  try {
    var r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.moxfield.com/'
      }
    });
    if (!r.ok) {
      // Fallback v2 si v3 echoue
      if (r.status === 404 || r.status === 401 || r.status === 403) {
        var r2 = await fetch('https://api.moxfield.com/v2/decks/all/' + id, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.moxfield.com/'
          }
        });
        if (!r2.ok) return res.status(r2.status).json({ error: 'Moxfield ' + r2.status });
        var d2 = await r2.json();
        res.setHeader('Cache-Control', 's-maxage=600');
        return res.json(d2);
      }
      return res.status(r.status).json({ error: 'Moxfield ' + r.status });
    }
    var d = await r.json();
    res.setHeader('Cache-Control', 's-maxage=600');
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
