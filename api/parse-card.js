// Parse MTG card oracle text → JSON actions pour le rules engine d'Arena Pro.
// POST { name, oracle } → 200 { actions:[...] }
//
// Utilise GITHUB_TOKEN (GitHub Models) ou GEMINI_API_KEY (Gemini Flash) — free tiers.
// Rate-limit faible (60/h/IP) car les calls sont mises en cache côté client.

var llm = require('./_llm.js');

var _rateLimit = {};
function rateLimitOk(ip) {
  if (!ip) return true;
  var now = Date.now();
  var hour = Math.floor(now / 3600000);
  var key = ip + ':' + hour;
  if (Math.random() < 0.05) {
    Object.keys(_rateLimit).forEach(function(k){
      var h = parseInt(k.split(':')[1], 10);
      if (h < hour - 1) delete _rateLimit[k];
    });
  }
  _rateLimit[key] = (_rateLimit[key] || 0) + 1;
  return _rateLimit[key] <= 60;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!llm.llmAvailable()) {
    res.status(503).json({ error: 'No LLM configured (GITHUB_TOKEN or GEMINI_API_KEY required)' });
    return;
  }

  var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket && req.socket.remoteAddress || '';
  if (!rateLimitOk(ip)) {
    res.status(429).json({ error: 'Rate limit (60/h/IP)' });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    var name = (body && body.name) || '';
    var oracle = (body && body.oracle) || '';
    if (!name || !oracle) {
      res.status(400).json({ error: 'name and oracle required' });
      return;
    }
    var actions = await llm.parseCardEffect(name, oracle);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h côté serveur edge
    res.status(200).json({ actions: actions, name: name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
