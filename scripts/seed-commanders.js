// Script à lancer manuellement (Node) ou via Vercel function de seed.
// Récupère TOUS les commandants légaux de Scryfall et les écrit dans Firestore
// dans la collection `commanders/{slug}` avec leur nom canonique.
//
// Usage local :
//   node scripts/seed-commanders.js
//
// Pré-requis :
//   - Firebase service account JSON dans ./firebase-service-account.json
//     OU variable env GOOGLE_APPLICATION_CREDENTIALS pointant vers
//
// La fonction sera utilisée par api/c.js pour mapper proprement slug↔nom officiel,
// et par sitemap.js pour inclure tous les commandants même sans deck public.

const admin = require('firebase-admin');
const path = require('path');

const projectId = process.env.FIREBASE_PROJECT_ID || 'manalab-app';

if (!admin.apps.length) {
  try {
    const sa = require(path.resolve(__dirname, '../firebase-service-account.json'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } catch (e) {
    admin.initializeApp(); // GOOGLE_APPLICATION_CREDENTIALS env var
  }
}
const db = admin.firestore();

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // décomposition Unicode + suppression diacritiques
    .replace(/[''`’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchAllCommanders() {
  // Scryfall search : commandants légaux en Commander/EDH
  // type:legendary creature OR oracle:"can be your commander"
  const all = [];
  let url = 'https://api.scryfall.com/cards/search?q=is%3Acommander&unique=cards&order=edhrec';
  while (url) {
    const r = await fetch(url);
    const data = await r.json();
    if (!data.data) break;
    data.data.forEach(c => {
      if (!c.name) return;
      all.push({
        name: c.name,
        slug: slugify(c.name),
        oracle_id: c.oracle_id,
        colors: c.color_identity || [],
        cmc: c.cmc || 0,
        scryfall_uri: c.scryfall_uri || '',
        image_art: c.image_uris?.art_crop || (c.card_faces?.[0]?.image_uris?.art_crop) || '',
        type_line: c.type_line || ''
      });
    });
    url = data.has_more ? data.next_page : null;
    // Respect rate-limit Scryfall (max 10 req/s)
    await new Promise(r => setTimeout(r, 100));
  }
  return all;
}

async function main() {
  console.log('→ Fetch commanders depuis Scryfall...');
  const cmds = await fetchAllCommanders();
  console.log(`✓ ${cmds.length} commandants trouvés`);

  console.log('→ Écriture dans Firestore (collection: commanders)...');
  let written = 0;
  const BATCH_SIZE = 500;
  for (let i = 0; i < cmds.length; i += BATCH_SIZE) {
    const batch = db.batch();
    cmds.slice(i, i + BATCH_SIZE).forEach(c => {
      if (!c.slug) return;
      batch.set(db.collection('commanders').doc(c.slug), c, { merge: true });
    });
    await batch.commit();
    written += Math.min(BATCH_SIZE, cmds.length - i);
    console.log(`  ${written}/${cmds.length}`);
  }
  console.log('✓ Seed terminé');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
