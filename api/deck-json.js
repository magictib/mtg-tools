// P2 #16 — API JSON publique pour les decks partagés.
// URL : /api/deck-json?id=PUB_ID  OU  /deck.json/:id (via rewrite Vercel)
//
// Permet aux intégrations tierces (bot Discord, widget Twitch, page externe,
// automation Zapier/n8n) de récupérer un deck en JSON propre sans parser le
// HTML de og-deck.js.
//
// Pas d'auth : seuls les decks publiquement partagés (collection Firestore
// public_decks/{id}) sont accessibles. Pour publier un deck depuis ManaLAB,
// l'utilisateur doit cliquer « 🔗 Partager publiquement » dans l'éditeur.
//
// CORS ouvert pour faciliter les usages embed.

var PROJECT_ID = 'mtg-tools-5ea4b';

function firestoreValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(firestoreValue);
  if ('mapValue' in v) {
    var out = {};
    var f = (v.mapValue.fields) || {};
    Object.keys(f).forEach(function (k) { out[k] = firestoreValue(f[k]); });
    return out;
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  var id = (req.query && req.query.id) || '';
  if (!/^[A-Za-z0-9_\-]{4,128}$/.test(id)) {
    res.status(400).json({ error: 'Invalid id', detail: 'Expected pattern [A-Za-z0-9_-]{4,128}' });
    return;
  }

  var origin = 'https://' + (req.headers.host || 'valebro-bhce.vercel.app');

  try {
    var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/public_decks/' + encodeURIComponent(id);
    var r = await fetch(url);
    if (!r.ok) {
      res.status(404).json({ error: 'Deck not found', id: id });
      return;
    }
    var doc = await r.json();
    var fields = (doc && doc.fields) || {};

    var name = firestoreValue(fields.name) || 'Deck';
    var ownerName = firestoreValue(fields.ownerName) || null;
    var format = firestoreValue(fields.format) || null;
    var commander = firestoreValue(fields.commander) || null;
    var cards = firestoreValue(fields.cards) || [];
    var notes = firestoreValue(fields.notes) || null;
    var pw = firestoreValue(fields.pw) || null;
    var sharedAt = firestoreValue(fields.sharedAt) || null;
    var likes = firestoreValue(fields.likes) || [];
    var comments = firestoreValue(fields.comments) || [];

    var total = 0;
    if (Array.isArray(cards)) cards.forEach(function (c) { total += (c && c.qty) || 1; });

    // Normalisation des commentaires (anonymise uid)
    var publicComments = Array.isArray(comments) ? comments.map(function (c) {
      return {
        author: c.name || 'Anonyme',
        text: (c.text || '').slice(0, 1000),
        createdAt: c.ts ? new Date(c.ts).toISOString() : null
      };
    }) : [];

    var payload = {
      id: id,
      name: name,
      ownerName: ownerName,
      format: format,
      totalCards: total,
      commander: commander && commander.name ? { name: commander.name, colors: commander.colors || [] } : null,
      cards: Array.isArray(cards) ? cards.map(function (c) {
        return {
          name: c.name || '',
          qty: c.qty || 1,
          section: c.sec || 'Deck',
          set: c.set || null,
          collectorNumber: c.num || null
        };
      }) : [],
      notes: notes,
      stats: {
        likes: Array.isArray(likes) ? likes.length : 0,
        comments: Array.isArray(comments) ? comments.length : 0,
        score: pw && pw.score != null ? pw.score : null,
        bracket: pw && pw.bracket != null ? pw.bracket : null
      },
      sharedAt: sharedAt ? new Date(sharedAt).toISOString() : null,
      comments: publicComments,
      links: {
        web: origin + '/deck/' + id,
        ogImage: origin + '/icon.svg'
      },
      api: {
        version: '1.0',
        documentation: origin + '/api/deck-json'
      }
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).json(payload);
  } catch (e) {
    res.status(500).json({ error: 'Internal error', detail: (e && e.message) || '' });
  }
};
