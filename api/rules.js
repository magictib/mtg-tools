// Chatbot règles MTG en français via GitHub Models ou Gemini en fallback.
// Reçoit { question, history?, card? } et retourne { answer }.
// Voir api/_llm.js pour la config des providers.

var llm = require('./_llm.js');

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
    var question = (body && body.question) || '';
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'question (string) required' });
      return;
    }
    if (question.length > 800) question = question.slice(0, 800);

    var card = body && body.card;
    var history = (body && Array.isArray(body.history)) ? body.history : [];

    var answer = '';
    try {
      answer = await llm.chatRules(question, history, card);
    } catch (e) {
      res.status(502).json({ error: e.message, detail: e.detail || '' });
      return;
    }
    if (!answer) answer = '⚠ Pas de réponse — réessaie en reformulant la question.';
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ answer: answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
