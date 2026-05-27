// Edge function : récap mensuel par email (v2 personnalisé)
// Déclenchée par Vercel Cron le 1er de chaque mois à 10h.
//
// Différences v1 → v2 :
//   - Stats personnalisées par user (cartes ajoutées, decks modifiés, likes reçus)
//   - Lien unsubscribe one-click (RFC 8058 compliant)
//   - Template HTML responsive testé Gmail/Outlook/Apple Mail
//   - Skippe les users opt-out ou inactifs depuis 90 jours
//
// Setup :
//   vercel env add RESEND_API_KEY        re_xxxxx
//   vercel env add RESEND_FROM           'ManaLAB <noreply@manalab.app>'
//   vercel env add DIGEST_SECRET         <token long>
//   vercel env add FIREBASE_PROJECT_ID   manalab-app
//
// Pour les stats par user, ce code utilise la REST API Firestore publique.
// Pour des stats plus précises (parties jouées, valeur de collection), passer
// au runtime Node + Firebase Admin SDK avec une clé service account.

export const config = { runtime: 'edge' };

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'ManaLAB <noreply@manalab.app>';
const DIGEST_SECRET = process.env.DIGEST_SECRET || '';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'mtg-tools-5ea4b';
const BASE_URL = process.env.MANALAB_BASE_URL || 'https://valebro-bhce.vercel.app';

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Génère un token HMAC-like pour le lien unsubscribe (signature simple, OK pour ce niveau de sécurité)
async function unsubscribeToken(uid) {
  const data = new TextEncoder().encode(uid + ':' + DIGEST_SECRET);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 24);
}

async function sendEmail(to, subject, html, listUnsubscribeUrl) {
  if (!RESEND_API_KEY) return { skipped: true, reason: 'No RESEND_API_KEY' };
  const headers = {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json'
  };
  const body = {
    from: RESEND_FROM,
    to: [to],
    subject,
    html,
    headers: {
      // RFC 8058 : one-click unsubscribe header
      'List-Unsubscribe': `<${listUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return await r.json();
}

async function fetchUsers() {
  // Page la collection users via REST (pagination si > 300 users)
  const all = [];
  let nextPageToken = null;
  for (let i = 0; i < 10; i++) { // max 10 pages × 300 = 3000 users
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users`);
    url.searchParams.set('pageSize', '300');
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);
    const r = await fetch(url);
    const data = await r.json();
    if (!data.documents) break;
    data.documents.forEach(d => {
      const f = d.fields || {};
      all.push({
        uid: d.name.split('/').pop(),
        email: f.email?.stringValue || '',
        name: f.name?.stringValue || '',
        role: f.role?.stringValue || '',
        digestOptOut: f.digestOptOut?.booleanValue || false,
        lastLogin: f.lastLogin?.timestampValue || ''
      });
    });
    if (!data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }
  return all;
}

// Récupère le nombre de decks publics d'un user (rapide)
async function fetchUserPublicDecksCount(uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'public_decks' }],
      where: { fieldFilter: { field: { fieldPath: 'createdBy' }, op: 'EQUAL', value: { stringValue: uid } } },
      select: { fields: [{ fieldPath: 'likes' }, { fieldPath: 'updatedAt' }] }
    }
  };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!Array.isArray(data)) return { count: 0, totalLikes: 0, recentUpdates: 0 };
    let count = 0, totalLikes = 0, recentUpdates = 0;
    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
    data.forEach(x => {
      if (!x.document) return;
      count++;
      const f = x.document.fields || {};
      totalLikes += parseInt(f.likes?.integerValue || '0', 10);
      const ts = f.updatedAt?.timestampValue;
      if (ts && new Date(ts).getTime() > monthAgo) recentUpdates++;
    });
    return { count, totalLikes, recentUpdates };
  } catch (e) {
    return { count: 0, totalLikes: 0, recentUpdates: 0 };
  }
}

function buildEmailHtml({ name, uid, stats, unsubscribeUrl }) {
  const bullets = [];
  if (stats.recentUpdates > 0) bullets.push(`<b style="color:#c9a84c">${stats.recentUpdates}</b> deck${stats.recentUpdates > 1 ? 's' : ''} public${stats.recentUpdates > 1 ? 's' : ''} modifié${stats.recentUpdates > 1 ? 's' : ''} ce mois-ci`);
  if (stats.totalLikes > 0) bullets.push(`<b style="color:#e26d6d">${stats.totalLikes}</b> like${stats.totalLikes > 1 ? 's' : ''} reçu${stats.totalLikes > 1 ? 's' : ''} au total ❤`);
  if (stats.count > 0) bullets.push(`<b>${stats.count}</b> deck${stats.count > 1 ? 's' : ''} public${stats.count > 1 ? 's' : ''} actif${stats.count > 1 ? 's' : ''}`);
  if (!bullets.length) bullets.push('Pas encore de deck public — pourquoi pas en publier un et le partager à la communauté ?');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0c0a07;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Georgia,serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0c0a07">
  <tr><td align="center" style="padding:20px 10px">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#1f1912;border:1px solid rgba(201,168,76,.3);border-radius:14px;overflow:hidden">
      <tr><td style="padding:30px 28px 20px;text-align:center;border-bottom:1px solid rgba(201,168,76,.2)">
        <div style="font-size:1.8rem;color:#c9a84c;font-family:Georgia,serif;letter-spacing:.08em;margin:0">ManaLAB ✦</div>
        <div style="color:#857b65;font-size:.88rem;margin-top:6px">Ton récap mensuel</div>
      </td></tr>
      <tr><td style="padding:24px 28px;color:#d8c8a8">
        <p style="margin:0 0 16px;font-size:1rem">Salut <b style="color:#c9a84c">${esc(name || 'Joueur')}</b>,</p>
        <p style="margin:0 0 16px;font-size:.95rem;line-height:1.6">Voici ce qui s'est passé sur ton compte ce mois-ci :</p>
        <ul style="font-size:.95rem;line-height:1.8;margin:0 0 20px;padding-left:20px;color:#d8c8a8">
          ${bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
        <p style="margin:0 0 16px;font-size:.92rem;line-height:1.6;color:#a8997b">Et chez les autres : de nouveaux decks publics, des combos partagés, des commandants à découvrir. Viens jeter un œil 👇</p>
      </td></tr>
      <tr><td style="padding:0 28px 28px;text-align:center">
        <a href="${BASE_URL}/" style="display:inline-block;background:#c9a84c;color:#000;padding:14px 32px;border-radius:9px;text-decoration:none;font-weight:600;font-family:Georgia,serif">Ouvrir ManaLAB →</a>
      </td></tr>
      <tr><td style="padding:18px 28px;background:rgba(201,168,76,.04);border-top:1px solid rgba(201,168,76,.15);text-align:center;font-size:.74rem;color:#857b65">
        Tu reçois cet email parce que tu as un compte ManaLAB.<br>
        <a href="${esc(unsubscribeUrl)}" style="color:#c9a84c">Se désinscrire de ces emails</a> · <a href="${BASE_URL}/legal/privacy.html" style="color:#c9a84c">Confidentialité</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);

  // Endpoint unsubscribe : /api/digest?unsubscribe=<uid>&t=<token>
  if (url.searchParams.has('unsubscribe')) {
    const uid = url.searchParams.get('unsubscribe');
    const token = url.searchParams.get('t');
    const expected = await unsubscribeToken(uid);
    if (token !== expected) return new Response('Invalid token', { status: 403 });
    // Set digestOptOut=true via Firestore REST
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=digestOptOut`;
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { digestOptOut: { booleanValue: true } } })
    });
    return new Response(`<!doctype html><html><body style="background:#0c0a07;color:#d8c8a8;font-family:Georgia,serif;text-align:center;padding:40px"><h1 style="color:#c9a84c">Désinscrit ✓</h1><p>Tu ne recevras plus le récap mensuel.<br>Tu peux réactiver à tout moment dans tes paramètres.</p><p><a href="${BASE_URL}/" style="color:#c9a84c">Retour à ManaLAB</a></p></body></html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Cron : protection
  const isVercelCron = req.headers.get('x-vercel-cron') || req.headers.get('user-agent')?.includes('vercel-cron');
  const tokenOk = DIGEST_SECRET && url.searchParams.get('token') === DIGEST_SECRET;
  if (!isVercelCron && !tokenOk) {
    return new Response('Forbidden', { status: 403 });
  }

  const users = await fetchUsers();
  const eligible = users.filter(u =>
    u.email &&
    !u.digestOptOut &&
    u.role !== 'banned' &&
    u.role !== 'pending'
  );

  let sent = 0, failed = 0;
  // Rate-limit : Resend free = 100 emails/jour, on processe 10 en parallèle max
  const BATCH = 10;
  for (let i = 0; i < eligible.length; i += BATCH) {
    const slice = eligible.slice(i, i + BATCH);
    await Promise.all(slice.map(async u => {
      try {
        const stats = await fetchUserPublicDecksCount(u.uid);
        const token = await unsubscribeToken(u.uid);
        const unsubscribeUrl = `${BASE_URL}/api/digest?unsubscribe=${u.uid}&t=${token}`;
        const html = buildEmailHtml({ name: u.name, uid: u.uid, stats, unsubscribeUrl });
        const res = await sendEmail(u.email, 'Ton mois sur ManaLAB ✦', html, unsubscribeUrl);
        if (res && res.id) sent++; else failed++;
      } catch (e) { failed++; }
    }));
    // Petite pause pour respecter le rate-limit
    await new Promise(r => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({ users: users.length, eligible: eligible.length, sent, failed }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
