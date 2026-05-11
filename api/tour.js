'use strict';
const https = require('https');

const ALLOWED_HOSTS = ['topdeck.gg', 'api.moxfield.com', 'www.mtgtop8.com'];

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, port: 443, path, method: 'GET', headers: headers || {} }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(raw), raw }); }
        catch(e) { resolve({ status: res.statusCode, data: null, raw }); }
      });
    });
    req.on('error', e => reject(e));
    req.end();
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, port: 443, path, method: 'POST', headers: headers || {} };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(raw), raw }); }
        catch(e) { resolve({ status: res.statusCode, data: null, raw }); }
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

  // ── HTML proxy (MTGTop8) ──────────────────────────────────────────────────
  if (payload.htmlUrl) {
    let u;
    try { u = new URL(payload.htmlUrl); } catch(e) { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!ALLOWED_HOSTS.includes(u.hostname)) return res.status(403).json({ error: 'Host not allowed' });
    const r = await httpsGet(u.hostname, u.pathname + u.search, {
      'User-Agent': 'Mozilla/5.0 (compatible; ManaLAB/1.0)',
      'Accept': 'text/html,*/*',
    }).catch(e => ({ status: 502, raw: '' }));
    res.status(r.status);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(r.raw);
  }

  // ── Moxfield batch deck names ─────────────────────────────────────────────
  if (payload.mxIds) {
    const ids = Array.isArray(payload.mxIds) ? payload.mxIds.slice(0, 60) : [];
    const results = await Promise.all(ids.map(async id => {
      try {
        const r = await httpsGet('api.moxfield.com', `/v2/decks/all/${id}`, {
          'User-Agent': 'Mozilla/5.0 (compatible; ManaLAB/1.0)',
          'Accept': 'application/json',
        });
        return { id, name: (r.data && r.data.name) || null };
      } catch(e) { return { id, name: null }; }
    }));
    return res.json(results);
  }

  // ── TopDeck.gg proxy ──────────────────────────────────────────────────────
  const { tourPath, method, authKey, body } = payload;
  if (!tourPath || !/^\/v2\//.test(tourPath)) return res.status(400).json({ error: 'Invalid path' });
  const r = await httpsPost('topdeck.gg', '/api' + tourPath, {
    'Authorization': authKey || '',
    'Content-Type': 'application/json',
  }, body ? JSON.stringify(body) : undefined).catch(e => ({ status: 502, raw: JSON.stringify({ error: e.message }) }));
  res.status(r.status);
  return r.data ? res.json(r.data) : res.send(r.raw);
};
