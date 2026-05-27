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
// Retourne maintenant un objet { name, set, collector_number } parsé du JSON renvoyé
// par le LLM. Permet à scan-card.js de retrouver la VERSION exacte sur Scryfall.
async function identifyCard(base64Image, mime) {
  var prompt = 'You are a Magic: The Gathering card identification expert. Identify the card in this image. Return ONLY a JSON object with this exact format, no other text:\n\n{"name":"<exact English name>","set":"<3-letter set code or empty>","collector_number":"<number or empty>"}\n\nDetails:\n- name: EXACT English name as on Scryfall (no quotes inside, no extra info)\n- set: 3-letter set code visible bottom-left (e.g. "LCI", "LTR", "DMU", "MID"). Empty string "" if not legible.\n- collector_number: the number visible bottom-left (e.g. "234", "012", "0356"). Empty string "" if not legible.\n\nIf you cannot identify the card confidently, return {"name":"UNKNOWN","set":"","collector_number":""}.\n\nReturn JSON only, no markdown fences, no commentary.';
  var dataUrl = 'data:' + mime + ';base64,' + base64Image;

  var raw = '';
  if (process.env.GITHUB_TOKEN) {
    var messages = [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }];
    raw = await callGithubChat(messages, { model: GITHUB_MODEL_VISION, maxTokens: 120, temperature: 0.1 });
  } else if (process.env.GEMINI_API_KEY) {
    var contents = [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: base64Image } }
      ]
    }];
    raw = await callGeminiText(null, contents, { maxTokens: 120, temperature: 0.1 });
  } else {
    throw new Error('No LLM configured');
  }

  // Nettoyage : enlève d'éventuels code fences ```json … ```
  var clean = String(raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  // Tente JSON.parse, sinon retombe sur le texte brut comme name
  try {
    var obj = JSON.parse(clean);
    if (obj && typeof obj.name === 'string') {
      return {
        name: obj.name.trim(),
        set: (typeof obj.set === 'string' ? obj.set.trim().toLowerCase() : '').slice(0, 5),
        collector_number: (typeof obj.collector_number === 'string' ? obj.collector_number.trim() : '').slice(0, 12)
      };
    }
  } catch (e) { /* fallback ci-dessous */ }
  // Fallback : LLM a renvoyé juste un nom brut
  return { name: clean.replace(/^["'`]+|["'`]+$/g, ''), set: '', collector_number: '' };
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

// ════════════════════════════════════════════════════════════════════════
// CHAT COACH MTG — coaching de deck, suggestions, explications stratégiques
// Réutilise GitHub Models (gratuit) ou Gemini (fallback). Supporte BYOK
// Anthropic/Gemini via byok = { provider, key }.
// ════════════════════════════════════════════════════════════════════════
var SYSTEM_COACH = [
  'Tu es un coach Magic: The Gathering professionnel francophone, spécialisé en deck-building compétitif (Commander, Modern, Pioneer, Legacy).',
  'Tu réponds en FRANÇAIS, concis, structuré, avec des chiffres concrets quand pertinent.',
  'Style : direct, factuel, sans jargon excessif. Aucune flagornerie ("excellente question", etc.).',
  'Format de réponse : 100-180 mots maximum. Utilise du Markdown léger (**bold** pour les cartes/concepts clés, listes à puces si plusieurs points).',
  'Quand tu suggères des cartes : nomme exactement (anglais), explique pourquoi en 1 phrase, et chiffre l\'impact si possible.',
  'Tu fais référence à des stats : speed (turn-of-win), bracket Commander 1-5, mana curve, ratios (ramp/draw/removal), winrate.',
  'À la fin de chaque réponse, ajoute optionnellement 2-3 questions de suivi pertinentes sous la forme :\nFOLLOW_UPS:\n- question 1\n- question 2'
].join(' ');

// Appel Anthropic (BYOK)
async function callAnthropic(systemPrompt, userText, opts) {
  opts = opts || {};
  var key = opts.userKey;
  if (!key) throw new Error('Anthropic key missing');
  var model = opts.model || 'claude-haiku-4-5';
  var r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: opts.maxTokens || 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }]
    })
  });
  if (!r.ok) {
    var txt = await r.text();
    var err = new Error('Anthropic ' + r.status);
    err.detail = txt.slice(0, 400);
    err.status = r.status;
    throw err;
  }
  var data = await r.json();
  var content = '';
  try {
    if (Array.isArray(data.content)) content = data.content.map(function(p){return p.text||'';}).join('').trim();
  } catch (e) { /* ignore */ }
  return content;
}

// Appel Gemini avec clé custom (BYOK Gemini)
async function callGeminiCustom(systemPrompt, userText, userKey, opts) {
  opts = opts || {};
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + encodeURIComponent(userKey);
  var r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: opts.maxTokens || 700 }
    })
  });
  if (!r.ok) {
    var txt = await r.text();
    var err = new Error('Gemini BYOK ' + r.status);
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

async function chatCoach(opts) {
  opts = opts || {};
  var question = String(opts.question || '').slice(0, 1000);
  if (!question) throw new Error('question required');
  // Contexte deck (optionnel) : injecté dans le prompt user
  var contextBlocks = [];
  if (opts.deckCtx) {
    var dc = opts.deckCtx;
    var lines = [];
    if (dc.name) lines.push('Deck : ' + dc.name);
    if (dc.format) lines.push('Format : ' + dc.format);
    if (dc.commander) lines.push('Commandant : ' + dc.commander);
    if (dc.bracket) lines.push('Bracket : ' + dc.bracket);
    if (dc.plan) lines.push('Plan A détecté : ' + dc.plan + ' (' + (dc.coherence || 0) + '% cohérent)');
    if (dc.speedTurn) lines.push('Vitesse estimée : T' + dc.speedTurn);
    if (dc.counts) lines.push('Counts : ramp=' + (dc.counts.ramp || 0) + ', draw=' + (dc.counts.draw || 0) + ', removal=' + (dc.counts.removal || 0) + ', interaction=' + (dc.counts.interaction || 0));
    if (dc.cards && Array.isArray(dc.cards) && dc.cards.length) {
      lines.push('Cartes principales (top 30) : ' + dc.cards.slice(0, 30).join(', '));
    }
    if (lines.length) contextBlocks.push('[CONTEXTE DECK]\n' + lines.join('\n'));
  }
  if (opts.cardCtx) {
    var cc = opts.cardCtx;
    var cLines = [];
    if (cc.name) cLines.push('Carte : ' + cc.name);
    if (cc.typeLine) cLines.push('Type : ' + cc.typeLine);
    if (cc.cmc != null) cLines.push('CMC : ' + cc.cmc);
    if (cc.oracleText) cLines.push('Oracle : ' + String(cc.oracleText).slice(0, 600));
    if (cLines.length) contextBlocks.push('[CONTEXTE CARTE]\n' + cLines.join('\n'));
  }
  var userText = (contextBlocks.length ? contextBlocks.join('\n\n') + '\n\n' : '') + 'Question : ' + question;

  // Priorité BYOK si user a fourni une clé
  if (opts.byok && opts.byok.key && opts.byok.provider) {
    var prov = String(opts.byok.provider).toLowerCase();
    if (prov === 'anthropic') {
      return callAnthropic(SYSTEM_COACH, userText, { userKey: opts.byok.key, model: opts.byok.model || 'claude-haiku-4-5', maxTokens: 700 });
    }
    if (prov === 'gemini') {
      return callGeminiCustom(SYSTEM_COACH, userText, opts.byok.key, { maxTokens: 700 });
    }
    // Provider inconnu : on retombe sur le défaut
  }
  // Défaut : GitHub Models > Gemini (clé serveur)
  if (process.env.GITHUB_TOKEN) {
    var msgs = [
      { role: 'system', content: SYSTEM_COACH },
      { role: 'user', content: userText }
    ];
    return callGithubChat(msgs, { model: GITHUB_MODEL_TEXT, maxTokens: 700, temperature: 0.4 });
  }
  if (process.env.GEMINI_API_KEY) {
    var contents = [{ role: 'user', parts: [{ text: userText }] }];
    return callGeminiText(SYSTEM_COACH, contents, { maxTokens: 700, temperature: 0.4 });
  }
  throw new Error('No LLM configured');
}

// ════════════════════════════════════════════════════════════════════════
// PARSE CARD EFFECT — convertit l'oracle d'une carte en JSON d'actions
// pour le rules engine d'Arena Pro. Sortie déterministe, cacheable.
// ════════════════════════════════════════════════════════════════════════
var SYSTEM_PARSE_CARD = [
  'You are an MTG rules engine parser. Given a card name and its oracle text, output ONLY a JSON array describing the actions that resolve when the card is cast.',
  'No prose, no explanation, no markdown code fences. JUST the JSON array.',
  '',
  'Available action types (use these exact strings):',
  '- {"type":"search_land","filter":"basic|any|plains|island|swamp|mountain|forest","n":1,"dest":"battlefield_tapped|battlefield|hand","shuffle":true}',
  '- {"type":"draw","n":3}',
  '- {"type":"scry","n":2}',
  '- {"type":"surveil","n":2}',
  '- {"type":"mill","n":5,"who":"self|opp|each"}',
  '- {"type":"create_token","n":1,"power":2,"toughness":2,"name":"Saproling","subtype":"creature"} // subtype: creature|artifact|treasure|food|clue',
  '- {"type":"reanimate","filter":"creature|any","dest":"battlefield|hand"}',
  '- {"type":"return_to_hand_from_gy","filter":"any|creature|instant|sorcery"}',
  '- {"type":"destroy_all","filter":"creatures|artifacts|nonlands"}',
  '- {"type":"exile_all","filter":"creatures|graveyards"}',
  '- {"type":"damage_each_creature","amount":3}',
  '- {"type":"damage_target","amount":3,"target":"any|creature|player"}',
  '- {"type":"discard","n":2,"who":"you|opp|each"}',
  '- {"type":"choose","mode":"one|two|three|up_to_one|up_to_two","modes":[<arrays of actions>]}',
  '- {"type":"life","n":-3,"who":"you|opp"} // negative = lose, positive = gain',
  '- {"type":"counter_target","filter":"spell|creature_spell|noncreature_spell"}',
  '- {"type":"destroy_target","filter":"creature|artifact|enchantment|nonland|planeswalker"}',
  '- {"type":"exile_target","filter":"creature|nonland|permanent"}',
  '- {"type":"buff_target","power":3,"toughness":3,"keywords":["flying","trample"],"duration":"EOT"} // EOT=end of turn',
  '- {"type":"add_mana","colors":["U","R"],"n":1}',
  '- {"type":"copy_spell","target":"instant|sorcery|spell"}',
  '- {"type":"register_trigger","when":"upkeep|main1|main2|end_step|draw|cast_instant|cast_sorcery|cast_creature","action":[<actions>],"may":true}',
  '- {"type":"static","effect":"extra_lands|no_max_hand|cant_lose|cant_be_countered","n":1}',
  '- {"type":"unknown","description":"texte court de ce que la carte fait"}',
  '',
  'Rules :',
  '- If "Choose one —" with • bullets, wrap modes in a "choose" action.',
  '- For permanents (creature/artifact/enchantment/planeswalker), separate ETB ("When this enters") from upkeep/draw/cast triggers (use "register_trigger").',
  '- Static abilities (passive, no trigger) use "static" action type.',
  '- For costs like "you may pay 3 life", wrap the action in a trigger with "may":true and include a life:-3 step.',
  '- If you cannot parse confidently, return [{"type":"unknown","description":"..."}].',
  '- Output JSON ONLY, no other text.'
].join('\n');

async function parseCardEffect(cardName, oracleText) {
  if (!cardName || !oracleText) return [];
  var userPrompt = 'Card: ' + cardName + '\nOracle: ' + String(oracleText).slice(0, 2000);
  var raw = '';
  try {
    if (process.env.GITHUB_TOKEN) {
      raw = await callGithubChat([
        { role: 'system', content: SYSTEM_PARSE_CARD },
        { role: 'user', content: userPrompt }
      ], { maxTokens: 800, temperature: 0.05 });
    } else if (process.env.GEMINI_API_KEY) {
      raw = await callGeminiText(SYSTEM_PARSE_CARD, [{ role: 'user', parts: [{ text: userPrompt }] }], { maxTokens: 800, temperature: 0.05 });
    } else {
      throw new Error('No LLM configured');
    }
  } catch (e) {
    return [{ type: 'unknown', description: 'LLM error: ' + e.message }];
  }
  // Nettoie : retire les code fences éventuels
  var clean = String(raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  // Tente le parse
  try {
    var arr = JSON.parse(clean);
    if (Array.isArray(arr)) return arr;
    if (arr && typeof arr === 'object') return [arr];
  } catch (e) {
    // Try to extract first JSON array
    var match = clean.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) {}
    }
  }
  return [{ type: 'unknown', description: clean.slice(0, 200) }];
}

module.exports = {
  llmAvailable: llmAvailable,
  llmSetupHint: llmSetupHint,
  identifyCard: identifyCard,
  chatRules: chatRules,
  chatCoach: chatCoach,
  parseCardEffect: parseCardEffect
};
