'use strict';
const https = require('https');

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, port: 443, path, method: 'GET', headers }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, port: 443, path, method: 'POST', headers };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', e => reject(e));
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let raw = '';
  await new Promise(resolve => { req.on('data', c => raw += c); req.on('end', resolve); });

  let payload;
  try { payload = JSON.parse(raw); } catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }

  // ── Moxfield batch deck name fetch ────────────────────────────────────────
  if (payload.mxIds) {
    const ids = Array.isArray(payload.mxIds) ? payload.mxIds.slice(0, 60) : [];
    const results = await Promise.all(ids.map(async id => {
      try {
        const r = await httpsGet('api.moxfield.com', `/v2/decks/all/${id}`, {
          'User-Agent': 'Mozilla/5.0 (compatible; ManaLAB/1.0)',
          'Accept': 'application/json',
        });
        return { id, name: (r.data && r.data.name) || null };
      } catch(e) {
        return { id, name: null };
      }
    }));
    return res.json(results);
  }

  // ── TopDeck.gg proxy ───────────────────────────────────────────────────────
  const { tourPath, method, authKey, body } = payload;
  if (!tourPath || !/^\/v2\//.test(tourPath)) return res.status(400).json({ error: 'Invalid path' });

  const r = await httpsPost('topdeck.gg', '/api' + tourPath, {
    'Authorization': authKey || '',
    'Content-Type': 'application/json',
  }, body ? JSON.stringify(body) : undefined).catch(e => ({ status: 502, data: { error: e.message } }));

  res.status(r.status);
  return typeof r.data === 'string' ? res.send(r.data) : res.json(r.data);
};
