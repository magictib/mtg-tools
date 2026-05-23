// Chatbot règles MTG en français via Google Gemini 1.5 Flash.
// Reçoit { question, history?, card? } et retourne { answer }.
//
// Variables d'environnement Vercel requises :
//   GEMINI_API_KEY  = clé https://aistudio.google.com/apikey
//
// `card` (optionnel) = { name, oracle_text, type_line } — quand l'utilisateur
// pose une question sur une carte précise. Le prompt système est verrouillé
// pour rester sur les règles MTG en français.

var SYSTEM_PROMPT = [
  'Tu es un expert des règles de Magic: The Gathering. Tu réponds en FRANÇAIS, de manière claire, concise et structurée.',
  'Tu cites les règles officielles quand c\'est utile (numéro de règle entre parenthèses, ex : « voir 702.21 »).',
  'Si la question concerne une carte spécifique, base ta réponse sur son texte oracle exact, fourni par l\'utilisateur.',
  'Si la question est ambiguë, demande une précision avant de répondre.',
  'Tu ne réponds QUE aux questions liées à Magic: The Gathering (règles, interactions, deck-building, formats, lore). Si la question est hors-sujet, indique poliment que tu ne couvres que MTG.',
  'Format de réponse : maximum 200 mots, ton pédagogique, exemples concrets quand pertinents.'
].join(' ');

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
    var question = (body && body.question) || '';
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'question (string) required' });
      return;
    }
    if (question.length > 800) question = question.slice(0, 800);
    var card = body && body.card;
    var history = (body && Array.isArray(body.history)) ? body.history.slice(-8) : [];

    // Construit le contenu Gemini
    var contents = [];
    // Tour 1 : on injecte le system prompt sous forme de user/model car Gemini
    // n'a pas de rôle "system" stable hors v1.5+ — on utilise systemInstruction.
    history.forEach(function (h) {
      if (!h || !h.role || !h.text) return;
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.text).slice(0, 1200) }]
      });
    });

    var userText = question;
    if (card && card.name) {
      var ctx = '[Contexte carte : ' + card.name;
      if (card.type_line) ctx += ' — ' + card.type_line;
      ctx += ']';
      if (card.oracle_text) ctx += '\nTexte oracle : ' + String(card.oracle_text).slice(0, 800);
      userText = ctx + '\n\nQuestion : ' + question;
    }
    contents.push({ role: 'user', parts: [{ text: userText }] });

    var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(key);
    var r = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      })
    });
    if (!r.ok) {
      var txt = await r.text();
      res.status(502).json({ error: 'Gemini ' + r.status, detail: txt.slice(0, 400) });
      return;
    }
    var data = await r.json();
    var answer = '';
    try {
      var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      if (parts) answer = parts.map(function (p) { return p.text || ''; }).join('').trim();
    } catch (e) { /* ignore */ }
    if (!answer) answer = '⚠ Pas de réponse — réessaie en reformulant la question.';
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ answer: answer });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
