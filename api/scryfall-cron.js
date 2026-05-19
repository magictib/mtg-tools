// Vercel Cron : tous les jours, télécharge le bulk Scryfall (oracle_cards),
// compare avec le snapshot précédent stocké en Vercel Blob, génère un diff JSON
// et stocke : (a) le nouveau snapshot.json, (b) un fichier diff_{ts}.json.
//
// Auth : Vercel injecte automatiquement Authorization: Bearer ${CRON_SECRET}
// La variable BLOB_READ_WRITE_TOKEN doit être configurée dans Vercel.
//
// Endpoint manuel : GET /api/scryfall-cron?force=1&secret=<CRON_SECRET>

const { put, list, del } = require('@vercel/blob');

const BULK_TYPE = process.env.SCRY_BULK_TYPE || 'oracle_cards';
const SNAPSHOT_KEY = 'scryfall/snapshot.json';
const META_KEY = 'scryfall/meta.json';
const DIFF_PREFIX = 'scryfall/diff_';
const MAX_DIFFS = 30; // garde 30 jours de diffs

function _hashCard(c) {
  const p = c.prices || {};
  const img = (c.image_uris && (c.image_uris.normal || c.image_uris.large)) || '';
  return `${c.oracle_id || ''}|${img.length}|${p.usd || ''}|${p.eur || ''}|${(c.oracle_text || '').length}|${c.cmc || 0}`;
}

function _trimCard(c) {
  // Garde seulement les champs utiles à l'app pour réduire la taille
  const img = (c.image_uris && (c.image_uris.normal || c.image_uris.large)) || '';
  let faces = null;
  if (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris) {
    faces = c.card_faces.map(f => ({ name: f.name || '', oracle_text: f.oracle_text || '' }));
  }
  return {
    name: c.name,
    oracle_id: c.oracle_id || '',
    colors: c.colors || [],
    color_identity: c.color_identity || [],
    mana_cost: c.mana_cost || '',
    cmc: c.cmc || 0,
    type_line: c.type_line || '',
    rarity: c.rarity || '',
    oracle_text: c.oracle_text || '',
    power: c.power || null,
    toughness: c.toughness || null,
    loyalty: c.loyalty || null,
    image_uri: img,
    faces,
    prices: {
      usd: (c.prices && c.prices.usd) || null,
      eur: (c.prices && c.prices.eur) || null,
      usd_foil: (c.prices && c.prices.usd_foil) || null,
      eur_foil: (c.prices && c.prices.eur_foil) || null
    },
    scryfall_uri: c.scryfall_uri || ''
  };
}

async function _fetchBulkMeta() {
  const r = await fetch('https://api.scryfall.com/bulk-data');
  const data = await r.json();
  const bulk = (data.data || []).find(d => d.type === BULK_TYPE);
  if (!bulk) throw new Error(BULK_TYPE + ' not found in Scryfall response');
  return bulk;
}

async function _fetchBulkJson(uri) {
  const r = await fetch(uri);
  if (!r.ok) throw new Error('Bulk download failed: ' + r.status);
  return r.json();
}

async function _loadPrevSnapshot() {
  try {
    const lst = await list({ prefix: SNAPSHOT_KEY });
    const f = (lst.blobs || []).find(b => b.pathname === SNAPSHOT_KEY);
    if (!f) return null;
    const r = await fetch(f.url);
    if (!r.ok) return null;
    return await r.json(); // { updated_at, cards: [{name, _h}] }
  } catch (e) {
    console.warn('loadPrev', e);
    return null;
  }
}

async function _cleanupOldDiffs() {
  try {
    const lst = await list({ prefix: DIFF_PREFIX });
    const blobs = (lst.blobs || []).sort((a, b) => b.pathname.localeCompare(a.pathname));
    if (blobs.length > MAX_DIFFS) {
      const toDel = blobs.slice(MAX_DIFFS).map(b => b.url);
      await Promise.all(toDel.map(u => del(u).catch(() => {})));
    }
  } catch (e) { console.warn('cleanup', e); }
}

module.exports = async function handler(req, res) {
  // Auth : soit Vercel cron (Authorization: Bearer CRON_SECRET), soit ?secret=
  const auth = req.headers.authorization || '';
  const expected = 'Bearer ' + (process.env.CRON_SECRET || '');
  const qSecret = (req.query && req.query.secret) || '';
  const isAuthorized = (process.env.CRON_SECRET && (auth === expected || qSecret === process.env.CRON_SECRET));
  if (!isAuthorized) return res.status(401).json({ error: 'unauthorized' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN missing' });
  }

  try {
    const meta = await _fetchBulkMeta();
    // Charge le précédent snapshot pour détecter si quelque chose a changé
    const prev = await _loadPrevSnapshot();
    if (prev && prev.updated_at === meta.updated_at && !(req.query && req.query.force)) {
      return res.json({ ok: true, skipped: 'same_updated_at', updated_at: meta.updated_at });
    }

    // Télécharge le bulk complet
    const bulkArr = await _fetchBulkJson(meta.download_uri);
    if (!Array.isArray(bulkArr)) throw new Error('Bulk is not an array');

    // Index par nom (lowercase) avec hash
    const newIdx = {};
    const newSnap = { updated_at: meta.updated_at, type: BULK_TYPE, cards: [] };
    for (const c of bulkArr) {
      if (!c.name) continue;
      const trimmed = _trimCard(c);
      const h = _hashCard(c);
      const nameLow = c.name.toLowerCase();
      newIdx[nameLow] = { card: trimmed, h };
      newSnap.cards.push({ name: nameLow, h });
    }

    // Calcule le diff vs prev
    const adds = [], updates = [], deletes = [];
    if (prev && prev.cards) {
      const prevIdx = {};
      for (const x of prev.cards) prevIdx[x.name] = x.h;
      for (const nameLow in newIdx) {
        if (!(nameLow in prevIdx)) adds.push(newIdx[nameLow].card);
        else if (prevIdx[nameLow] !== newIdx[nameLow].h) updates.push(newIdx[nameLow].card);
      }
      for (const nameLow in prevIdx) {
        if (!(nameLow in newIdx)) deletes.push(nameLow);
      }
    } else {
      // Première fois : tout est add
      for (const nameLow in newIdx) adds.push(newIdx[nameLow].card);
    }

    const diff = {
      from_updated_at: prev ? prev.updated_at : null,
      to_updated_at: meta.updated_at,
      generated_at: new Date().toISOString(),
      type: BULK_TYPE,
      adds,
      updates,
      deletes,
      counts: { adds: adds.length, updates: updates.length, deletes: deletes.length }
    };

    // Sauvegarde diff (sauf si vide après le premier snapshot)
    if (prev && (adds.length + updates.length + deletes.length === 0)) {
      // Pas de changement : on remet juste à jour le meta
    } else {
      const diffKey = `${DIFF_PREFIX}${meta.updated_at.replace(/[:.]/g, '-')}.json`;
      await put(diffKey, JSON.stringify(diff), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true
      });
    }

    // Sauvegarde le nouveau snapshot (light : juste les hashes)
    await put(SNAPSHOT_KEY, JSON.stringify(newSnap), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true
    });

    // Sauvegarde le meta global (utilisé par le client pour découvrir les diffs)
    await put(META_KEY, JSON.stringify({
      type: BULK_TYPE,
      updated_at: meta.updated_at,
      size_bytes: meta.size || 0,
      synced_at: new Date().toISOString()
    }), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });

    await _cleanupOldDiffs();

    return res.json({
      ok: true,
      updated_at: meta.updated_at,
      counts: diff.counts,
      bulk_type: BULK_TYPE
    });
  } catch (e) {
    console.error('scryfall-cron', e);
    return res.status(500).json({ error: e.message });
  }
};
