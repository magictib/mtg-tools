// Parse MTG card oracle text → JSON actions pour le rules engine d'Arena Pro.
// POST { name, oracle } → 200 { actions:[...], cached: true/false }
//
// Architecture cache à 3 niveaux :
// 1. Client localStorage (instant, par-user)
// 2. Firestore card_effects/{slug} (partagé entre TOUS les users, durable)
// 3. LLM (GitHub Models / Gemini) en dernier recours, puis stocké en Firestore
//
// → 1 carte parsée 1 seule fois GLOBALEMENT (pas par-user) = coût API minime

var llm = require('./_llm.js');

var PROJECT_ID = 'mtg-tools-5ea4b';
var FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

// Slug d'une carte : lowercase, hyphens, ASCII
function cardSlug(name) {
  return String(name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // décompose les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

// Firestore : lecture du cache
async function firestoreGetActions(slug) {
  try {
    var r = await fetch(FIRESTORE_BASE + '/card_effects/' + encodeURIComponent(slug));
    if (!r.ok) return null;
    var data = await r.json();
    if (data && data.fields && data.fields.actions && data.fields.actions.stringValue) {
      try { return JSON.parse(data.fields.actions.stringValue); } catch (e) { return null; }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Firestore : écriture du cache (création si nouveau, update si existant)
async function firestoreSetActions(slug, actions) {
  try {
    var url = FIRESTORE_BASE + '/card_effects/' + encodeURIComponent(slug)
      + '?updateMask.fieldPaths=actions&updateMask.fieldPaths=ts';
    var body = {
      fields: {
        actions: { stringValue: JSON.stringify(actions).slice(0, 9500) },
        ts: { integerValue: String(Date.now()) }
      }
    };
    var r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      console.warn('[parse-card] Firestore write failed', r.status, await r.text().catch(function(){return '';}));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[parse-card] Firestore write error', e.message);
    return false;
  }
}

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

  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    var name = (body && body.name) || '';
    var oracle = (body && body.oracle) || '';
    if (!name || !oracle) {
      res.status(400).json({ error: 'name and oracle required' });
      return;
    }

    var slug = cardSlug(name);

    // ─── 1. Cache Firestore : free read (lectures gratuites jusqu'à 50K/jour) ───
    var cached = await firestoreGetActions(slug);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).json({ actions: cached, name: name, cached: true, source: 'firestore' });
      return;
    }

    // ─── 2. Rate limit (uniquement pour les appels qui vont parser via LLM) ───
    var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
    if (!rateLimitOk(ip)) {
      res.status(429).json({ error: 'Rate limit (60 nouveaux parsings / heure / IP). Réessaie plus tard ou utilise des cartes déjà cachées.' });
      return;
    }

    // ─── 3. LLM (GitHub Models / Gemini) ───
    if (!llm.llmAvailable()) {
      res.status(503).json({ error: 'No LLM configured (GITHUB_TOKEN or GEMINI_API_KEY required)' });
      return;
    }

    var actions = await llm.parseCardEffect(name, oracle);

    // ─── 4. Stocke dans Firestore pour le prochain user (fire-and-forget) ───
    if (actions && Array.isArray(actions) && actions.length && actions[0].type !== 'unknown') {
      firestoreSetActions(slug, actions).catch(function(e){ console.warn('FS write', e); });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).json({ actions: actions, name: name, cached: false, source: 'llm' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
