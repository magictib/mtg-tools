// Cloud Function Firebase — déclenchée sur write dans users/{uid}/social_notifs
// Récupère les push_subs du destinataire et appelle /api/push-send pour pousser la notif hors-app.
//
// Setup :
//   cd functions
//   npm init -y
//   npm install firebase-admin firebase-functions
//   firebase deploy --only functions
//
// Variables d'environnement requises (firebase functions:config:set) :
//   push.endpoint  = https://manalab.app/api/push-send
//   push.secret    = <même valeur que PUSH_TRIGGER_SECRET côté Vercel>

const admin = require('firebase-admin');
const functions = require('firebase-functions');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PUSH_ENDPOINT = functions.config().push?.endpoint || 'https://manalab.app/api/push-send';
const PUSH_SECRET = functions.config().push?.secret || '';

exports.onSocialNotif = functions
  .region('europe-west1')
  .firestore.document('users/{uid}/social_notifs/{notifId}')
  .onCreate(async (snap, ctx) => {
    if (!PUSH_SECRET) {
      console.warn('[push] PUSH_TRIGGER_SECRET not set, skipping');
      return null;
    }
    const uid = ctx.params.uid;
    const notif = snap.data() || {};

    // Récupère les subscriptions push du destinataire
    const subsSnap = await db.collection('users').doc(uid).collection('push_subs').get();
    if (subsSnap.empty) return null;

    const subs = [];
    subsSnap.forEach(d => {
      const data = d.data();
      if (data.endpoint && data.keys) subs.push({ endpoint: data.endpoint, keys: data.keys });
    });
    if (!subs.length) return null;

    // Construit le payload selon le kind
    const titles = {
      like: '❤ Nouveau like',
      comment: '💬 Nouveau commentaire',
      follow: '👤 Nouveau follower',
      new_deck: '♠ Nouveau deck publié'
    };
    const bodies = {
      like: `${notif.fromName || 'Quelqu\'un'} a aimé ${notif.deckName || 'ton deck'}`,
      comment: `${notif.fromName || 'Quelqu\'un'} : ${(notif.text || '').slice(0, 80)}`,
      follow: `${notif.fromName || 'Quelqu\'un'} te suit maintenant`,
      new_deck: `${notif.fromName || 'Un ami'} a publié ${notif.deckName || 'un nouveau deck'}`
    };
    const payload = {
      title: titles[notif.kind] || 'ManaLAB',
      body: bodies[notif.kind] || '',
      url: notif.deckId ? `/?deck=${notif.deckId}` : '/',
      tag: `manalab-${notif.kind}-${notif.deckId || ''}`
    };

    try {
      const resp = await fetch(PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PUSH_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subs, payload })
      });
      const out = await resp.json();
      console.log('[push]', { uid, kind: notif.kind, ...out });
      // Nettoyer les subs expirées
      if (Array.isArray(out.expired)) {
        const batch = db.batch();
        subsSnap.forEach(d => {
          if (out.expired.includes(d.data().endpoint)) batch.delete(d.ref);
        });
        await batch.commit().catch(() => {});
      }
      return out;
    } catch (e) {
      console.error('[push] send failed', e);
      return null;
    }
  });
