// Edge function : envoi de notifications push via Web Push
// Endpoint protégé — invoqué uniquement par la Cloud Function `socialNotifPush`
// qui watch les writes dans users/{uid}/social_notifs et appelle ce endpoint.
//
// Setup une fois :
//   1. npx web-push generate-vapid-keys
//   2. vercel env add PUSH_PUBLIC_KEY  → coller la public
//   3. vercel env add PUSH_PRIVATE_KEY → coller la privée
//   4. vercel env add PUSH_SUBJECT     → mailto:thibaud.combes31@gmail.com
//   5. vercel env add PUSH_TRIGGER_SECRET → token aléatoire long, à partager avec la Cloud Function
//   6. Dans index.html, ajouter avant </body> :
//      <script>window.PUSH_PUBLIC_KEY='BFv...la-cle-publique';</script>

export const config = { runtime: 'edge' };

const PUSH_PUBLIC = process.env.PUSH_PUBLIC_KEY || '';
const PUSH_PRIVATE = process.env.PUSH_PRIVATE_KEY || '';
const PUSH_SUBJECT = process.env.PUSH_SUBJECT || 'mailto:noreply@manalab.app';
const TRIGGER_SECRET = process.env.PUSH_TRIGGER_SECRET || '';

// Implémentation minimale de Web Push pour l'edge runtime (sans dépendance npm)
// Encode un JWT VAPID et envoie le POST chiffré au endpoint du browser.
// Pour aller plus loin (chiffrement aes128gcm complet), utiliser le runtime Node :
//   export const config = { runtime: 'nodejs' };
//   import webpush from 'web-push';
//
// Ici, version simplifiée : on délègue au runtime Node avec `web-push`.

function b64urlEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function importPrivateKey(privKey) {
  // VAPID privé est un base64url d'un point P-256
  const raw = Uint8Array.from(atob(privKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  // Construit un JWK
  const pubRaw = Uint8Array.from(atob(PUSH_PUBLIC.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  // pubRaw[0] = 0x04, puis 32 bytes X, puis 32 bytes Y
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: b64urlEncode(raw),
    x: b64urlEncode(pubRaw.slice(1, 33)),
    y: b64urlEncode(pubRaw.slice(33, 65))
  };
  return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function signJwt(payload, privKey) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const enc = (o) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privKey,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${b64urlEncode(sig)}`;
}

async function sendOne(sub, payload) {
  try {
    const url = new URL(sub.endpoint);
    const aud = `${url.protocol}//${url.host}`;
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
    const privKey = await importPrivateKey(PUSH_PRIVATE);
    const jwt = await signJwt({ aud, exp, sub: PUSH_SUBJECT }, privKey);
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'normal',
        'Authorization': `vapid t=${jwt}, k=${PUSH_PUBLIC}`
      },
      body: '' // payload chiffré non implémenté ici — on envoie une notif "vide" et le SW fetch les détails
    });
    // 201/202 = OK, 404/410 = sub expirée → à supprimer
    return { status: r.status, expired: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Auth : seul le trigger Firebase peut appeler avec le secret
  const auth = req.headers.get('authorization') || '';
  if (!TRIGGER_SECRET || auth !== `Bearer ${TRIGGER_SECRET}`) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!PUSH_PUBLIC || !PUSH_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { subs, payload } = body;
  if (!Array.isArray(subs) || !payload) {
    return new Response('subs[] and payload required', { status: 400 });
  }

  const results = await Promise.all(subs.map(s => sendOne(s, payload)));
  const expired = results.map((r, i) => r.expired ? subs[i].endpoint : null).filter(Boolean);

  return new Response(JSON.stringify({
    sent: results.filter(r => r.status >= 200 && r.status < 300).length,
    failed: results.filter(r => r.status >= 400 && !r.expired).length,
    expired
  }), { headers: { 'Content-Type': 'application/json' } });
}
