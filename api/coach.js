// AI Coach MTG : coaching de deck, suggestions, explications.
// Reçoit { question, deckCtx?, cardCtx? } et un header optionnel
// X-User-Provider + X-User-Key pour BYOK (Bring Your Own Key).
//
// Free tier : utilise GITHUB_TOKEN (GitHub Models, gratuit) ou GEMINI_API_KEY (Gemini Flash, 1500 req/jour gratuites).
// BYOK : l'utilisateur peut envoyer sa propre clé Anthropic ou Gemini pour qualité supérieure / illimité.
//
// Rate limit serveur : 20 requêtes / IP / heure (in-memory, weak protection mais évite l'abus basique).

var llm = require('./_llm.js');

// In-memory rate limit (reset au cold start, c'est OK pour MVP)
var _rateLimit = {};
function rateLimitOk(ip) {
  if (!ip) return true;
  var now = Date.now();
  var hour = Math.floor(now / 3600000);
  var key = ip + ':' + hour;
  // Purge old keys
  if (Math.random() < 0.05) {
    Object.keys(_rateLimit).forEach(function(k){
      var h = parseInt(k.split(':')[1], 10);
      if (h < hour - 1) delete _rateLimit[k];
    });
  }
  _rateLimit[key] = (_rateLimit[key] || 0) + 1;
  return _rateLimit[key] <= 20;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Provider, X-User-Key, X-User-Model');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // BYOK : si user a fourni une clé, on bypass le rate limit
  var byokProvider = (req.headers['x-user-provider'] || '').toString().toLowerCase();
  var byokKey = (req.headers['x-user-key'] || '').toString();
  var byokModel = (req.headers['x-user-model'] || '').toString();
  var hasByok = !!(byokProvider && byokKey);

  if (!hasByok && !llm.llmAvailable()) {
    res.status(503).json(llm.llmSetupHint());
    return;
  }

  // Rate limit uniquement sur le free tier (la clé serveur)
  if (!hasByok) {
    var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket && req.socket.remoteAddress || '';
    if (!rateLimitOk(ip)) {
      res.status(429).json({ error: 'Rate limit atteint : 20 requêtes / heure. Reessaie dans une heure ou configure ta propre clé API dans les paramètres.' });
      return;
    }
  }

  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    var question = (body && body.question) || '';
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'question (string) required' });
      return;
    }
    if (question.length > 1000) question = question.slice(0, 1000);

    var deckCtx = (body && body.deckCtx) || null;
    var cardCtx = (body && body.cardCtx) || null;

    var opts = {
      question: question,
      deckCtx: deckCtx,
      cardCtx: cardCtx
    };
    if (hasByok) opts.byok = { provider: byokProvider, key: byokKey, model: byokModel || undefined };

    var answer = '';
    try {
      answer = await llm.chatCoach(opts);
    } catch (e) {
      console.warn('[coach]', e.message, e.detail || '');
      res.status(502).json({ error: e.message, detail: e.detail || '' });
      return;
    }
    if (!answer) answer = 'Pas de réponse — réessaie en reformulant la question.';

    // Parse follow-ups si présents
    var followUps = [];
    var mainAnswer = answer;
    var fuMatch = answer.match(/FOLLOW_UPS:\s*([\s\S]+)$/i);
    if (fuMatch) {
      mainAnswer = answer.slice(0, fuMatch.index).trim();
      followUps = fuMatch[1].split('\n')
        .map(function(s){ return s.replace(/^[\s\-*•]+/, '').trim(); })
        .filter(function(s){ return s.length > 5 && s.length < 200; })
        .slice(0, 3);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      answer: mainAnswer,
      followUps: followUps,
      provider: hasByok ? byokProvider : (process.env.GITHUB_TOKEN ? 'github' : 'gemini'),
      byok: hasByok
    });
  } catch (e) {
    console.error('[coach]', e);
    res.status(500).json({ error: e.message });
  }
};
