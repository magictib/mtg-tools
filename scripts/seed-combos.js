// Seed la collection Firestore `combos/` depuis le catalogue interne _ANA_COMBOS
// (défini dans index.html — il faudrait l'extraire en JSON pour ce script).
//
// Pour la V1 : on définit ici un sous-ensemble de combos iconiques.
// À enrichir au fil de l'eau, ou idéalement importer Commander Spellbook
// (https://commanderspellbook.com — API publique).
//
// Usage :
//   node scripts/seed-combos.js

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  try {
    const sa = require(path.resolve(__dirname, '../firebase-service-account.json'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } catch (e) {
    admin.initializeApp();
  }
}
const db = admin.firestore();

function slugify(names) {
  return names.map(n => String(n).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''`’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  ).join('-and-');
}

// 30 combos iconiques (Commander + cEDH + Legacy/Modern).
// Pour aller plus loin : importer Commander Spellbook (~5000 combos).
const COMBOS = [
  // === Win conditions ===
  { names: ['Thassa\'s Oracle', 'Demonic Consultation'], type: 'Win', desc: 'Vide ta bibliothèque avec Demonic Consultation puis active Thassa\'s Oracle pour gagner immédiatement.' },
  { names: ['Thassa\'s Oracle', 'Tainted Pact'], type: 'Win', desc: 'Active Tainted Pact pour vider ta bibliothèque (deck singleton), puis Thassa\'s Oracle gagne.' },
  { names: ['Laboratory Maniac', 'Demonic Consultation'], type: 'Win', desc: 'Variante classique de Thoracle avec Laboratory Maniac : pioche avec bibliothèque vide = victoire.' },
  { names: ['Jace, Wielder of Mysteries', 'Demonic Consultation'], type: 'Win', desc: 'Idem avec Jace en planeswalker au lieu d\'une créature.' },
  { names: ['Aetherflux Reservoir', 'Bolas\'s Citadel', 'Sensei\'s Divining Top'], type: 'Win', desc: 'Boucle infinie de Top + Citadel, chaque sort joué via Citadel paie 0 PV et ajoute un compteur sur Aetherflux. Dégâts létaux.' },

  // === Mana infini ===
  { names: ['Dramatic Reversal', 'Isochron Scepter'], type: 'Mana infini', desc: 'Avec des artefacts générant ≥3 manas, Isochron Scepter + Dramatic Reversal crée une boucle de mana infinie.' },
  { names: ['Dockside Extortionist', 'Temur Sabertooth'], type: 'Mana infini', desc: 'Avec ≥4 artefacts/enchantements adverses, Dockside + Sabertooth (blink) génère du mana infini.' },
  { names: ['Devoted Druid', 'Vizier of Remedies'], type: 'Mana vert infini', desc: 'Devoted Druid s\'untap en mettant un -1/-1 que Vizier annule. Mana vert infini.' },
  { names: ['Birthing Pod', 'Devoted Druid'], type: 'Mana vert infini', desc: 'Combo facilité par les tuteurs verts.' },
  { names: ['Pestermite', 'Splinter Twin'], type: 'Mana infini', desc: 'Twin sur Pestermite : copies hâte qui se untap. Si attaché à un creature mana-tap, mana infini.' },

  // === Dégâts infinis ===
  { names: ['Mikaeus, the Unhallowed', 'Triskelion'], type: 'Dégâts infinis', desc: 'Triskelion se sacrifie via ses propres jetons, revient grâce à Mikaeus, et fait des dégâts en boucle.' },
  { names: ['Heliod, Sun-Crowned', 'Walking Ballista'], type: 'Dégâts infinis', desc: 'Walking Ballista avec Heliod : se met un compteur lifelink, se sacrifie pour des dégâts, revient — dégâts infinis.' },
  { names: ['Niv-Mizzet, Parun', 'Curiosity'], type: 'Dégâts infinis', desc: 'Niv-Mizzet pioche → 1 dégât → pioche... infiniment avec Curiosity attaché.' },
  { names: ['Niv-Mizzet, the Firemind', 'Curiosity'], type: 'Dégâts infinis', desc: 'Même combo avec la version originelle de Niv-Mizzet.' },
  { names: ['Saheeli Rai', 'Felidar Guardian'], type: 'Tour infini', desc: 'Saheeli copie Felidar qui blink Saheeli — boucle de copies hâte qui attaquent au tour suivant.' },

  // === Créatures / jetons infinis ===
  { names: ['Kiki-Jiki, Mirror Breaker', 'Felidar Guardian'], type: 'Créatures infinies', desc: 'Kiki copie Felidar Guardian qui blink Kiki — production infinie de jetons hâte.' },
  { names: ['Kiki-Jiki, Mirror Breaker', 'Zealous Conscripts'], type: 'Créatures infinies', desc: 'Kiki copie Conscripts qui untap Kiki. Variante classique Modern/Legacy.' },
  { names: ['Splinter Twin', 'Deceiver Exarch'], type: 'Créatures infinies', desc: 'Combo iconique du Modern d\'antan : Exarch blink ou untap Twin.' },
  { names: ['Ashnod\'s Altar', 'Reassembling Skeleton'], type: 'Mana noir/jetons infinis', desc: 'Avec un sac-outlet (Blood Artist…), boucle de sacrifice infini.' },

  // === Mill / discard ===
  { names: ['Underworld Breach', 'Lion\'s Eye Diamond', 'Brain Freeze'], type: 'Win (mill)', desc: 'Breach + LED + Brain Freeze = mill infini pour faire perdre les adversaires.' },
  { names: ['Painter\'s Servant', 'Grindstone'], type: 'Mill', desc: 'Painter rend toutes les cartes d\'une couleur. Grindstone mill jusqu\'à fin de la bibliothèque adverse.' },
  { names: ['Mindcrank', 'Bloodchief Ascension'], type: 'Mill', desc: 'Tout point de vie perdu mill 2 et inflige 2 dégâts via Ascension activée. Boucle mortelle.' },

  // === Tours / actions infinies ===
  { names: ['Time Sieve', 'Thopter Assembly'], type: 'Tours infinis', desc: 'Sacrifie 5 artefacts (les Thopters) → tour supplémentaire → recast Assembly. Boucle.' },
  { names: ['Sword of the Paruns', 'Argothian Elder'], type: 'Mana infini', desc: 'Sword untap Elder qui untap 2 terrains. Mana infini.' },

  // === Storm / spells ===
  { names: ['Storm', 'Tendrils of Agony'], type: 'Storm', desc: 'Combo de Legacy : chain de cantrips + rituals, Tendrils achève.' },
  { names: ['Bolas\'s Citadel', 'Sensei\'s Divining Top'], type: 'Engine', desc: 'Top sur le dessus + Citadel : casts gratuits depuis le dessus de la bibliothèque.' },

  // === EDH iconique ===
  { names: ['Sanguine Bond', 'Exquisite Blood'], type: 'Win (gain de vie)', desc: 'Boucle de gain de vie / perte de vie. Combo de victoire classique BG/BW.' },
  { names: ['Vizier of Remedies', 'Murderous Redcap'], type: 'Dégâts infinis', desc: 'Persist + Vizier qui annule le -1/-1 : sacrifice infini avec un outlet.' },
  { names: ['Pili-Pala', 'Grand Architect'], type: 'Mana infini', desc: 'Architect rend Pili-Pala bleu, donne +1/+1 et abilities tap-for-mana. Pili-Pala untap pour 1U générant 2.' },
  { names: ['Worldgorger Dragon', 'Animate Dead'], type: 'Mana infini / tout', desc: 'Dragon revient → exile permanents → meurt → permanents reviennent. Boucle infinie.' },
  { names: ['Razaketh, the Foulblooded', 'Worldgorger Dragon', 'Animate Dead'], type: 'Win', desc: 'Combo Razaketh : mana infini avec Worldgorger, sacrifie des Razakets via lui-même pour tuter ce que tu veux.' }
];

async function main() {
  console.log('→ Seed combos...');
  for (const c of COMBOS) {
    const slug = slugify(c.names);
    const doc = {
      slug,
      names: c.names,
      type: c.type,
      desc: c.desc,
      colors: [], // à enrichir si besoin
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('combos').doc(slug).set(doc, { merge: true });
    console.log('  ✓', slug);
  }
  console.log('✓ ' + COMBOS.length + ' combos seedés');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
