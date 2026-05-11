'use strict';
const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let raw = '';
  await new Promise(resolve => { req.on('data', c => raw += c); req.on('end', resolve); });

  let payload;
  try { payload = JSON.parse(raw); } catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { tourPath, method, authKey, body } = payload;
  if (!tourPath || !/^\/v2\//.test(tourPath)) return res.status(400).json({ error: 'Invalid path' });

  const opts = {
    hostname: 'topdeck.gg',
    port: 443,
    path: '/api' + tourPath,
    method: method || 'GET',
    headers: {
      'Authorization': authKey || '',
      'Content-Type': 'application/json',
    },
  };

  return new Promise(resolve => {
    const r = https.request(opts, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        res.status(resp.statusCode);
        try { res.json(JSON.parse(data)); }
        catch(e) { res.send(data); }
        resolve();
      });
    });
    r.on('error', e => { res.status(502).json({ error: e.message }); resolve(); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
};
