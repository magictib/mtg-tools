// Helpers LLM partagés entre scan-card.js et rules.js.
// Provider primaire : GitHub Models (gratuit, OpenAI-compatible).
// Fallback : Gemini 1.5 Flash si GITHUB_TOKEN absent mais GEMINI_API_KEY présente.
//
// Setup GitHub Models :
//   1. Va sur https://github.com/settings/tokens
//   2. « Generate new token » (fine-grained recommandé)
//      • Permissions : Models → Read-only
//      • Repository access : Public Repositories (Read-only) suffit
//   3. Copie le token → Vercel > Settings > Environment Variables
//      Name  : GITHUB_TOKEN
//      Value : <ton token>
//      Scopes: Production, Preview, Development
//   4. Redéploie

var GITHUB_BASE = 'https://models.inference.ai.azure.com';
var GITHUB_MODEL_VISION = 'gpt-4o-mini';   // vision + 150 req/jour gratuit
var GITHUB_MODEL_TEXT   = 'gpt-4o-mini';   // même modèle pour le chat règles

function llmAvailable() {
  return !!(process.env.GITHUB_TOKEN || process.env.GEMINI_API_KEY);
}

function llmSetupHint() {
  return {
    error: 'Aucun provider LLM configuré sur Vercel.',
    hint: 'Crée un GitHub PAT avec la permission « Models: Read-only » sur https://github.com/settings/tokens puis ajoute GITHUB_TOKEN dans les Environment Variables Vercel. Alternative : GEMINI_API_KEY (clé sur https://aistudio.google.com/apikey, attention au tier).'
  };
}

// Appelle GitHub Models en mode OpenAI Chat Completions.
// messages = [{ role:'system'|'user'|'assistant', content: string | [parts…] }]
async function callGithubChat(messages, opts) {
  opts = opts || {};
  var model = opts.model || GITHUB_MODEL_TEXT;
  var r = await fetch(GITHUB_BASE + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: opts.maxTokens || 600,
      temperature: opts.temperature != null ? opts.temperature : 0.3
    })
  });
  if (!r.ok) {
    var txt = await r.text();
    var err = new Error('GitHub Models ' + r.status);
    err.detail = txt.slice(0, 400);
    err.status = r.status;
    throw err;
  }
  var data = await r.json();
  var content = '';
  try {
    content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
  } catch (e) { /* ignore */ }
  return String(content || '').trim();
}

// Fallback Gemini (texte + vision selon le contenu).
async function callGeminiText(systemPrompt, contents, opts) {
  opts = opts || {};
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY);
  var r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: contents,
      generationConfig: { temperature: opts.temperature != null ? opts.temperature : 0.3, maxOutputTokens: opts.maxTokens || 600 }
    })
  });
  if (!r.ok) {
    var txt = await r.text();
    var err = new Error('Gemini ' + r.status);
    err.detail = txt.slice(0, 400);
    err.status = r.status;
    throw err;
  }
  var data = await r.json();
  var answer = '';
  try {
    var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if (parts) answer = parts.map(function (p) { return p.text || ''; }).join('').trim();
  } catch (e) { /* ignore */ }
  return answer;
}

// Identification de carte. base64Image = data sans prefix data:..., mime = "image/jpeg"
async function identifyCard(base64Image, mime) {
  var prompt = 'You are a Magic: The Gathering card identification expert. Identify the card in this image. Respond with ONLY the EXACT ENGLISH NAME of the card as it appears on Scryfall, nothing else — no quotes, no explanation, no commentary. If you cannot identify it confidently, respond with "UNKNOWN".';
  var dataUrl = 'data:' + mime + ';base64,' + base64Image;

  if (process.env.GITHUB_TOKEN) {
    var messages = [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }];
    return callGithubChat(messages, { model: GITHUB_MODEL_VISION, maxTokens: 60, temperature: 0.1 });
  }
  if (process.env.GEMINI_API_KEY) {
    var contents = [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: base64Image } }
      ]
    }];
    return callGeminiText(null, contents, { maxTokens: 60, temperature: 0.1 });
  }
  throw new Error('No LLM configured');
}

// Chat règles. history = [{role:'user'|'model', text}], card = {name, oracle_text, type_line}|null
var SYSTEM_RULES = [
  'Tu es un expert des règles de Magic: The Gathering. Tu réponds en FRANÇAIS, de manière claire, concise et structurée.',
  'Tu cites les règles officielles quand c\'est utile (numéro de règle entre parenthèses, ex : « voir 702.21 »).',
  'Si la question concerne une carte spécifique, base ta réponse sur son texte oracle exact, fourni par l\'utilisateur.',
  'Si la question est ambiguë, demande une précision avant de répondre.',
  'Tu ne réponds QUE aux questions liées à Magic: The Gathering (règles, interactions, deck-building, formats, lore). Si la question est hors-sujet, indique poliment que tu ne couvres que MTG.',
  'Format de réponse : maximum 200 mots, ton pédagogique, exemples concrets quand pertinents.'
].join(' ');

async function chatRules(question, history, card) {
  // Limite l'historique à 8 derniers tours
  history = Array.isArray(history) ? history.slice(-8) : [];
  var userText = question;
  if (card && card.name) {
    var ctx = '[Contexte carte : ' + card.name;
    if (card.type_line) ctx += ' — ' + card.type_line;
    ctx += ']';
    if (card.oracle_text) ctx += '\nTexte oracle : ' + String(card.oracle_text).slice(0, 800);
    userText = ctx + '\n\nQuestion : ' + question;
  }

  if (process.env.GITHUB_TOKEN) {
    var msgs = [{ role: 'system', content: SYSTEM_RULES }];
    history.forEach(function (h) {
      if (!h || !h.role || !h.text) return;
      msgs.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: String(h.text).slice(0, 1200)
      });
    });
    msgs.push({ role: 'user', content: userText });
    return callGithubChat(msgs, { model: GITHUB_MODEL_TEXT, maxTokens: 600, temperature: 0.3 });
  }
  if (process.env.GEMINI_API_KEY) {
    var contents = [];
    history.forEach(function (h) {
      if (!h || !h.role || !h.text) return;
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.text).slice(0, 1200) }]
      });
    });
    contents.push({ role: 'user', parts: [{ text: userText }] });
    return callGeminiText(SYSTEM_RULES, contents, { maxTokens: 600, temperature: 0.3 });
  }
  throw new Error('No LLM configured');
}

module.exports = {
  llmAvailable: llmAvailable,
  llmSetupHint: llmSetupHint,
  identifyCard: identifyCard,
  chatRules: chatRules
};
