// Endpoint client : retourne la liste des diffs disponibles depuis ?since=<updated_at>
// Le client itère ensuite sur chaque URL de diff pour appliquer.
//
// Réponse :
//   { current: { type, updated_at, synced_at }, diffs: [{ updated_at, url, counts }] }

const { list } = require('@vercel/blob');

const SNAPSHOT_KEY = 'scryfall/snapshot.json';
const META_KEY = 'scryfall/meta.json';
const DIFF_PREFIX = 'scryfall/diff_';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: 'diff proxy not configured (no BLOB token)' });
    }
    const since = (req.query && req.query.since) || '';

    // Lit le meta
    const metaList = await list({ prefix: META_KEY });
    const metaFile = (metaList.blobs || []).find(b => b.pathname === META_KEY);
    if (!metaFile) {
      return res.status(404).json({ error: 'no snapshot yet — wait for cron run' });
    }
    const metaR = await fetch(metaFile.url);
    const meta = await metaR.json();

    // Lit la liste des diffs
    const lst = await list({ prefix: DIFF_PREFIX });
    const blobs = (lst.blobs || []).sort((a, b) => a.pathname.localeCompare(b.pathname));

    const diffs = [];
    for (const b of blobs) {
      // Le nom encode l'updated_at de destination : on extrait via le fichier (request HEAD pas dispo).
      // On va lire les counts depuis le pathname si possible, sinon depuis le contenu (peu lourd : on lit que les premières lignes).
      const m = b.pathname.match(/diff_([\dT\-h]+)\.json$/);
      const ts = m ? m[1].replace(/-/g, ':').replace(/^(\d+:\d+:\d+T\d+):(\d+):(\d+)Z/, '$1T$2:$3Z') : null;
      diffs.push({ updated_at: ts, url: b.url, size: b.size || null, pathname: b.pathname });
    }

    // Filtre : ne renvoie que les diffs après "since"
    const filtered = since ? diffs.filter(d => d.updated_at && d.updated_at > since) : diffs;

    return res.json({
      current: { type: meta.type, updated_at: meta.updated_at, synced_at: meta.synced_at },
      diffs: filtered,
      total_diffs: diffs.length
    });
  } catch (e) {
    console.error('scryfall-diff', e);
    return res.status(500).json({ error: e.message });
  }
};
