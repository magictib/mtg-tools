/* ═══════════════════════════════════════════════════════════════════════════
   MLANAPRO — moteur d'analyse de référence pour les decks Magic.
   Le but : sortir un diagnostic complet et auto-suffisant que l'utilisateur
   peut suivre les yeux fermés. Chaque axe a une intention claire :
   - Composition  : la cohérence interne du deck (curve, types, rôles)
   - Manabase     : sources WUBRG vs pips requis, bilands, fixers
   - WinCons      : détection explicite des plans de victoire
   - Combos       : combos infinis connus + pertinence pour le deck
   - Bracket EDH  : niveau 1-5 selon les signaux compétitifs
   - Anti-synergie: incohérences commandant ↔ payoffs
   - Mots-clés    : alignement keywords vs but du deck
   Toutes les détections sont DETERMINISTES (heuristiques + dictionnaires).
   ═══════════════════════════════════════════════════════════════════════════ */
window.mlAnaPro = (function(){
  'use strict';

  // Build 102 : versioning du méta — incrémenter à chaque mise à jour majeure
  // des dictionnaires (cartes top, MUST_ANSWER, GAME_CHANGERS, etc.).
  // Sources : EDHRECast, cEDH Decklist Database, posts WotC bracket announcements.
  // Format trimestriel : YYYY-Qn. Affiché dans l'UI pour transparence.
  var META_VERSION = '2026-Q2';
  var META_UPDATED = '2026-06-11';

  // ─── DICTIONNAIRES ──────────────────────────────────────────────────────
  // Combos infinis classiques (paires/trios). Format minimal pour matcher
  // rapidement via l'oracleText OU le nom de cartes (case-insensitive).
  // Source : EDHrec combos populaires, Commander Spellbook.
  var COMBOS = [
    {n:'Heliod + Walking Ballista',cards:['heliod, sun-crowned','walking ballista'],
      result:'dmg infini',mana:5,turn:5,types:['drain','combat']},
    {n:'Thassa\'s Oracle + Demonic Consultation',cards:['thassa\'s oracle','demonic consultation'],
      result:'win condition',mana:4,turn:4,types:['alt-win']},
    {n:'Thassa\'s Oracle + Tainted Pact',cards:['thassa\'s oracle','tainted pact'],
      result:'win condition',mana:4,turn:4,types:['alt-win']},
    {n:'Dramatic Reversal + Isochron Scepter',cards:['dramatic reversal','isochron scepter'],
      result:'mana infini',mana:4,turn:4,types:['mana']},
    {n:'Kiki-Jiki + Felidar Guardian',cards:['kiki-jiki, mirror breaker','felidar guardian'],
      result:'tokens infinis',mana:7,turn:6,types:['combat']},
    {n:'Kiki-Jiki + Zealous Conscripts',cards:['kiki-jiki, mirror breaker','zealous conscripts'],
      result:'tokens infinis',mana:11,turn:7,types:['combat']},
    {n:'Splinter Twin + Deceiver Exarch',cards:['splinter twin','deceiver exarch'],
      result:'tokens infinis',mana:7,turn:6,types:['combat']},
    {n:'Mikaeus + Triskelion',cards:['mikaeus, the unhallowed','triskelion'],
      result:'dmg infini',mana:12,turn:7,types:['combat']},
    {n:'Persist + sacrifice + Counter-removal',cards:['mikaeus, the unhallowed','murderous redcap'],
      result:'dmg infini',mana:11,turn:7,types:['combat','drain']},
    {n:'Worldgorger Dragon + Animate Dead',cards:['worldgorger dragon','animate dead'],
      result:'mana infini',mana:8,turn:6,types:['mana']},
    {n:'Devoted Druid + Vizier of Remedies',cards:['devoted druid','vizier of remedies'],
      result:'mana vert infini',mana:4,turn:3,types:['mana']},
    {n:'Bloodletter of Aclazotz + sac outlet',cards:['bloodletter of aclazotz','blood artist'],
      result:'drain',mana:6,turn:5,types:['drain']},
    {n:'Exquisite Blood + Sanguine Bond',cards:['exquisite blood','sanguine bond'],
      result:'drain infini',mana:11,turn:6,types:['drain']},
    {n:'Exquisite Blood + Vito',cards:['exquisite blood','vito, thorn of the dusk rose'],
      result:'drain infini',mana:8,turn:6,types:['drain']},
    {n:'Niv-Mizzet + Curiosity',cards:['niv-mizzet, the firemind','curiosity'],
      result:'dmg infini',mana:9,turn:6,types:['drain','combat']},
    {n:'Niv-Mizzet + Ophidian Eye',cards:['niv-mizzet, the firemind','ophidian eye'],
      result:'dmg infini',mana:9,turn:6,types:['drain','combat']},
    {n:'Niv-Mizzet + Mind Over Matter',cards:['niv-mizzet, the firemind','mind over matter'],
      result:'dmg infini',mana:12,turn:7,types:['drain','combat']},
    {n:'Aetherflux + Bolas\'s Citadel',cards:['aetherflux reservoir','bolas\'s citadel'],
      result:'50 dégâts',mana:8,turn:6,types:['drain']},
    {n:'Underworld Breach + Brain Freeze',cards:['underworld breach','brain freeze'],
      result:'storm mill win',mana:5,turn:5,types:['mill','storm']},
    {n:'Karmic Guide + Reveillark',cards:['karmic guide','reveillark'],
      result:'recursion infinie',mana:11,turn:7,types:['combat']},
    {n:'Krark-Clan Ironworks + Scrap Trawler',cards:['krark-clan ironworks','scrap trawler'],
      result:'mana infini',mana:6,turn:5,types:['mana']},
    {n:'Witch\'s Oven + Cauldron Familiar',cards:['witch\'s oven','cauldron familiar'],
      result:'drain lent',mana:3,turn:3,types:['drain']},
    {n:'Food Chain + créature exile-return',cards:['food chain','squee, the immortal'],
      result:'mana incolore infini',mana:5,turn:4,types:['mana']},
    {n:'Approach of the Second Sun (x2 casts)',cards:['approach of the second sun'],
      result:'alt-win',mana:14,turn:8,types:['alt-win']},
    {n:'Laboratory Maniac + draw deck',cards:['laboratory maniac'],
      result:'alt-win',mana:2,turn:3,types:['alt-win']},
    {n:'Jace, Wielder of Mysteries + draw deck',cards:['jace, wielder of mysteries'],
      result:'alt-win',mana:4,turn:4,types:['alt-win']},
    {n:'Maze\'s End (10 Gates)',cards:['maze\'s end'],result:'alt-win',mana:0,turn:10,types:['alt-win']},
    {n:'Mortal Combat (20 creatures GY)',cards:['mortal combat'],result:'alt-win',mana:5,turn:7,types:['alt-win']},
    {n:'Triskaidekaphobia (13 PV)',cards:['triskaidekaphobia'],result:'alt-win',mana:3,turn:5,types:['alt-win']},
    {n:'Coalition Victory',cards:['coalition victory'],result:'alt-win 5-couleurs',mana:8,turn:7,types:['alt-win']},
    {n:'Felidar Sovereign',cards:['felidar sovereign'],result:'alt-win (40+ PV)',mana:6,turn:5,types:['alt-win']},
    {n:'Test of Endurance',cards:['test of endurance'],result:'alt-win (50+ PV)',mana:4,turn:5,types:['alt-win']},
    // ─── Build 89 : extension à 100+ combos (Commander Spellbook + cEDH staples) ───
    {n:'Basalt Monolith + Rings of Brighthearth',cards:['basalt monolith','rings of brighthearth'],
      result:'mana infini',mana:8,turn:6,types:['mana']},
    {n:'Grand Architect + Pili-Pala',cards:['grand architect','pili-pala'],
      result:'mana bleu infini',mana:6,turn:5,types:['mana']},
    {n:'Phyrexian Devourer + Triskelion',cards:['phyrexian devourer','triskelion'],
      result:'dmg infini',mana:10,turn:6,types:['combat']},
    {n:'Marwyn + Staff of Domination',cards:['marwyn, the nurturer','staff of domination'],
      result:'mana vert infini + pioche',mana:8,turn:6,types:['mana','combat']},
    {n:'Eldrazi Displacer + Drowner of Hope',cards:['eldrazi displacer','drowner of hope'],
      result:'mana incolore infini',mana:8,turn:6,types:['mana']},
    {n:'Animar + Ancestral Statue',cards:['animar, soul of elements','ancestral statue'],
      result:'tour infinie',mana:7,turn:5,types:['combat']},
    {n:'Karn + Mycosynth Lattice',cards:['karn, the great creator','mycosynth lattice'],
      result:'soft-lock terrains',mana:10,turn:7,types:['lock']},
    {n:'Felidar Sovereign + life gain engine',cards:['felidar sovereign','aetherflux reservoir'],
      result:'alt-win (40+ PV)',mana:10,turn:6,types:['alt-win']},
    {n:'Polymorph + créature unique',cards:['polymorph','blightsteel colossus'],
      result:'cheat creature in',mana:4,turn:4,types:['combat']},
    {n:'Sneak Attack + Emrakul',cards:['sneak attack','emrakul, the aeons torn'],
      result:'one-shot',mana:5,turn:5,types:['combat']},
    {n:'Show and Tell + Omniscience',cards:['show and tell','omniscience'],
      result:'cheat + free casts',mana:6,turn:6,types:['combo']},
    {n:'Doomsday pile (Thoracle)',cards:['doomsday','thassa\'s oracle'],
      result:'win T4 garanti',mana:7,turn:4,types:['alt-win']},
    {n:'Birgi + Glorious End',cards:['birgi, god of storytelling','grapeshot'],
      result:'storm win',mana:5,turn:5,types:['storm']},
    {n:'Aluren + Cavern Harpy',cards:['aluren','cavern harpy'],
      result:'loop drain',mana:6,turn:5,types:['drain']},
    {n:'Aluren + Parasitic Strix',cards:['aluren','parasitic strix'],
      result:'drain infini',mana:6,turn:5,types:['drain']},
    {n:'Painter\'s Servant + Grindstone',cards:['painter\'s servant','grindstone'],
      result:'mill instantané',mana:5,turn:5,types:['mill','alt-win']},
    {n:'Hermit Druid (mono color)',cards:['hermit druid'],
      result:'mill self → win',mana:2,turn:3,types:['mill','alt-win']},
    {n:'Earthcraft + Squirrel Nest',cards:['earthcraft','squirrel nest'],
      result:'tokens infinis',mana:6,turn:5,types:['tokens']},
    {n:'Pestilence + Vampiric Link',cards:['pestilence','vampiric link'],
      result:'drain control',mana:5,turn:5,types:['drain']},
    {n:'Necropotence + Yawgmoth\'s Bargain',cards:['necropotence'],
      result:'card advantage massive',mana:3,turn:4,types:['draw']},
    {n:'Sanctum Weaver + infinite untaps',cards:['sanctum weaver','staff of domination'],
      result:'mana vert infini',mana:9,turn:6,types:['mana']},
    {n:'Codie + Krark-Clan Ironworks',cards:['codie, vociferous codex','krark-clan ironworks'],
      result:'storm chain',mana:6,turn:6,types:['storm']},
    {n:'Mishra\'s Workshop + Forsaken Monument',cards:['mishra\'s workshop','forsaken monument'],
      result:'mana incolore infini',mana:5,turn:4,types:['mana']},
    {n:'Tymna + Thrasios (cEDH staples)',cards:['tymna the weaver','thrasios, triton hero'],
      result:'commandants synergiques',mana:5,turn:4,types:['draw','mana']},
    {n:'Dockside Extortionist + Temur Sabertooth',cards:['dockside extortionist','temur sabertooth'],
      result:'mana infini (≥3 artefacts adv.)',mana:7,turn:5,types:['mana']},
    {n:'Auriok Salvagers + Lion\'s Eye Diamond',cards:['auriok salvagers','lion\'s eye diamond'],
      result:'mana infini',mana:5,turn:5,types:['mana']},
    {n:'Bishop of Wings + Divine Visitation',cards:['bishop of wings','divine visitation'],
      result:'angel infinis',mana:9,turn:6,types:['combat']},
    {n:'Glasspool Mimic + Spark Double',cards:['glasspool mimic','spark double'],
      result:'tokens légendaires infinis',mana:7,turn:5,types:['combat']},
    {n:'Worldly Tutor (cEDH staple)',cards:['worldly tutor'],
      result:'fetch creature combo',mana:1,turn:1,types:['tutor']},
    {n:'Skullclamp + small creature engine',cards:['skullclamp'],
      result:'draw engine',mana:1,turn:2,types:['draw']},
    {n:'Tymna draw engine',cards:['tymna the weaver'],
      result:'cmd draw engine',mana:3,turn:3,types:['draw']},
    {n:'Najeela attack triggers + mana sources',cards:['najeela, the blade-blossom'],
      result:'extra turns + win',mana:7,turn:5,types:['combo','combat']},
    {n:'Kinnan + Bloom Tender',cards:['kinnan, bonder prodigy','bloom tender'],
      result:'mana 5-couleurs explosif',mana:5,turn:4,types:['mana']},
    {n:'Yawgmoth + Strionic Resonator',cards:['yawgmoth, thran physician','strionic resonator'],
      result:'mass drain',mana:6,turn:5,types:['drain']},
    {n:'Painful Truths + Necropotence',cards:['necropotence'],
      result:'card draw engine',mana:3,turn:4,types:['draw']},
    {n:'Aetherflux Reservoir alone (50+ life)',cards:['aetherflux reservoir'],
      result:'alt-win',mana:4,turn:6,types:['drain']},
    {n:'Magus of the Wheel (chain)',cards:['magus of the wheel','wheel of fortune'],
      result:'card advantage wheel',mana:6,turn:5,types:['draw']},
    {n:'Bolas\'s Citadel + Sensei\'s Top',cards:['bolas\'s citadel','sensei\'s divining top'],
      result:'card draw infini',mana:7,turn:5,types:['draw']},
    {n:'Bolas\'s Citadel + Aetherflux Reservoir',cards:['bolas\'s citadel','aetherflux reservoir'],
      result:'storm drain',mana:8,turn:6,types:['drain']},
    {n:'Captain Sisay tutor chain',cards:['captain sisay'],
      result:'legendary tutor',mana:4,turn:4,types:['tutor']},
    {n:'Selvala Heart of Wilds + Umbral Mantle',cards:['selvala, heart of the wilds','umbral mantle'],
      result:'mana vert infini',mana:7,turn:5,types:['mana']},
    {n:'Cloudstone Curio + bounce loop',cards:['cloudstone curio','peregrine drake'],
      result:'mana infini',mana:9,turn:6,types:['mana']},
    {n:'Peregrine Drake + Deadeye Navigator',cards:['peregrine drake','deadeye navigator'],
      result:'mana bleu infini',mana:11,turn:6,types:['mana']},
    {n:'Karmic Guide + Body Double',cards:['karmic guide','body double'],
      result:'reanimation loop',mana:10,turn:6,types:['combo']},
    {n:'Lifeline + creature loop',cards:['lifeline','phantom nishoba'],
      result:'recursion infinie',mana:8,turn:6,types:['combo']},
    {n:'Glissa, the Traitor + recursion',cards:['glissa, the traitor','mindslaver'],
      result:'mass control',mana:8,turn:6,types:['lock']},
    {n:'Phantasmal Image + Mirror Gallery',cards:['phantasmal image','mirror gallery'],
      result:'légendaire copies',mana:6,turn:5,types:['combat']},
    {n:'Mox Amber + commanders cheap',cards:['mox amber'],
      result:'fast mana legendary',mana:0,turn:1,types:['mana']},
    {n:'Top of the deck stack (Mystical Tutor → Demonic Tutor)',cards:['mystical tutor','demonic tutor'],
      result:'tutor chain',mana:3,turn:3,types:['tutor']},
    {n:'Lab Maniac + Demonic Consultation',cards:['laboratory maniac','demonic consultation'],
      result:'alt-win T4',mana:4,turn:4,types:['alt-win']},
    {n:'Cephalid Illusionist + Nomads en-Kor',cards:['cephalid illusionist','nomads en-kor'],
      result:'mill self pour Lab Maniac',mana:4,turn:4,types:['mill']}
  ];

  // Mots-clés MTG par stratégie. Permet de détecter si les keywords du deck
  // s'alignent avec son but. Détection via oracleText sur chaque carte.
  // Note : on cherche les mots-clés en TANT QUE keyword, pas comme texte libre.
  var KEYWORDS_BY_PLAN = {
    'aggro':       ['haste','first strike','double strike','menace','trample','prowess'],
    'voltron':     ['unblockable','shroud','hexproof','double strike','trample','indestructible','protection','flying'],
    'tokens':      ['populate','convoke','myriad','amass','fabricate'],
    'mill':        ['mill','surveil'],
    'lifegain':    ['lifelink','lifegain','life'],
    'control':     ['counter','flash','vigilance'],
    'graveyard':   ['unearth','flashback','dredge','escape','disturb','embalm','encore','jump-start','delve'],
    'ramp':        ['landfall','treasure','land','search your library for a land'],
    'spells':      ['storm','prowess','magecraft','copy','flashback','jump-start'],
    'evasion':     ['flying','menace','unblockable','intimidate','shadow','horsemanship'],
    'sacrifice':   ['blood','sacrifice','dies'],
    'discard':     ['madness','threshold','delirium','flashback','escape'],
    'tribal':      ['changeling','cohort','support']
  };

  // Cartes « Game Changers » EDH (forte indication de bracket élevé).
  // Liste indicative — peut être étendue.
  var GAME_CHANGERS = [
    'mana crypt','mana vault','jeweled lotus','mox diamond','mox opal',
    'force of will','mana drain','flusterstorm','pact of negation',
    'demonic tutor','vampiric tutor','imperial seal','grim tutor','enlightened tutor','mystical tutor','worldly tutor',
    'gaea\'s cradle','serra\'s sanctum','tolarian academy','bazaar of baghdad','strip mine','wasteland',
    'time spiral','time walk','channel','black lotus','tinker','yawgmoth\'s will',
    'sensei\'s divining top','cyclonic rift','rhystic study','mystic remora',
    'fierce guardianship','deflecting swat','jeska\'s will','dockside extortionist',
    'underworld breach','ad nauseam','necropotence','sylvan library',
    'gilded drake','opposition agent','grand abolisher','knowledge pool',
    'narset, parter of veils','teferi, time raveler','smothering tithe'
  ];

  // ─── TIERS DE PUISSANCE PAR RÔLE (build 90) ────────────────────────────
  // Échelle : S=staple incontournable / A=très fort / B=bon / C=correct.
  // Source : consensus EDHrec + cEDH community + meta competitif.
  // Format : { roleName: { 'card-name-lower': tierScore } }
  // tierScore : S=100 / A=85 / B=70 / C=55. Tout ce qui n'est pas dans la
  // liste = 50 (médiane neutre). Permet de remplacer un C par un S avec
  // un Δ visible.
  var TIER_S=100,TIER_A=85,TIER_B=70,TIER_C=55,TIER_BASE=50;
  var CARD_TIERS = {
    ramp:{
      'sol ring':TIER_S,'mana crypt':TIER_S,'mana vault':TIER_S,'jeweled lotus':TIER_S,
      'arcane signet':TIER_S,'mox diamond':TIER_S,'chrome mox':TIER_S,
      'dockside extortionist':TIER_S,'mox opal':TIER_S,'mana drain':TIER_S,
      'fellwar stone':TIER_A,'thought vessel':TIER_A,'mind stone':TIER_A,
      'nature\'s lore':TIER_A,'three visits':TIER_A,'farseek':TIER_A,
      'rampant growth':TIER_A,'cultivate':TIER_A,'kodama\'s reach':TIER_A,
      'sakura-tribe elder':TIER_A,'birds of paradise':TIER_A,'noble hierarch':TIER_A,
      'llanowar elves':TIER_A,'elvish mystic':TIER_A,'fyndhorn elves':TIER_A,
      'arbor elf':TIER_A,'deathrite shaman':TIER_S,'orcish lumberjack':TIER_A,
      'talisman of progress':TIER_A,'talisman of dominance':TIER_A,
      'talisman of resilience':TIER_A,'talisman of curiosity':TIER_A,
      'talisman of indulgence':TIER_A,'talisman of impulse':TIER_A,
      'talisman of hierarchy':TIER_A,'talisman of conviction':TIER_A,
      'talisman of creativity':TIER_A,'talisman of unity':TIER_A,
      'commander\'s sphere':TIER_B,'mind stone':TIER_A,'wayfarer\'s bauble':TIER_B,
      'cultivate':TIER_A,'explore':TIER_B,'search for tomorrow':TIER_B,
      'nature\'s lore':TIER_A,'three visits':TIER_A,
      'mox amber':TIER_A,'lotus petal':TIER_A,'simian spirit guide':TIER_A
    },
    draw:{
      'rhystic study':TIER_S,'mystic remora':TIER_S,'sylvan library':TIER_S,
      'esper sentinel':TIER_S,'smothering tithe':TIER_S,
      'necropotence':TIER_S,'consecrated sphinx':TIER_S,'phyrexian arena':TIER_A,
      'bident of thassa':TIER_B,'beast whisperer':TIER_B,'guardian project':TIER_A,
      'harmonize':TIER_A,'concentrate':TIER_B,'fact or fiction':TIER_A,
      'brainstorm':TIER_S,'ponder':TIER_S,'preordain':TIER_S,
      'sign in blood':TIER_A,'night\'s whisper':TIER_A,'read the bones':TIER_B,
      'tezzeret\'s gambit':TIER_A,'painful truths':TIER_A,'ambition\'s cost':TIER_C,
      'kindred discovery':TIER_A,'reconnaissance mission':TIER_B,
      'kor cartographer':TIER_C,'wheel of fortune':TIER_S,
      'tymna the weaver':TIER_S,'thrasios, triton hero':TIER_S,
      'tireless tracker':TIER_A,'glint-horn buccaneer':TIER_A
    },
    removal:{
      'swords to plowshares':TIER_S,'path to exile':TIER_S,'generous gift':TIER_S,
      'beast within':TIER_S,'chaos warp':TIER_A,'krosan grip':TIER_A,
      'cyclonic rift':TIER_S,'assassin\'s trophy':TIER_S,'anguished unmaking':TIER_A,
      'utter end':TIER_A,'mortify':TIER_A,'despark':TIER_A,
      'pongify':TIER_A,'rapid hybridization':TIER_A,'reality shift':TIER_A,
      'go for the throat':TIER_A,'doom blade':TIER_B,'feed the swarm':TIER_B,
      'nature\'s claim':TIER_A,'force of vigor':TIER_S,'return to nature':TIER_C,
      'naturalize':TIER_C,'disenchant':TIER_C,
      'lightning bolt':TIER_S,'lightning strike':TIER_B,'galvanic blast':TIER_B,
      'snap':TIER_A,'unsubstantiate':TIER_B,'cyclonic rift':TIER_S
    },
    interaction:{
      'force of will':TIER_S,'force of negation':TIER_S,'mana drain':TIER_S,
      'mental misstep':TIER_S,'flusterstorm':TIER_S,'pact of negation':TIER_S,
      'counterspell':TIER_S,'mana leak':TIER_B,'negate':TIER_B,
      'fierce guardianship':TIER_S,'deflecting swat':TIER_S,
      'arcane denial':TIER_B,'an offer you can\'t refuse':TIER_A,
      'swan song':TIER_A,'dovin\'s veto':TIER_A,'render silent':TIER_C,
      'mindbreak trap':TIER_A,'spell pierce':TIER_B
    },
    wipe:{
      'wrath of god':TIER_S,'damnation':TIER_S,'supreme verdict':TIER_S,
      'farewell':TIER_S,'austere command':TIER_A,'cleansing nova':TIER_B,
      'toxic deluge':TIER_S,'blasphemous act':TIER_S,'wash away':TIER_C,
      'shatter the sky':TIER_A,'ritual of soot':TIER_B,'damn':TIER_A,
      'fumigate':TIER_B,'dusk legion duelist':TIER_C,'kindred dominance':TIER_B,
      'living death':TIER_S,'cyclonic rift':TIER_S,'crux of fate':TIER_B,
      'in garruk\'s wake':TIER_C
    },
    tutor:{
      'demonic tutor':TIER_S,'vampiric tutor':TIER_S,'imperial seal':TIER_S,
      'grim tutor':TIER_S,'enlightened tutor':TIER_S,'mystical tutor':TIER_S,
      'worldly tutor':TIER_S,'idyllic tutor':TIER_A,'sterling grove':TIER_B,
      'green sun\'s zenith':TIER_S,'eladamri\'s call':TIER_A,
      'survival of the fittest':TIER_S,'sylvan tutor':TIER_A,
      'shared summons':TIER_A,'finale of devastation':TIER_A,
      'natural order':TIER_S,'birthing pod':TIER_S,'eldritch evolution':TIER_A,
      'tooth and nail':TIER_S,'beseech the queen':TIER_A
    },
    counter:{
      'counterspell':TIER_S,'force of will':TIER_S,'force of negation':TIER_S,
      'mana drain':TIER_S,'flusterstorm':TIER_S,'pact of negation':TIER_S,
      'fierce guardianship':TIER_S,'mental misstep':TIER_S,
      'swan song':TIER_A,'dovin\'s veto':TIER_A,'arcane denial':TIER_B
    },
    landFix:{
      // Lands — sources fixing/manabase
      'command tower':TIER_S,'exotic orchard':TIER_A,'mana confluence':TIER_A,
      'city of brass':TIER_A,'reflecting pool':TIER_S,'forbidden orchard':TIER_B,
      // Fetches
      'arid mesa':TIER_S,'bloodstained mire':TIER_S,'flooded strand':TIER_S,
      'marsh flats':TIER_S,'misty rainforest':TIER_S,'polluted delta':TIER_S,
      'scalding tarn':TIER_S,'verdant catacombs':TIER_S,'windswept heath':TIER_S,
      'wooded foothills':TIER_S,'prismatic vista':TIER_S,'evolving wilds':TIER_C,
      'terramorphic expanse':TIER_C,'fabled passage':TIER_A,
      // Shock lands
      'hallowed fountain':TIER_S,'watery grave':TIER_S,'blood crypt':TIER_S,
      'breeding pool':TIER_S,'godless shrine':TIER_S,'overgrown tomb':TIER_S,
      'sacred foundry':TIER_S,'steam vents':TIER_S,'stomping ground':TIER_S,
      'temple garden':TIER_S,
      // Dual lands (originals)
      'tundra':TIER_S,'underground sea':TIER_S,'badlands':TIER_S,
      'taiga':TIER_S,'savannah':TIER_S,'scrubland':TIER_S,
      'volcanic island':TIER_S,'bayou':TIER_S,'plateau':TIER_S,'tropical island':TIER_S,
      // Pain/check lands
      'adarkar wastes':TIER_A,'underground river':TIER_A,'sulfurous springs':TIER_A,
      'karplusan forest':TIER_A,'brushland':TIER_A,'caves of koilos':TIER_A,
      'shivan reef':TIER_A,'llanowar wastes':TIER_A,'yavimaya coast':TIER_A,
      'battlefield forge':TIER_A
    }
  };

  // ─── MANA EFFICIENCY BENCHMARKS PAR RÔLE (build 91) ────────────────────
  // Définit pour chaque rôle :
  //  - `unitValue` : la « valeur référence » d'un effet de base dans ce rôle
  //  - `goodCmc`   : le CMC où l'effet devient « overcost »
  // Permet de calculer, pour chaque carte, un IMPACT SCORE = valeur/CMC.
  // Exemples :
  //   Sol Ring (cmc 1, ramp +2) → impact 200 (élite)
  //   Arcane Signet (cmc 2, ramp +1) → impact 50 (top staple)
  //   Manalith (cmc 3, ramp +1) → impact 33 (médiocre)
  //   Wrath of God (cmc 4, wipe sweep) → impact 100/4=25, mais effet majeur
  // Note : pour les wraths/tutors, l'effet est binaire (oui/non),
  // donc on compare juste le CMC vs le « goodCmc » du rôle.
  var ROLE_BENCHMARKS = {
    ramp:       {goodCmc:2,baseUnitValue:1,description:'1 mana généré'},
    draw:       {goodCmc:2,baseUnitValue:2,description:'2 cartes piochées'},
    removal:    {goodCmc:2,baseUnitValue:1,description:'1 permanent removed'},
    interaction:{goodCmc:2,baseUnitValue:1,description:'1 sort géré'},
    counter:    {goodCmc:2,baseUnitValue:1,description:'1 sort countered'},
    wipe:       {goodCmc:4,baseUnitValue:1,description:'1 sweep'},
    tutor:      {goodCmc:2,baseUnitValue:1,description:'1 carte cherchée'},
    landFix:    {goodCmc:0,baseUnitValue:1,description:'1 fixer mana'}
  };
  // CMC connu des staples (pour comparer le ratio carte-vs-staple). Sert
  // de fallback quand la carte de l'utilisateur a un CMC connu mais qu'on
  // veut comparer à un staple. Format : nom → cmc.
  var STAPLE_CMC = {
    // Ramp
    'sol ring':1,'mana crypt':0,'mana vault':1,'jeweled lotus':0,
    'arcane signet':2,'mox diamond':0,'chrome mox':0,'mox opal':0,
    'dockside extortionist':2,'fellwar stone':2,'thought vessel':2,
    'mind stone':2,'wayfarer\'s bauble':1,'commander\'s sphere':3,
    'nature\'s lore':2,'three visits':2,'farseek':2,'rampant growth':2,
    'cultivate':3,'kodama\'s reach':3,'sakura-tribe elder':2,
    'birds of paradise':1,'noble hierarch':1,'llanowar elves':1,
    'elvish mystic':1,'fyndhorn elves':1,'arbor elf':1,
    'deathrite shaman':1,'orcish lumberjack':1,
    'talisman of progress':2,'talisman of dominance':2,'talisman of resilience':2,
    'talisman of curiosity':2,'talisman of indulgence':2,'talisman of impulse':2,
    'talisman of hierarchy':2,'talisman of conviction':2,'talisman of creativity':2,
    'talisman of unity':2,
    'lotus petal':0,'mox amber':0,'simian spirit guide':3,
    // Draw
    'rhystic study':3,'mystic remora':1,'sylvan library':2,
    'esper sentinel':1,'smothering tithe':4,
    'necropotence':3,'consecrated sphinx':6,'phyrexian arena':3,
    'brainstorm':1,'ponder':1,'preordain':1,
    'sign in blood':2,'night\'s whisper':2,'read the bones':3,
    'painful truths':3,'wheel of fortune':3,'tymna the weaver':3,
    'thrasios, triton hero':2,
    'harmonize':4,'concentrate':4,'fact or fiction':4,
    // Removal
    'swords to plowshares':1,'path to exile':1,'generous gift':3,
    'beast within':3,'chaos warp':3,'krosan grip':2,
    'cyclonic rift':2,'assassin\'s trophy':2,'anguished unmaking':3,
    'lightning bolt':1,'go for the throat':2,'doom blade':2,
    'nature\'s claim':1,'force of vigor':3,'pongify':2,'rapid hybridization':2,
    'feed the swarm':2,'utter end':4,'despark':2,
    // Interaction / Counter
    'force of will':5,'force of negation':3,'mana drain':2,
    'mental misstep':1,'flusterstorm':1,'pact of negation':0,
    'counterspell':2,'mana leak':2,'negate':2,
    'fierce guardianship':3,'deflecting swat':3,
    'swan song':1,'dovin\'s veto':2,'arcane denial':2,
    'an offer you can\'t refuse':1,'spell pierce':1,
    // Wipe
    'wrath of god':4,'damnation':4,'supreme verdict':4,'farewell':6,
    'austere command':6,'toxic deluge':3,'blasphemous act':9,
    'living death':5,'cyclonic rift':2,'damn':4,
    // Tutor
    'demonic tutor':2,'vampiric tutor':1,'imperial seal':1,
    'grim tutor':3,'enlightened tutor':1,'mystical tutor':1,
    'worldly tutor':1,'idyllic tutor':3,'green sun\'s zenith':2,
    'eladamri\'s call':2,'survival of the fittest':2,
    'natural order':4,'birthing pod':3,'tooth and nail':9
  };

  // Cartes Mass Land Denial (MLD) — bracket 4+ indicateur fort.
  var MLD_CARDS = [
    'armageddon','ravages of war','catastrophe','wildfire','obliterate',
    'apocalypse','jokulhaups','impending disaster','decree of annihilation',
    'cataclysmic gearhulk','sunder','boom // bust','myojin of infinite rage'
  ];

  // ─── HELPERS ────────────────────────────────────────────────────────────
  function _nlOf(s){return String(s||'').toLowerCase().split('//')[0].trim();}
  function _hasInOracle(meta,re){
    var t=(meta&&meta.oracleText||'').toLowerCase();return re.test(t);
  }
  function _typeIs(meta,t){
    return ((meta&&meta.typeLine)||'').toLowerCase().indexOf(t.toLowerCase())>=0;
  }
  function _cardSet(rows){
    // Set des noms normalisés présents dans le deck
    var s={};(rows||[]).forEach(function(r){
      var n=_nlOf(r.card&&(r.card.name||r.card.nl)||r.name||r.nl);
      if(n)s[n]=r;
    });return s;
  }

  // ─── 1. WIN CONDITIONS — détection explicite ───────────────────────────
  // Renvoie {primary, plans:[{kind, evidence, confidence}], allMissing}
  function detectWinCons(rows,deck){
    rows=rows||[];
    var plans=[];
    var creatures=[];var anthems=0;var evasion=0;var evasionCreatures=0;
    var burn=0;var drain=0;var mill=0;var voltronSignals=0;
    var altWin=[];var tokenGenerators=0;var counters=0;var massRemoval=0;
    var bigPower=0;
    rows.forEach(function(r){
      var m=r.meta||{};var nl=_nlOf(r.card&&r.card.name||r.name);
      if(!m.typeLine)return;
      var tl=m.typeLine.toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      // Créatures
      if(/creature/.test(tl)){
        creatures.push(r);
        var p=parseInt(m.power||'0',10)||0;if(p>=4)bigPower++;
        if(/flying|menace|unblockable|trample|shadow|horsemanship|skulk|fear|intimidate|can't be blocked/.test(ot)){
          evasion++;evasionCreatures++;
        }
      }
      // Anthems (toujours scan, peut être enchant/artefact)
      if(/(creatures you control get|other creatures you control get|\+1\/\+1 .*to|each creature.*gets \+)/.test(ot))anthems++;
      // Burn (1+ dmg direct)
      if(/deals? \d+ damage to (any target|target player|target opponent|each opponent)/.test(ot))burn++;
      // Drain (lose life payoff)
      if(/(target opponent loses? \d+ life|each opponent loses? \d+ life|life.*for each)/.test(ot))drain++;
      // Mill direct
      if(/mills? \d+ cards?|put.* top.*cards? of.*library into.*graveyard/.test(ot))mill++;
      // Voltron signals : commander damage references
      if(/commander deals|combat damage to a player.*commander|equip|fortify/.test(ot))voltronSignals++;
      // Token generators
      if(/create .* token|tokens?$/.test(ot))tokenGenerators++;
      // Counters / mass removal
      if(/counter target (spell|noncreature)/.test(ot))counters++;
      if(/destroy all|exile all|each creature.*sacrifice|all creatures.*\-/.test(ot))massRemoval++;
      // Alt-win cards (nom exact)
      var altList=['approach of the second sun','laboratory maniac','jace, wielder of mysteries',
        'thassa\'s oracle','felidar sovereign','test of endurance','mortal combat','triskaidekaphobia',
        'maze\'s end','coalition victory','azor\'s elocutors','barren glory','near-death experience',
        'epic struggle','helix pinnacle','simic ascendancy','revel in riches','mayael\'s aria'];
      altList.forEach(function(c){if(nl===c)altWin.push(c);});
    });
    // ─ Plan 1 : Combat ─
    var combatScore=(creatures.length>=20?40:creatures.length*1.5)+anthems*8+evasionCreatures*1.5+bigPower*2;
    if(combatScore>=35){
      plans.push({kind:'combat',label:'⚔ Combat',score:Math.min(100,Math.round(combatScore)),
        evidence:{créatures:creatures.length,anthems:anthems,évasion:evasionCreatures,'power 4+':bigPower}});
    }
    // ─ Plan 2 : Drain / Burn ─
    if(drain+burn>=4){
      plans.push({kind:'drain',label:'💀 Drain / Burn',score:Math.min(100,(drain+burn)*8),
        evidence:{burn:burn,drain:drain}});
    }
    // ─ Plan 3 : Mill ─
    if(mill>=3){
      plans.push({kind:'mill',label:'🌀 Mill',score:Math.min(100,mill*12),
        evidence:{'effets mill':mill}});
    }
    // ─ Plan 4 : Voltron ─
    if(voltronSignals>=8&&creatures.length<=15){
      plans.push({kind:'voltron',label:'⚔ Voltron',score:Math.min(100,voltronSignals*6),
        evidence:{équipements:voltronSignals}});
    }
    // ─ Plan 5 : Token swarm ─
    if(tokenGenerators>=8){
      plans.push({kind:'tokens',label:'👥 Tokens',score:Math.min(100,tokenGenerators*7+anthems*5),
        evidence:{'générateurs tokens':tokenGenerators,anthems:anthems}});
    }
    // ─ Plan 6 : Control ─
    if(counters>=6&&massRemoval>=3){
      plans.push({kind:'control',label:'🛡 Control',score:Math.min(100,counters*5+massRemoval*8),
        evidence:{contresorts:counters,wraths:massRemoval}});
    }
    // ─ Plan 7 : Alt-win ─
    if(altWin.length){
      plans.push({kind:'alt-win',label:'⚡ Win Condition alternative',score:90,
        evidence:{cartes:altWin}});
    }
    plans.sort(function(a,b){return b.score-a.score;});
    var primary=plans[0]||null;
    return {
      plans:plans,
      primary:primary,
      missing:plans.length===0?'⚠ Aucun plan de victoire clairement identifiable':null
    };
  }

  // ─── 2. MANABASE PAR COULEUR — sources vs pips requis ──────────────────
  function manabaseByColor(rows,deck){
    rows=rows||[];
    // Pips requis : on parse manaCost de chaque carte non-terrain
    var pipDemand={W:0,U:0,B:0,R:0,G:0};
    var pipCount={W:0,U:0,B:0,R:0,G:0};
    var sources={W:0,U:0,B:0,R:0,G:0,any:0};
    var nLands=0;var nNonland=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      var ot=(m.oracleText||'').toLowerCase();
      var qty=r.qty||1;
      if(/land/.test(tl)){
        nLands+=qty;
        // Détection sources : "add {X}" ou "Add one mana of any color"
        var addsAny=/add (one|two|three) mana of any color|add (one|two|three) mana of any (one )?color/.test(ot);
        if(addsAny){sources.any+=qty;return;}
        ['w','u','b','r','g'].forEach(function(c){
          var re=new RegExp('add \\{'+c+'\\}|add one mana of any color|\\{'+c+'\\} *.','i');
          if(re.test(ot))sources[c.toUpperCase()]+=qty;
        });
      }else{
        nNonland+=qty;
        var mc=(m.manaCost||'').toLowerCase();
        // Compte des pips par couleur dans le coût (cartes lancées plusieurs fois = ×qty)
        ['w','u','b','r','g'].forEach(function(c){
          var matches=mc.match(new RegExp('\\{'+c+'\\}','g'))||[];
          pipCount[c.toUpperCase()]+=matches.length*qty;
        });
      }
    });
    // Pips demandés pondérés par fréquence
    var totalPips=0;Object.keys(pipCount).forEach(function(k){totalPips+=pipCount[k];});
    // Sources effectives = sources couleur + sources "any color"
    var effective={};['W','U','B','R','G'].forEach(function(c){
      effective[c]=sources[c]+sources.any;
    });
    // Recommandations Frank Karsten (approximation simplifiée pour Commander) :
    // - 1 pip coloré dans le coût → ~13-14 sources de cette couleur (deck 99)
    // - 2 pips colorés → ~19-20 sources
    // - 3 pips colorés → ~22-23 sources
    var fmt=(deck&&deck.format||'').toLowerCase();
    var isCmd=fmt==='commander'||fmt==='paupercmd'||fmt==='brawl'||fmt==='oathbreaker';
    var targetForPips=function(p){
      if(!isCmd){
        // 60 cards format simplifié
        if(p===1)return 14;if(p===2)return 20;if(p>=3)return 23;return 0;
      }
      if(p===1)return 13;if(p===2)return 19;if(p===3)return 22;if(p>=4)return 24;return 0;
    };
    var byColor=[];var deficits=[];
    ['W','U','B','R','G'].forEach(function(c){
      if(pipCount[c]===0)return;
      // Estime le "pip mode" : moyenne pondérée
      var p=Math.round(pipCount[c]/Math.max(1,nNonland)*nNonland);
      // Mode simplifié : 1 pip si total ≤10, 2 si 11-25, 3 si 26+, 4 si 40+
      var pipMode=pipCount[c]<=10?1:pipCount[c]<=25?2:pipCount[c]<=40?3:4;
      var target=targetForPips(pipMode);
      var have=effective[c];
      var deficit=Math.max(0,target-have);
      byColor.push({color:c,pips:pipCount[c],sources:have,target:target,pipMode:pipMode,deficit:deficit});
      if(deficit>0)deficits.push({color:c,have:have,need:target,deficit:deficit});
    });
    // Détection bilands / multilands
    var multilands=0;var fetches=0;var painlands=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      if(!/land/.test(tl))return;
      var ot=(m.oracleText||'').toLowerCase();
      if(/\{t\}.*add.*or.*\{[wubrg]\}/.test(ot))multilands+=r.qty||1;
      if(/search your library for a.*land/.test(ot))fetches+=r.qty||1;
      if(/deals 1 damage to you/.test(ot)&&/add.*\{[wubrg]\}.*\{[wubrg]\}/.test(ot))painlands+=r.qty||1;
    });
    return {
      nLands:nLands,
      nNonland:nNonland,
      pipCount:pipCount,
      sources:effective,
      byColor:byColor,
      deficits:deficits,
      multilands:multilands,
      fetches:fetches,
      painlands:painlands,
      verdict:deficits.length===0?'✓ Manabase équilibrée par couleur':deficits.length+' couleur(s) en déficit'
    };
  }

  // ─── 3. BRACKET EDH — niveau 1-5 ────────────────────────────────────────
  function bracketEDH(rows,deck){
    var fmt=(deck&&deck.format||'').toLowerCase();
    var isCmd=fmt==='commander'||fmt==='paupercmd'||fmt==='brawl'||fmt==='oathbreaker';
    if(!isCmd)return null;
    var set=_cardSet(rows);
    var signals=[];var score=0;
    var nGc=0,nMld=0,nTutors=0,nCombos=0,fastMana=0;
    Object.keys(set).forEach(function(n){
      if(GAME_CHANGERS.indexOf(n)>=0){nGc++;signals.push({type:'game-changer',card:n});}
      if(MLD_CARDS.indexOf(n)>=0){nMld++;signals.push({type:'mld',card:n});}
      if(/tutor|demonic consultation|imperial seal/.test(n))nTutors++;
      if(/^(mana crypt|mana vault|jeweled lotus|mox |black lotus|lotus petal|chrome mox|dockside extortionist|sol ring)$/.test(n))fastMana++;
    });
    // Détection combos
    var combosFound=_detectCombosLight(rows);
    nCombos=combosFound.length;
    // Calcul de bracket
    score+=nGc*1.2;score+=nMld*2;score+=nTutors*0.4;score+=nCombos*1.5;score+=fastMana*0.8;
    var bracket=1;
    if(score>=2)bracket=2;
    if(score>=6)bracket=3;
    if(score>=12)bracket=4;
    if(score>=22)bracket=5;
    // Override : 2+ MLD = au moins 4
    if(nMld>=2&&bracket<4)bracket=4;
    // Override : combos infinis avant T7 = au moins 4
    var earlyCombo=combosFound.some(function(c){return c.turn<=6;});
    if(earlyCombo&&bracket<4)bracket=4;
    var labels={1:'Casual',2:'Average',3:'Optimisé',4:'Tryhard',5:'cEDH'};
    return {
      bracket:bracket,
      label:labels[bracket],
      score:Math.round(score*10)/10,
      signals:signals,
      stats:{gameChangers:nGc,mld:nMld,tutors:nTutors,combos:nCombos,fastMana:fastMana}
    };
  }

  // ─── 4. COMBOS — détection + pertinence ────────────────────────────────
  function _detectCombosLight(rows){
    var set=_cardSet(rows);
    var found=[];
    COMBOS.forEach(function(c){
      var allPresent=c.cards.every(function(n){return set[n]!=null;});
      if(allPresent)found.push(c);
    });
    return found;
  }
  function detectCombos(rows,deck,winConsReport){
    var found=_detectCombosLight(rows);
    // Pertinence : un combo est pertinent si :
    // - son type s'aligne avec le plan primaire du deck, OU
    // - c'est un alt-win (toujours pertinent), OU
    // - le deck est < 5 sources de tutors (combo opportuniste)
    var primaryKind=winConsReport&&winConsReport.primary?winConsReport.primary.kind:null;
    var report=found.map(function(c){
      var relevant=
        c.types.indexOf('alt-win')>=0||
        (primaryKind&&c.types.indexOf(primaryKind)>=0)||
        c.types.indexOf('mana')>=0; // mana combos toujours utiles
      return Object.assign({},c,{relevant:relevant});
    });
    return {
      combos:report,
      count:report.length,
      relevantCount:report.filter(function(c){return c.relevant;}).length
    };
  }

  // ─── 5. ANTI-SYNERGIES — commandant vs payoff manquant ─────────────────
  // Build 89 : élargi à 50+ commandants populaires + rules-based génériques.
  // Format unifié : chaque rule scanne les rows et déduit des issues.
  function _countMatches(rows,patterns){
    var n=0;
    rows.forEach(function(r){
      var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
      var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
      var nl=_nlOf(r.card&&r.card.name||r.name);
      patterns.forEach(function(p){
        if(p.re&&p.re.test(p.target==='type'?tl:p.target==='name'?nl:ot))n++;
        else if(p.in&&p.in.indexOf(nl)>=0)n++;
      });
    });
    return n;
  }
  // Helper : compte avec ou (au moins une des conditions)
  function _scanWith(rows,scanFn){
    var n=0;rows.forEach(function(r){if(scanFn(r))n++;});return n;
  }
  function antiSynergies(rows,deck){
    var issues=[];
    if(!deck||!deck.commander||!deck.commander.name)return {issues:[]};
    var cmd=deck.commander.name.toLowerCase();
    // ─── Règles par commandant (50+ populaires) ───
    // Helper pour pousser des règles standard
    function push(sev,msg){issues.push({sev:sev,msg:msg});}
    function need(label,actual,target,sev){
      sev=sev||(actual<target/2?'high':'med');
      push(sev,label+' → '+actual+' (idéal '+target+'+)');
    }
    // ── COUNTERS / +1/+1 / Proliferate ──
    if(/atraxa.*praetors|atraxa.*grand unifier|hadana.*climb|ezuri.*claw|ghave|ghalta.*mavren|kalonian|marath|inalla|toothy/.test(cmd)){
      var prolif=_scanWith(rows,function(r){return /proliferate/.test((r.meta&&r.meta.oracleText||'').toLowerCase());});
      var ctr=_scanWith(rows,function(r){return /\+1\/\+1 counter/.test((r.meta&&r.meta.oracleText||'').toLowerCase());});
      if(/atraxa|ezuri.*claw|ghave|hadana/.test(cmd)&&prolif<5)need('Proliferate',prolif,10,'high');
      if(ctr<8)need('+1/+1 counters',ctr,15);
    }
    // ── Ninjutsu / Evasive ──
    if(/yuriko|ink-eyes|silver-fur master|satoru umezawa|kaito|ninja/.test(cmd)){
      var evas=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
        return /creature/.test(tl)&&/flying|menace|unblockable|shadow|horsemanship|skulk|can't be blocked/.test(ot);
      });
      var bigTop=_scanWith(rows,function(r){
        var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();var cmc=r.meta&&r.meta.cmc||0;
        return /creature/.test(tl)&&cmc>=5;
      });
      if(evas<8)need('Créatures évasives',evas,15,'high');
      if(/yuriko/.test(cmd)&&bigTop<10)need('Gros en top (Yuriko)',bigTop,15);
    }
    // ── Edric / Unblockable spam ──
    if(/edric|tetsuko|coastal piracy|reconnaissance/.test(cmd)){
      var unblock=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();var cmc=r.meta&&r.meta.cmc||0;
        return cmc<=2&&/can't be blocked|unblockable|shadow|skulk|menace/.test(ot);
      });
      if(unblock<12)need('Créatures unblockable ≤2',unblock,20,'high');
    }
    // ── Tribal Goblins (Krenko, Wort, Muxus, Grenzo) ──
    if(/krenko|wort.*raidmother|muxus|grenzo|skirk prospector|goblin chieftain|squee.*goblin/.test(cmd)){
      var goblins=_scanWith(rows,function(r){return /goblin/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(goblins<20)need('Goblins',goblins,30,'high');
    }
    // ── Tribal Slivers ──
    if(/sliver|the first sliver|sliver legion|sliver overlord/.test(cmd)){
      var slivers=_scanWith(rows,function(r){return /sliver/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(slivers<25)need('Slivers',slivers,35,'high');
    }
    // ── Tribal Elves (Ezuri, Marwyn, Lathril) ──
    if(/ezuri.*renegade|marwyn|lathril|gilt-leaf winnower|nath.*leaves|seton/.test(cmd)){
      var elves=_scanWith(rows,function(r){return /elf|elves/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(elves<22)need('Elfes',elves,32,'high');
    }
    // ── Tribal Dragons (The Ur-Dragon, Scion, Tiamat, Niv) ──
    if(/the ur-dragon|scion of the ur-dragon|tiamat|niv-mizzet reborn|miirym/.test(cmd)){
      var dragons=_scanWith(rows,function(r){return /dragon/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(dragons<20)need('Dragons',dragons,28);
    }
    // ── Tribal Vampires (Edgar, Olivia, Sorin) ──
    if(/edgar markov|edgar.*charmed|olivia.*vampire|sorin lord of innistrad/.test(cmd)){
      var vamps=_scanWith(rows,function(r){return /vampire/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(vamps<22)need('Vampires',vamps,30,'high');
    }
    // ── Tribal Zombies (Wilhelt, Varina, Sidisi) ──
    if(/wilhelt|varina|sidisi.*brood tyrant|gisa|geralf|grimgrin/.test(cmd)){
      var zomb=_scanWith(rows,function(r){return /zombie/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(zomb<22)need('Zombies',zomb,30,'high');
    }
    // ── Tribal Knights / Soldiers (Aragorn, Sram, Syr Gwyn) ──
    if(/aragorn|syr gwyn|knights/.test(cmd)){
      var kts=_scanWith(rows,function(r){return /knight/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(kts<18)need('Chevaliers',kts,25);
    }
    // ── Tribal Cats (Arahbo, Mirri) ──
    if(/arahbo|mirri.*weatherlight|kaheera/.test(cmd)){
      var cats=_scanWith(rows,function(r){return /cat/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(cats<20)need('Chats',cats,28);
    }
    // ── Sacrifice / Aristocrats (Korvold, Meren, Teysa) ──
    if(/korvold|meren|teysa.*orzhov|teysa.*karlov|judith|savra|prossh|ognis/.test(cmd)){
      var sacOut=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /sacrifice (a|another) (creature|permanent)/.test(ot);
      });
      var sacPay=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /whenever.* dies|sacrificed/.test(ot);
      });
      var tokenGen=_scanWith(rows,function(r){return /create .* token/.test((r.meta&&r.meta.oracleText||'').toLowerCase());});
      if(sacOut<5)need('Sacrifice outlets',sacOut,8,'high');
      if(sacPay<6)need('Payoffs « dies/sacrificed »',sacPay,10);
      if(tokenGen<8)need('Générateurs de tokens (fodder)',tokenGen,12);
    }
    // ── Graveyard (Muldrotha, Karador, Tasigur, Sidisi) ──
    if(/muldrotha|karador|tasigur|sidisi|haakon|kess|the gitrog|jarad/.test(cmd)){
      var recur=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /return target .* from your graveyard|return .* graveyard to your hand|return .* graveyard to the battlefield/.test(ot);
      });
      var selfMill=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /mill (one|two|three|four|five|six|seven|eight|nine|ten)|put .* into your graveyard|surveil [2-9]/.test(ot);
      });
      if(recur<8)need('Effets de récursion cimetière',recur,12,'high');
      if(selfMill<5)need('Self-mill pour alimenter le cimetière',selfMill,8);
    }
    // ── Spellslinger (Niv-Mizzet, Mizzix, Veyran, Kalamax) ──
    if(/niv-mizzet|mizzix|veyran|kalamax|adeliz|kykar|krark.*thumb/.test(cmd)){
      var inst=_scanWith(rows,function(r){return /instant|sorcery/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(inst<25)need('Instants/Sorceries',inst,32,'high');
    }
    // ── Voltron (Uril, Sram, Rafiq, Tiana, Bruna, Sigarda) ──
    if(/uril|sram|rafiq|tiana|bruna.*light of alabaster|sigarda|kemba|chishiro|halvar/.test(cmd)){
      var equip=_scanWith(rows,function(r){return /equipment/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      var aura=_scanWith(rows,function(r){return /aura/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      var prot=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /hexproof|shroud|protection from|indestructible/.test(ot);
      });
      if(/sram|uril|rafiq|bruna/.test(cmd)&&aura+equip<15)need('Auras/Équipements',aura+equip,20,'high');
      if(prot<6)need('Sources de protection (hexproof/shroud/indestructible)',prot,10,'high');
    }
    // ── Group hug / Politics (Phelddagrif, Selvala) ──
    if(/phelddagrif|selvala.*explorer|edric.*spymaster|kynaios/.test(cmd)){
      var groupDraw=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /each player draws|all players draw|each opponent draws/.test(ot);
      });
      if(groupDraw<6)need('Effets de pioche partagée',groupDraw,10);
    }
    // ── Storm (Birgi, Codie, Yuriko-storm, Krark) ──
    if(/birgi|codie|grenzo.*havoc raiser|krark.*thumb/.test(cmd)){
      var cheapInst=_scanWith(rows,function(r){
        var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();var cmc=r.meta&&r.meta.cmc||99;
        return /instant|sorcery/.test(tl)&&cmc<=2;
      });
      if(cheapInst<20)need('Sorts ≤2 mana (storm count)',cheapInst,28,'high');
    }
    // ── Stax (Winter, Glissa Sunslayer, Tergrid) ──
    if(/winter|glissa.*sunslayer|tergrid|root maze|smokestack|stax/.test(cmd)){
      var lock=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /lands don't untap|skip your.* phase|sacrifice a permanent.*unless/.test(ot);
      });
      if(lock<6)need('Pièces de stax / lock',lock,10,'med');
    }
    // ── Landfall (Omnath, Aesi, Tatyova, Lord Windgrace) ──
    if(/omnath.*landfall|omnath.*roil|aesi|tatyova|lord windgrace|nissa.*vital force/.test(cmd)){
      var land=_scanWith(rows,function(r){return /land/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      var landRamp=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /search your library for .* land|put .* land.* battlefield/.test(ot);
      });
      if(land<38)need('Terrains (landfall need ≥38)',land,40,'high');
      if(landRamp<10)need('Effets « extra land drop / fetch »',landRamp,15,'high');
    }
    // ── Treasures (Magda, Lord Xander, Goldspan Dragon, Brago, Captain Hook) ──
    if(/magda|lord xander|goldspan|brass\'s tunnel|captain hook|admiral beckett brass/.test(cmd)){
      var trea=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /treasure token|treasure/.test(ot);
      });
      if(trea<12)need('Effets Treasure',trea,18);
    }
    // ── Equipment matter (Wyleth, Akiri, Nazahn) ──
    if(/wyleth|akiri|nazahn|valduk|halvar|kelsien|godo/.test(cmd)){
      var eq=_scanWith(rows,function(r){return /equipment/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(eq<15)need('Équipements',eq,22,'high');
    }
    // ── Enchantress (Sythis, Sigarda host, Tuvasa, Light-Paws) ──
    if(/sythis|tuvasa|sigarda.*host|light-paws|sanctum weaver|argothian enchantress|setessan champion/.test(cmd)){
      var enc=_scanWith(rows,function(r){return /enchantment/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(enc<25)need('Enchantements',enc,32,'high');
    }
    // ── Lifegain (Karlov, Oloro, Heliod, Trostani) ──
    if(/karlov|oloro|trostani|heliod.*god of the sun|ayli/.test(cmd)){
      var lg=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /gain (one|two|three|four|five|x|that much) life|lifelink|whenever you gain life/.test(ot);
      });
      if(lg<14)need('Effets de gain de vie / payoffs',lg,20,'high');
    }
    // ── Blink / ETB (Roon, Brago, Aminatou, Norin, Yorion) ──
    if(/roon|brago|aminatou|norin|yorion|teleportation circle|conjurer's closet/.test(cmd)){
      var blink=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /exile target.*creature.*return.*battlefield|flicker|blink/.test(ot);
      });
      var etb=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /when .* enters the battlefield/.test(ot);
      });
      if(blink<6)need('Effets blink/flicker',blink,10,'high');
      if(etb<15)need('Créatures ETB-payoff',etb,22);
    }
    // ── Token spam (Rhys, Krenko, Adriana, Anim Pakal) ──
    if(/rhys|adriana|anim pakal|chatterfang|jetmir|emmara|trostani/.test(cmd)){
      var tg=_scanWith(rows,function(r){return /create .* token/.test((r.meta&&r.meta.oracleText||'').toLowerCase());});
      var anth=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /creatures you control get \+|other creatures you control get \+/.test(ot);
      });
      if(tg<14)need('Générateurs de tokens',tg,20,'high');
      if(anth<5)need('Anthems',anth,8);
    }
    // ── Reanimator (Chainer, Sheoldred, Karador, Sedris) ──
    if(/chainer|sheoldred|karador|sedris|alesha|reanimator/.test(cmd)){
      var fattie=_scanWith(rows,function(r){
        var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();var cmc=r.meta&&r.meta.cmc||0;
        return /creature/.test(tl)&&cmc>=6;
      });
      var reanim=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /return target creature from your graveyard|put target creature card from .* graveyard/.test(ot);
      });
      if(fattie<10)need('Grosses créatures cibles (CMC≥6)',fattie,15);
      if(reanim<5)need('Effets de reanimation',reanim,8,'high');
    }
    // ── Wheels (Nekusar, Magus of Wheel, Narset, Notion Thief) ──
    if(/nekusar|jace.*archmage eternal|kydele|sami/.test(cmd)){
      var wh=_scanWith(rows,function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        return /each player.*discards.*draws|wheel of fortune|windfall|magus of the wheel/.test(ot);
      });
      if(wh<5)need('Effets wheel/windfall',wh,8,'high');
    }
    // ── Mono color (Karametra → vert, Heliod → blanc, etc.) ──
    if(/talrand/.test(cmd)){
      var inst2=_scanWith(rows,function(r){return /instant|sorcery/.test((r.meta&&r.meta.typeLine||'').toLowerCase());});
      if(inst2<28)need('Instants/Sorceries (Talrand)',inst2,35,'high');
    }
    return {issues:issues};
  }

  // ─── 6. KEYWORDS vs PLAN DE JEU (build 89) ─────────────────────────────
  // Compare les keywords détectés sur les créatures du deck à ceux qu'on
  // attendrait selon le plan de victoire principal. Soulève les mismatchs.
  function keywordsAlignment(rows,winConsReport){
    if(!winConsReport||!winConsReport.primary)return {primary:null,present:[],expected:[],missing:[]};
    var primary=winConsReport.primary.kind;
    var expected=KEYWORDS_BY_PLAN[primary]||[];
    // Détection des keywords dans le deck
    var presentMap={};
    rows.forEach(function(r){
      var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
      Object.keys(KEYWORDS_BY_PLAN).forEach(function(p){
        KEYWORDS_BY_PLAN[p].forEach(function(kw){
          var re=new RegExp('\\b'+kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
          if(re.test(ot)){presentMap[kw]=(presentMap[kw]||0)+(r.qty||1);}
        });
      });
    });
    var present=Object.keys(presentMap);
    var missing=expected.filter(function(kw){return !presentMap[kw];});
    return {
      primary:primary,
      present:present,
      expected:expected,
      missing:missing,
      counts:presentMap
    };
  }

  // ─── 7. ROBUSTESSE — résistance aux menaces classiques ────────────────
  // Évalue la résilience du deck face à 3 scenarios concrets :
  // - Wrath T4 (mass removal) : capacité à recover
  // - Combo T3-T4 adverse : capacité à interagir
  // - Stax / lock pieces : capacité à briser
  function robustness(rows,deck){
    var nRecur=0,nInteraction=0,nProtection=0,nWipe=0,nThreatsCheap=0;
    rows.forEach(function(r){
      var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
      var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
      var cmc=r.meta&&r.meta.cmc||99;
      // Récursion (recover du wrath)
      if(/return.* from your graveyard.*battlefield|return.*creature card.*battlefield|recur/.test(ot))nRecur++;
      // Interaction instant-speed
      if((/instant/.test(tl)||/flash/.test(ot))&&/counter target|destroy target|exile target|return target/.test(ot))nInteraction++;
      // Protection (indestructible / hexproof / phasing / etc.)
      if(/indestructible|hexproof|shroud|protection from|phasing|can't be the target/.test(ot))nProtection++;
      // Mass removal (notre propre wrath)
      if(/destroy all|exile all|each creature.*-x\/-x|all creatures get -/.test(ot))nWipe++;
      // Threats légers (rapide)
      if(/creature/.test(tl)&&cmc<=3)nThreatsCheap++;
    });
    // Score wrath recovery
    var wrathScore=Math.min(100,Math.round(nRecur*6+nProtection*4+nThreatsCheap*1.5));
    // Score combo interaction
    var comboScore=Math.min(100,Math.round(nInteraction*12));
    // Score stax breaker
    var staxScore=Math.min(100,Math.round(nWipe*15+nProtection*3));
    var overallRobust=Math.round((wrathScore+comboScore+staxScore)/3);
    return {
      score:overallRobust,
      wrathRecovery:{score:wrathScore,recursion:nRecur,protection:nProtection,cheapThreats:nThreatsCheap},
      comboInteraction:{score:comboScore,instantInteraction:nInteraction},
      staxBreaker:{score:staxScore,wipes:nWipe,protection:nProtection},
      verdict:overallRobust>=70?'✓ Deck robuste':overallRobust>=45?'~ Robustesse moyenne':'⚠ Deck fragile face aux menaces classiques'
    };
  }

  // ─── 8. LÉGALITÉ DE FORMAT (build 90) ──────────────────────────────────
  // Utilise dCardMeta.legalities (Scryfall) pour vérifier que chaque carte
  // est légale dans le format du deck. Format keys = scryfall format ids.
  var FORMAT_TO_LEGALITY_KEY = {
    'standard':'standard','pioneer':'pioneer','modern':'modern',
    'legacy':'legacy','vintage':'vintage','pauper':'pauper',
    'commander':'commander','paupercmd':'paupercommander',
    'brawl':'brawl','historic':'historic','alchemy':'alchemy',
    'oathbreaker':'oathbreaker','duel':'duel','premodern':'premodern'
  };
  function legalityCheck(rows,deck){
    var fmt=(deck&&deck.format||'').toLowerCase();
    var legKey=FORMAT_TO_LEGALITY_KEY[fmt];
    if(!legKey)return {fmt:fmt,checked:false,issues:[]};
    var issues=[];
    rows.forEach(function(r){
      var m=r.meta||{};var leg=m.legalities;
      if(!leg)return; // pas de données legalities pour cette carte
      var status=leg[legKey];
      if(status==='banned'){
        issues.push({card:(r.card&&r.card.name||r.name),sev:'high',status:'banned',msg:'BANNED en '+fmt});
      }else if(status==='restricted'){
        issues.push({card:(r.card&&r.card.name||r.name),sev:'med',status:'restricted',msg:'restricted (1× max) en '+fmt});
      }else if(status==='not_legal'){
        issues.push({card:(r.card&&r.card.name||r.name),sev:'high',status:'not_legal',msg:'pas légal en '+fmt});
      }
    });
    return {fmt:fmt,checked:true,issues:issues};
  }

  // ─── 9. SUGGESTIONS DE SWAP (build 90) ─────────────────────────────────
  // Pour chaque rôle (ramp/draw/removal/etc.), identifie les cartes faibles
  // du deck (tier C ou inférieur) et propose des alternatives S/A non-présentes.
  function _detectCardRole(meta){
    var ot=(meta&&meta.oracleText||'').toLowerCase();
    var tl=(meta&&meta.typeLine||'').toLowerCase();
    if(/land/.test(tl)){
      // Si fixer (multilands / fetches) → landFix
      if(/add (one|two|three) mana of any|search your library for a.* land|\{t\}.*add.*or.*\{[wubrg]\}/.test(ot))return 'landFix';
      return null;
    }
    if(/search your library for .* land|add \{[wubrg]\}|add one mana of any/.test(ot))return 'ramp';
    if(/draw (a|two|three|x|that many) cards?/.test(ot))return 'draw';
    if(/counter target spell/.test(ot))return 'counter';
    if(/destroy all|exile all/.test(ot))return 'wipe';
    if(/destroy target|exile target/.test(ot))return 'removal';
    if(/search your library for a/.test(ot))return 'tutor';
    return null;
  }
  // Build 95 : tier dynamique via EDHREC rank
  // Si dCardMeta.edhrecRank disponible, on attribue un tier auto :
  // Rank 1-150 → S+ (95), 151-500 → S (88), 501-1500 → A (78),
  // 1501-3000 → B (68), 3001-6000 → C+ (60), 6001-15000 → C (52), >15000 → 45
  function _tierFromEdhrecRank(rank){
    if(!rank||rank<=0)return null;
    if(rank<=150)return 95;
    if(rank<=500)return 88;
    if(rank<=1500)return 78;
    if(rank<=3000)return 68;
    if(rank<=6000)return 60;
    if(rank<=15000)return 52;
    return 45;
  }
  function _powerOfCard(nl,role,meta){
    if(CARD_TIERS[role]&&CARD_TIERS[role][nl])return CARD_TIERS[role][nl];
    // Fallback EDHREC rank si disponible
    if(meta&&meta.edhrecRank){
      var dyn=_tierFromEdhrecRank(meta.edhrecRank);
      if(dyn)return dyn;
    }
    return TIER_BASE;
  }
  // ─── TRIBAL_CATALOG (build 98) ─────────────────────────────────────────
  // Pour les 40+ tribes les plus joués en EDH, liste :
  //  - `creatures` : top créatures du type (staples par EDHrec consensus)
  //  - `payoffs`   : effets non-créatures liés au tribe (lords, anthems,
  //                  tribal triggers, équipements tribaux)
  //  - `keyCommanders` : commandants tribaux populaires
  // Format clé = lowercase exact du sub-type.
  // Utilisé par suggestSwaps pour proposer des cartes du MÊME tribe au lieu
  // de juste protéger les existantes.
  var TRIBAL_CATALOG = {
    rogue:{
      creatures:['anowon, the ruin thief','etrata, the silencer','notion thief','sygg, river guide',
        'stenn, paranoid partisan','gonti, lord of luxury','soaring thought-thief','triton shorestalker',
        'higure, the still wind','prowling pangolin','vega, the watcher','satoru umezawa',
        'silver-fur master','geralf, the fleshwright','ingenious thief','glasspool mimic',
        'nighthawk vigilante','professional face-breaker','obyra, dreaming duelist'],
      payoffs:['rogues\' passage','curiosity','coastal piracy','reconnaissance mission',
        'edric, spymaster of trest','revel in riches','treasure cruise']
    },
    goblin:{
      creatures:['krenko, mob boss','muxus, goblin grandee','goblin chieftain','warren instigator',
        'wily goblin','goblin warchief','siege-gang commander','krenko, baron of tin street',
        'skirk prospector','goblin matron','goblin recruiter','squee, goblin nabob',
        'pashalik mons','grenzo, dungeon warden','beetleback chief','goblin lackey',
        'mogg war marshal','dockside extortionist','conspicuous snoop','goblin piledriver',
        'goblin king','goblin sharpshooter','tarfire'],
      payoffs:['coat of arms','urza\'s incubator','vanquisher\'s banner','door of destinies',
        'goblin bombardment','goblin offensive','impact tremors','purphoros, god of the forge',
        'goblin gathering','battle hymn']
    },
    elf:{
      creatures:['ezuri, renegade leader','elvish archdruid','priest of titania','marwyn, the nurturer',
        'lathril, blade of the elves','llanowar elves','elvish mystic','fyndhorn elves','arbor elf',
        'heritage druid','wirewood symbiote','elvish visionary','imperious perfect','allosaurus shepherd',
        'eladamri, lord of leaves','seton, krosan protector','nettle sentinel','dwynen, gilt-leaf daen',
        'wellwisher','staff of the storyteller','quirion ranger','wood elves'],
      payoffs:['coat of arms','urza\'s incubator','vanquisher\'s banner','door of destinies',
        'shamanic revelation','craterhoof behemoth','sylvan messenger','beast whisperer','elvish promenade']
    },
    sliver:{
      creatures:['the first sliver','sliver legion','sliver overlord','sliver queen',
        'morophon, the boundless','sliver hivelord','muscle sliver','sinew sliver',
        'predatory sliver','blade sliver','manaweft sliver','gemhide sliver','cloudshredder sliver',
        'lavabelly sliver','venom sliver','striking sliver','syphon sliver','crystalline sliver',
        'belligerent sliver','heart sliver','quick sliver','two-headed sliver','battering sliver'],
      payoffs:['coat of arms','urza\'s incubator','vanquisher\'s banner','door of destinies',
        'descendants\' path','training grounds','rhystic study']
    },
    dragon:{
      creatures:['the ur-dragon','scion of the ur-dragon','tiamat','miirym, sentinel wyrm',
        'niv-mizzet reborn','utvara hellkite','dragon tempest','old gnawbone','ancient brass dragon',
        'ancient copper dragon','ancient gold dragon','ancient silver dragon','dragonlord ojutai',
        'dragonlord atarka','dragonlord kolaghan','dragonlord silumgar','dragonlord dromoka',
        'lathliss, dragon queen','sarkhan, fireblood','dragon\'s hoard','dragon broodmother',
        'savage ventmaw','terror of the peaks','steel hellkite','dragon mage','balefire dragon'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','dragon tempest','crucible of fire',
        'sarkhan unbroken','silumgar\'s scorn','door of destinies','training grounds']
    },
    vampire:{
      creatures:['edgar markov','olivia voldaren','strefan, maurer progenitor','sorin, lord of innistrad',
        'bloodlord of vaasgoth','blood artist','viscera seer','bloodghast','dusk legion zealot',
        'twilight prophet','cordial vampire','vampire nocturnus','bloodthirsty aerialist',
        'falkenrath gorger','captivating vampire','indulgent aristocrat','indulgent tormentor',
        'sangromancer','vampire of the dire moon','vampire socialite','queen marchesa',
        'malakir bloodwitch','knight of the ebon legion','crossway troublemakers'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'exquisite blood','sanguine bond','vito, thorn of the dusk rose','call the coppercoats']
    },
    zombie:{
      creatures:['wilhelt, the rotcleaver','varina, lich queen','sidisi, brood tyrant','gisa, glorious resurrector',
        'death baron','lord of the accursed','undead warchief','cemetery reaper','diregraf colossel',
        'risen executioner','zombie master','rooftop storm','grimgrin, corpse-born','geralf\'s messenger',
        'dread wanderer','gravecrawler','relentless dead','liliana\'s mastery','zombify',
        'ghoulcaller gisa','sidisi, undead vizier','noxious ghoul','plague belcher','geralf\'s mindcrusher'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'death baron','lord of the accursed','rooftop storm','call to the grave','undead warchief',
        'liliana, dreadhorde general','liliana, death\'s majesty']
    },
    wizard:{
      creatures:['azami, lady of scrolls','baral, chief of compliance','adeliz, the cinder wind',
        'inalla, archmage ritualist','docent of perfection','riptide laboratory','sigil tracer',
        'patron wizard','meddling mage','snapcaster mage','arcanis the omnipotent','venser, shaper savant',
        'naban, dean of iteration','sea gate stormcaller','wizened cenn','niblis of frost',
        'mirran spy','jalira, master polymorphist','elite arcanist','jodah, the unifier'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'curiosity','azami\'s scroll','training grounds']
    },
    knight:{
      creatures:['aragorn, the uniter','syr gwyn, hero of ashvale','knight of the white orchid',
        'mirran crusader','student of warfare','knight exemplar','adriana, captain of the guard',
        'kytheon, hero of akros','silverblade paladin','sigarda\'s aid','syr konrad, the grim',
        'knights of the round table','first sphere gargantua','myrel, shield of argive',
        'mentor of the meek','swift response','knight of grace','knight of malice','danitha capashen, paragon',
        'history of benalia','beloved beggar'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'knight exemplar','metallic mimic','training grounds','haakon, stromgald scourge']
    },
    spirit:{
      creatures:['kykar, wind\'s fury','geist of saint traft','drogskol captain','spell queller',
        'rattlechains','supreme phantom','selfless spirit','mausoleum wanderer','spectral procession',
        'unesh, criosphinx sovereign','niblis of frost','noble templar','umezawa\'s jitte',
        'reborn hero','lingering souls','divine visitation','remorseful cleric','spectral steel'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'divine visitation','training grounds','spectral steel']
    },
    soldier:{
      creatures:['catapult master','field marshal','daru warchief','preeminent captain',
        'general kreat','captain of the watch','elite vanguard','aerial responder','elite inquisitor',
        'first response','myrel, shield of argive','adeline, resplendent cathar','recruitment officer',
        'darien, king of kjeldor','jhoira\'s familiar','ramos, dragon engine','iroas, god of victory',
        'duty-bound dead'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'history of benalia','field marshal','catapult master']
    },
    cat:{
      creatures:['arahbo, roar of the world','mirri, weatherlight duelist','kaheera, the orphanguard',
        'leonin warleader','adorned pouncer','regal caracal','wasitora, nekoru queen','feline sovereign',
        'jedit ojanen of efrava','pride sovereign','goldmeadow harrier','metallic mimic',
        'qasali pridemage','brimaz, king of oreskos','jukai naturalist','seasoned hallowblade',
        'jazal goldmane','king of the pride','tomik, distinguished advokist','leonin abunas',
        'felidar guardian'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'shamanic revelation','training grounds']
    },
    cleric:{
      creatures:['orah, skyclave hierophant','disciple of bolas','bishop of binding','priest of forgotten gods',
        'cleric of life\'s bond','high priest of penance','rotlung reanimator','dawnglade regent',
        'soul warden','blood scrivener','suture priest','sin prodder','soltari priest',
        'priest of titania','ranger of eos','grand abolisher','cleric class','beckon apparition',
        'kambal, consul of allocation','liesa, shroud of dusk'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms','obelisk of urd']
    },
    merfolk:{
      creatures:['kopala, warden of waves','lord of atlantis','master of the pearl trident','merfolk sovereign',
        'lord of the unreal','silvergill adept','tishana, voice of thunder','svyelun of sea and sky',
        'tatyova, benthic druid','merrow reejerey','merrow commerce','seafloor oracle','seahunter',
        'merfolk trickster','aether vial','urabrask the hidden','master of waves','harbinger of the tides',
        'cursecatcher','phantasmal image','distinguished conjurer'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'aether vial','training grounds']
    },
    faerie:{
      creatures:['oona, queen of the fae','alela, artful provocateur','spellstutter sprite','vendilion clique',
        'mistbind clique','scion of oona','glen elendra archmage','ravenloft adventurer',
        'pestermite','faerie miscreant','dreamstealer','bitterblossom','faerie conclave',
        'spellstutter sprite','faerie vandal','venser, the sojourner','faerie squadron'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'bitterblossom','spell pierce']
    },
    treefolk:{
      creatures:['doran, the siege tower','lord of extinction','treefolk harbinger','dauntless dourbark',
        'leaf-crowned visionary','timber protector','rhys the redeemed','rishkar, peema renegade',
        'great oak guardian','seedguide ash','sapling of colfenor','hythonia the cruel','bosk banneret',
        'kalonian hydra','golgari grave-troll','greenwarden of murasa'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'doubling season','vorinclex, voice of hunger']
    },
    beast:{
      creatures:['ruric thar, the unbowed','mayael the anima','wild pair','baloth woodcrasher',
        'spearbreaker behemoth','rampaging baloths','garruk, primal hunter','rampaging brontodon',
        'krosan tusker','silvos, rogue elemental','craterhoof behemoth','rampaging brontodon',
        'wakeroot elemental','urabrask\'s forge'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms',
        'beastmaster ascension','sylvan messenger']
    },
    sphinx:{
      creatures:['unesh, criosphinx sovereign','sphinx of the second sun','sphinx of foresight',
        'arcanis the omnipotent','consecrated sphinx','sphinx of the steel wind','medomai the ageless',
        'sphinx of magosi','isperia, supreme judge','isperia the inscrutable'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    demon:{
      creatures:['rakdos, lord of riots','razaketh, the foulblooded','griselbrand','demon of dark schemes',
        'archfiend of depravity','rune-scarred demon','demon of catastrophes','liliana\'s contract',
        'rakdos, the showstopper','rakdos pit dragon','shadowborn demon','overseer of the damned',
        'reaper from the abyss','master of cruelties'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    angel:{
      creatures:['lyra dawnbringer','akroma, vision of ixidor','linvala, keeper of silence','baneslayer angel',
        'sephara, sky\'s blade','herald of war','requiem angel','aurelia, the warleader','iona, shield of emeria',
        'kaalia of the vast','firja, judge of valor','righteous valkyrie','seraph sanctuary','platinum angel',
        'shalai, voice of plenty','firemane angel'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms','urza\'s ruinous blast']
    },
    pirate:{
      creatures:['admiral beckett brass','malcolm, keen-eyed navigator','vela the night-clad','breeches, brazen plunderer',
        'ramirez depietro','captain lannery storm','rankle, master of pranks','hostage taker',
        'admiral brass','dire fleet daredevil','admiral\'s order','glacial fortress','dockside extortionist'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    dinosaur:{
      creatures:['gishath, sun\'s avatar','etali, primal storm','pantlaza, sun-favored','ghalta, primal hunger',
        'forerunner of the empire','ranging raptors','regisaur alpha','marauding raptor','ripjaw raptor',
        'thrashing brontodon','colossal dreadmaw','reckless rage'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    eldrazi:{
      creatures:['emrakul, the aeons torn','ulamog, the ceaseless hunger','kozilek, butcher of truth',
        'emrakul, the promised end','ulamog, the infinite gyre','kozilek, the great distortion',
        'thought-knot seer','reality smasher','endbringer','it that betrays','artisan of kozilek'],
      payoffs:['eldrazi conscription','all is dust','from beyond','blight herder']
    },
    werewolf:{
      creatures:['tovolar, dire overlord','arlinn kord','tovolar\'s huntmaster','immerwolf','huntmaster of the fells',
        'mayor of avabruck','ulrich of the krallenhorde','daybreak ranger','reckless waif',
        'wolfir avenger','full moon\'s rise','village messenger'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','full moon\'s rise']
    },
    spider:{
      creatures:['shelob, child of ungoliant','arachnogenesis','ishkanah, grafwidow','spider spawning',
        'broodweaver','seshiro the anointed','silklash spider','obelisk spider','wasp\'s nest',
        'mediating dryad','spider tactics'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','arachnogenesis']
    },
    snake:{
      creatures:['hapatra, vizier of poisons','seshiro the anointed','sosuke, son of seshiro','sachi, daughter of seshiro',
        'lotus cobra','jolrael, mwonvuli recluse','marauding raptor','ophidian','prowling serpopard',
        'pharika, god of affliction'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    ninja:{
      creatures:['yuriko, the tiger\'s shadow','ink-eyes, servant of oni','silver-fur master','satoru umezawa',
        'kaito shizuki','higure, the still wind','prowling pangolin','triton shorestalker',
        'cunning evasion','dokuchi silencer','okiba reckoner raid','azra oddsmaker','baleful strix'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','rogues\' passage']
    },
    centaur:{
      creatures:['rhys the redeemed','centaur glade','centaur omenreader','heartwood storyteller'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    druid:{
      creatures:['elvish archdruid','priest of titania','marwyn, the nurturer','seton, krosan protector',
        'dwynen, gilt-leaf daen','lathril, blade of the elves','wirewood symbiote','heritage druid',
        'circle of dreams druid','allosaurus shepherd','seton, krosan protector','farhaven elf'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    shaman:{
      creatures:['krenko, mob boss','muxus, goblin grandee','silver-fur master','allosaurus shepherd',
        'pillage','wirewood symbiote','huntmaster of the fells','farhaven elf','thunderhawk'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    warrior:{
      creatures:['najeela, the blade-blossom','arvad the cursed','reyhan, last of the abzan',
        'shaman of the great hunt','mardu woe-reaper','seasoned hallowblade','goblin warchief',
        'rakka mar','iroas, god of victory','grand warlord radha','najeela\'s sentry'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    berserker:{
      creatures:['urabrask\'s forge','berserkers\' onslaught','warbringer','barbarian shaman','urabrask, the great juggernaut'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    bird:{
      creatures:['inniaz, the gale force','derevi, empyrial tactician','soulcatcher','sephara, sky\'s blade',
        'storm crow','sungold sentinel','elgaud shieldmate','shorikai, genesis engine'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    ogre:{
      creatures:['rakdos, lord of riots','ogre arsonist','grenzo, dungeon warden','rakdos pit dragon',
        'mogis, god of slaughter','rakdos, the showstopper'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    insect:{
      creatures:['hapatra, vizier of poisons','grist, the hunger tide','death-mask duplicant',
        'jolrael, mwonvuli recluse','vile aggregate','arcades, the strategist','noble templar'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    plant:{
      creatures:['shanna, sisay\'s legacy','greenwarden of murasa','life-bond','sapling of colfenor',
        'lord of extinction','rampaging baloths','dryad of the ilysian grove'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    elemental:{
      creatures:['horde of notions','omnath, locus of all','omnath, locus of creation','rakka mar',
        'flickerwisp','soulscour','crackleburr','silvos, rogue elemental','soulscour',
        'embodiment of insight','akoum hellhound','risen reef'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies']
    },
    human:{
      creatures:['general kreat','captain of the watch','catapult master','field marshal','elite vanguard',
        'esper sentinel','prosper, tome-bound','aragorn, the uniter','elite arcanist',
        'thalia, guardian of thraben','grand abolisher','grand inquisitor','ranger of eos'],
      payoffs:['urza\'s incubator','vanquisher\'s banner','door of destinies','coat of arms']
    }
  };

  // ─── DÉTECTION TRIBALE (build 97) ──────────────────────────────────────
  // Identifie le sub-type tribal dominant (Rogue, Goblin, Elf, etc.) si ≥12
  // cartes le partagent. Sert à protéger les créatures du tribe contre les
  // suggestions de swap qui briseraient l'identité du deck.
  function _detectDominantTribe(rows){
    var tribeCount={};
    rows.forEach(function(r){
      var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
      // Extract sub-types après le tiret cadratin
      var subMatch=tl.match(/—\s*(.+?)(?:\s*\/|$)/);
      if(!subMatch)return;
      var subs=subMatch[1].split(/\s+/);
      subs.forEach(function(s){
        s=s.trim();
        if(s.length<3)return;
        // Filtre les types non-tribaux (legendary, snow, etc.)
        if(/^(token|legendary|snow|basic|tribal)$/.test(s))return;
        tribeCount[s]=(tribeCount[s]||0)+(r.qty||1);
      });
    });
    var sorted=Object.keys(tribeCount).sort(function(a,b){return tribeCount[b]-tribeCount[a];});
    var top=sorted[0];
    if(top&&tribeCount[top]>=12)return {tribe:top,count:tribeCount[top]};
    return null;
  }
  // Vérifie si une carte appartient au tribe dominant
  function _isInTribe(meta,tribe){
    if(!tribe||!meta||!meta.typeLine)return false;
    var tl=meta.typeLine.toLowerCase();
    var t=tribe.toLowerCase();
    // Match comme sub-type (après tiret cadratin)
    var subMatch=tl.match(/—\s*(.+?)(?:\s*\/|$)/);
    if(subMatch&&subMatch[1].toLowerCase().indexOf(t)>=0)return true;
    return false;
  }
  // ─── 33e. SUGGESTIONS TRIBALES (build 98) ──────────────────────────────
  // Pour chaque tribe dominant détecté, propose les cartes du TRIBAL_CATALOG
  // absentes du deck. Séparé en `missingCreatures` et `missingPayoffs`.
  function suggestTribalCards(rows,deck){
    var dominantTribe=_detectDominantTribe(rows);
    if(!dominantTribe)return null;
    var tribeKey=dominantTribe.tribe.toLowerCase();
    var catalog=TRIBAL_CATALOG[tribeKey];
    if(!catalog)return {tribe:dominantTribe.tribe,count:dominantTribe.count,catalog:false,
      verdict:'Tribe « '+dominantTribe.tribe+' » détecté mais pas dans notre catalogue. Couverture future.'};
    var inDeck={};rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);if(nl)inDeck[nl]=true;
    });
    // Build 99 : indexe les staples du catalogue pour lookup rapide
    var catalogSet={};
    (catalog.creatures||[]).forEach(function(c){catalogSet[_nlOf(c)]='staple';});
    var missingCreatures=(catalog.creatures||[]).filter(function(c){return !inDeck[_nlOf(c)];});
    var missingPayoffs=(catalog.payoffs||[]).filter(function(c){return !inDeck[_nlOf(c)];});
    // ─── Distinction staples vs faibles tribaux dans le deck ────────────
    // Une créature tribale est :
    // - « STAPLE » si elle apparaît dans TRIBAL_CATALOG.creatures
    // - « WEAK » sinon (dans le tribe mais pas dans notre catalogue de top)
    // Les WEAK sont des candidates à l'upgrade vers les staples manquants.
    var tribalStaplesInDeck=[];
    var weakTribalInDeck=[];
    rows.forEach(function(r){
      var meta=r.meta||{};var tl=(meta.typeLine||'').toLowerCase();
      if(!/creature/.test(tl))return;
      if(!_isInTribe(meta,dominantTribe.tribe))return;
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var name=r.card&&r.card.name||r.name;
      var cmc=meta.cmc||0;
      var entry={name:name,nl:nl,cmc:cmc,edhrecRank:meta.edhrecRank||0};
      if(catalogSet[nl])tribalStaplesInDeck.push(entry);
      else weakTribalInDeck.push(entry);
    });
    // Trie les faibles par CMC élevé d'abord (= les plus problématiques)
    // puis par EDHREC rank haut (= moins populaires sur ce commandant)
    weakTribalInDeck.sort(function(a,b){
      if(b.cmc!==a.cmc)return b.cmc-a.cmc;
      return (b.edhrecRank||9999)-(a.edhrecRank||9999);
    });
    return {
      tribe:dominantTribe.tribe,
      count:dominantTribe.count,
      catalog:true,
      missingCreatures:missingCreatures.slice(0,12),
      missingPayoffs:missingPayoffs.slice(0,8),
      tribalStaplesInDeck:tribalStaplesInDeck.slice(0,15),
      weakTribalInDeck:weakTribalInDeck.slice(0,10),
      verdict:(missingCreatures.length+missingPayoffs.length)+' carte(s) tribales « '+dominantTribe.tribe+' » absente(s) du deck'
    };
  }
  function suggestSwaps(rows,deck){
    if(!deck)return {byRole:{}};
    // Build 99 : détection tribale + protection FINE (staples du catalogue uniquement)
    var dominantTribe=_detectDominantTribe(rows);
    var tribeKey=dominantTribe?dominantTribe.tribe.toLowerCase():null;
    var tribalCatalog=tribeKey?TRIBAL_CATALOG[tribeKey]:null;
    var tribalStaplesSet={};
    if(tribalCatalog&&tribalCatalog.creatures){
      tribalCatalog.creatures.forEach(function(c){tribalStaplesSet[_nlOf(c)]=true;});
    }
    // Identifie pour chaque rôle :
    // 1. Les cartes du deck classées par tier (du plus faible au plus fort)
    // 2. Les suggestions S/A non-présentes
    var inDeck={};rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);if(nl)inDeck[nl]=true;
    });
    var byRole={};
    Object.keys(CARD_TIERS).forEach(function(role){
      var deckCards=[];
      var tribeProtected=0;
      rows.forEach(function(r){
        var nl=_nlOf(r.card&&r.card.name||r.name);
        var detRole=_detectCardRole(r.meta);
        // On compte la carte si son rôle détecté match OU si elle est dans le tier
        if(detRole===role||CARD_TIERS[role][nl]){
          // Build 99 : protection FINE — seuls les staples tribaux reconnus sont
          // protégés du swap (ex. Soaring Thought-Thief). Les créatures du tribe
          // hors-catalogue (ex. Vectis Agents) restent éligibles.
          var isTribal=dominantTribe&&_isInTribe(r.meta,dominantTribe.tribe);
          var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
          var isCreature=/creature/.test(tl);
          var isStaple=isTribal&&isCreature&&tribalStaplesSet[nl];
          if(isStaple){tribeProtected++;return;}
          deckCards.push({name:r.card&&r.card.name||r.name,nl:nl,power:_powerOfCard(nl,role,r.meta),qty:r.qty||1,isWeakTribe:isTribal&&isCreature&&!isStaple});
        }
      });
      deckCards.sort(function(a,b){return a.power-b.power;});
      var weak=deckCards.filter(function(c){return c.power<=TIER_C;});
      // Suggestions : cartes Tier S ou A du dictionnaire pas dans le deck
      var suggestions=[];
      Object.keys(CARD_TIERS[role]).forEach(function(nl){
        if(inDeck[nl])return;
        if(CARD_TIERS[role][nl]>=TIER_A){
          suggestions.push({name:nl.replace(/\b./g,function(c){return c.toUpperCase();}),nl:nl,power:CARD_TIERS[role][nl]});
        }
      });
      suggestions.sort(function(a,b){return b.power-a.power;});
      byRole[role]={
        count:deckCards.length,
        weak:weak.slice(0,5),
        suggest:suggestions.slice(0,6),
        topInDeck:deckCards.slice(-3).reverse(),
        tribeProtected:tribeProtected
      };
    });
    return {byRole:byRole,dominantTribe:dominantTribe};
  }

  // ─── 10. MANA EFFICIENCY (build 91) ────────────────────────────────────
  // Calcule, pour chaque carte rangée par rôle, son IMPACT SCORE :
  //   impact = (powerTier * unitValue) / max(1, cmc)
  // Permet de dire « ton Manalith (cmc=3, impact=33) coûte 1 mana de
  // trop par rapport à Arcane Signet (cmc=2, impact=50) — switche ».
  //
  // Détecte aussi les cartes « overcost » du deck (impact très bas) et
  // propose des alternatives staples au CMC inférieur du même rôle.
  function _impactScore(power,cmc){
    if(cmc==null||cmc<0)cmc=0;
    // Évite la division par zéro : Mana Crypt / Mox a un impact infini sinon
    if(cmc===0)return power*1.5; // bonus 0-CMC
    return Math.round((power/cmc)*10)/1;
  }
  function manaEfficiency(rows,deck){
    if(!Array.isArray(rows))return {byRole:{}};
    // Build 99 : protection tribale FINE — seuls les staples du catalogue
    // sont protégés. Les créatures du tribe NON-staples (ex. Vectis Agents
    // dans un deck Rogue) restent éligibles au swap, mais leur swap sera
    // suggéré vers un autre Rogue (handled by suggestTribalCards section).
    var dominantTribe=_detectDominantTribe(rows);
    var tribeKey=dominantTribe?dominantTribe.tribe.toLowerCase():null;
    var tribalCatalog=tribeKey?TRIBAL_CATALOG[tribeKey]:null;
    var tribalStaplesSet={};
    if(tribalCatalog&&tribalCatalog.creatures){
      tribalCatalog.creatures.forEach(function(c){tribalStaplesSet[_nlOf(c)]=true;});
    }
    var tribeProtectedCount=0;
    // Indice par rôle des cartes du deck
    var byRole={};
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var role=_detectCardRole(r.meta);
      if(!role)return;
      // Protection FINE : seules les créatures tribales reconnues comme staples
      // dans TRIBAL_CATALOG sont protégées. Les autres restent éligibles —
      // leur faible impact sera signalé.
      var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
      var isCreature=/creature/.test(tl);
      var isInTribe=dominantTribe&&isCreature&&_isInTribe(r.meta,dominantTribe.tribe);
      var isStaple=isInTribe&&tribalStaplesSet[nl];
      if(isStaple){
        tribeProtectedCount++;
        return; // protection forte
      }
      var cmc=(r.meta&&typeof r.meta.cmc==='number')?r.meta.cmc:null;
      // Power = tier connu, sinon base
      var power=_powerOfCard(nl,role,r.meta);
      var impact=cmc!=null?_impactScore(power,cmc):power;
      byRole[role]=byRole[role]||{cards:[]};
      byRole[role].cards.push({name:r.card&&r.card.name||r.name,nl:nl,cmc:cmc,power:power,impact:impact,isWeakTribe:isInTribe&&!isStaple});
    });
    // Pour chaque rôle, classe par impact (low → high), repère les overcost
    Object.keys(byRole).forEach(function(role){
      var bench=ROLE_BENCHMARKS[role];
      var goodCmc=bench?bench.goodCmc:2;
      byRole[role].cards.sort(function(a,b){return a.impact-b.impact;});
      byRole[role].overcost=byRole[role].cards.filter(function(c){
        return c.cmc!=null && c.cmc>goodCmc && c.power<=TIER_C;
      }).slice(0,5);
      byRole[role].topImpact=byRole[role].cards.slice().sort(function(a,b){return b.impact-a.impact;}).slice(0,3);
      byRole[role].avgImpact=byRole[role].cards.length?Math.round(byRole[role].cards.reduce(function(s,c){return s+c.impact;},0)/byRole[role].cards.length):0;
      byRole[role].goodCmc=goodCmc;
      byRole[role].bench=bench;
      // Trouve, pour chaque overcost, le meilleur staple alternatif (CMC ≤ overcost.cmc)
      byRole[role].overcost.forEach(function(c){
        var bestAlt=null,bestAltImpact=-1;
        Object.keys(CARD_TIERS[role]||{}).forEach(function(nl){
          if(nl===c.nl)return;
          var altPower=CARD_TIERS[role][nl];
          var altCmc=STAPLE_CMC[nl];
          if(altCmc==null)return;
          if(altCmc>=c.cmc)return; // cherche moins cher
          var altImpact=_impactScore(altPower,altCmc);
          if(altImpact>bestAltImpact){bestAltImpact=altImpact;bestAlt={name:nl,cmc:altCmc,power:altPower,impact:altImpact};}
        });
        if(bestAlt)c.suggestedSwap=bestAlt;
      });
    });
    return {byRole:byRole,dominantTribe:dominantTribe,tribeProtectedCount:tribeProtectedCount};
  }

  // ─── 11. REDONDANCE WINCONS (build 92) ─────────────────────────────────
  // Un deck pro a plusieurs plans : si le Plan A est démantelé (counter,
  // exile du wincon), un Plan B doit prendre le relais. Compte les plans
  // « viables » (score ≥ 35) — détecte les decks mono-plan fragiles.
  function winconRedundancy(winConsReport){
    var plans=winConsReport&&winConsReport.plans||[];
    var viable=plans.filter(function(p){return p.score>=35;});
    var redundancy={count:viable.length,plans:viable.map(function(p){return p.kind;})};
    if(viable.length===0){
      redundancy.sev='high';redundancy.label='Mono-plan / sans plan';
      redundancy.msg='Aucun plan de victoire viable. Le deck est vulnérable à n\'importe quelle perturbation.';
    }else if(viable.length===1){
      redundancy.sev='high';redundancy.label='Mono-plan';
      redundancy.msg='Un seul plan de victoire détecté ('+viable[0].label+'). Si on l\'enraye, tu n\'as pas de plan B.';
    }else if(viable.length===2){
      redundancy.sev='med';redundancy.label='Bi-plan';
      redundancy.msg='Deux plans détectés ('+viable.map(function(p){return p.label;}).join(' + ')+'). Bonne base, mais un 3e plan donnerait de la résilience.';
    }else{
      redundancy.sev='good';redundancy.label='Multi-plan';
      redundancy.msg=viable.length+' plans détectés — deck résilient face aux contre-mesures.';
    }
    return redundancy;
  }

  // ─── 12. MULLIGAN PROBABILITY (build 92) ───────────────────────────────
  // Simule 10 000 mains de départ et calcule le % de mains keepables selon
  // critères classiques : 2-5 lands + au moins 1 jouable T1-T3.
  // Déterministe (PRNG seedé) pour reproductibilité.
  function _seededShuffle(arr,seed){
    var a=arr.slice();
    // Mulberry32 PRNG
    var s=seed>>>0;
    function rnd(){s|=0;s=s+0x6D2B79F5|0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
    for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1));var tmp=a[i];a[i]=a[j];a[j]=tmp;}
    return a;
  }
  function mulliganProbability(rows,deck){
    // Construit la pioche
    var library=[];
    rows.forEach(function(r){
      var qty=r.qty||1;
      var m=r.meta||{};
      var tl=(m.typeLine||'').toLowerCase();
      var ot=(m.oracleText||'').toLowerCase();
      var cmc=typeof m.cmc==='number'?m.cmc:0;
      var role=_detectCardRole(m);
      var isLand=/land/.test(tl);
      var isRamp=role==='ramp'&&cmc<=2;
      var isEarlyAction=(/creature|instant|sorcery/.test(tl))&&cmc<=3;
      for(var i=0;i<qty;i++){
        library.push({isLand:isLand,isRamp:isRamp,isEarlyAction:isEarlyAction,cmc:cmc});
      }
    });
    if(library.length<7)return {checked:false};
    var keepableCount=0,handsTested=10000;
    var avgLands=0,avgRamp=0,avgAction=0,manaFloodCount=0,manaScrewCount=0;
    for(var sim=0;sim<handsTested;sim++){
      var shuf=_seededShuffle(library,sim+1);
      var hand=shuf.slice(0,7);
      var lands=0,ramp=0,action=0;
      hand.forEach(function(c){
        if(c.isLand)lands++;
        if(c.isRamp)ramp++;
        if(c.isEarlyAction)action++;
      });
      avgLands+=lands;avgRamp+=ramp;avgAction+=action;
      if(lands<=1)manaScrewCount++;
      if(lands>=6)manaFloodCount++;
      var keepable=(lands>=2&&lands<=5)&&(ramp>=1||action>=1);
      if(keepable)keepableCount++;
    }
    return {
      checked:true,
      keepablePct:Math.round(keepableCount/handsTested*100),
      avgLands:(avgLands/handsTested).toFixed(2),
      avgRamp:(avgRamp/handsTested).toFixed(2),
      avgAction:(avgAction/handsTested).toFixed(2),
      manaScrewPct:Math.round(manaScrewCount/handsTested*100),
      manaFloodPct:Math.round(manaFloodCount/handsTested*100),
      verdict:keepableCount/handsTested>=0.85?'✓ Mains d\'ouverture solides':keepableCount/handsTested>=0.70?'~ Mulligan occasionnel':'⚠ Mulligan fréquent — courbe à revoir'
    };
  }

  // ─── 13. THREAT DENSITY PAR TOUR (build 92) ────────────────────────────
  // Pour chaque tour 1-7, liste les cartes jouables (cmc ≤ tour) classées
  // en threat / engine / setup. Identifie les tours « vides » (rien à faire).
  function threatDensityByTurn(rows){
    var buckets={1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    var counts={1:{threat:0,engine:0,setup:0},2:{threat:0,engine:0,setup:0},
                3:{threat:0,engine:0,setup:0},4:{threat:0,engine:0,setup:0},
                5:{threat:0,engine:0,setup:0},6:{threat:0,engine:0,setup:0},
                7:{threat:0,engine:0,setup:0}};
    rows.forEach(function(r){
      var m=r.meta||{};
      var tl=(m.typeLine||'').toLowerCase();
      var ot=(m.oracleText||'').toLowerCase();
      var cmc=typeof m.cmc==='number'?m.cmc:0;
      if(/land/.test(tl))return; // lands gérés ailleurs
      var qty=r.qty||1;
      var kind='setup';
      // Threat = creature 2+ power OR planeswalker OR direct damage OR finisher
      if(/creature/.test(tl)){
        var p=parseInt(m.power||'0',10)||0;
        if(p>=2||cmc>=4)kind='threat';
      }
      if(/planeswalker/.test(tl))kind='threat';
      if(/deals? \d+ damage to (any target|target player|target opponent)/.test(ot))kind='threat';
      // Engine = repeated value : "whenever you draw", "at the beginning of", "each upkeep"
      if(/whenever you draw|at the beginning of (each|your) (upkeep|end step|draw step)|at the beginning of (each|your) main phase|each turn/.test(ot))kind='engine';
      if(/draw (a|two) cards?/.test(ot)&&!/discard/.test(ot))kind='engine';
      // Setup par défaut (ramp / removal / tutor / interaction)
      // Bucket le tour minimum où la carte peut être jouée
      var turn=Math.max(1,Math.min(7,cmc||1));
      for(var t=turn;t<=7;t++){
        // Ne compte chaque carte qu'une fois par tour (à son tour minimum)
        if(t===turn){buckets[t].push({name:r.card&&r.card.name||r.name,kind:kind,cmc:cmc,qty:qty});}
      }
      counts[turn][kind]+=qty;
    });
    // Identifie les tours « secs » (< 3 cartes totales jouables ce tour)
    var dryTurns=[];
    [1,2,3,4,5,6,7].forEach(function(t){
      var total=counts[t].threat+counts[t].engine+counts[t].setup;
      if(total<3)dryTurns.push(t);
    });
    return {counts:counts,buckets:buckets,dryTurns:dryTurns,verdict:dryTurns.length===0?'✓ Couverture continue T1→T7':dryTurns.length<=2?'~ '+dryTurns.length+' tour(s) faible(s) (T'+dryTurns.join(', T')+')':'⚠ '+dryTurns.length+' tours vides — courbe trouée'};
  }

  // ─── 14. LISSAGE DE COURBE (build 92) ──────────────────────────────────
  // Compare la distribution CMC actuelle à la courbe idéale par archétype.
  // Identifie gaps (pas assez de 2-drops) et humps (trop de 4-drops).
  var IDEAL_CURVE = {
    // Archétype : {cmc: targetCount sur ~60 non-lands en EDH}
    'aggro':       {0:0,1:8,2:14,3:12,4:8,5:5,6:3,7:0},
    'midrange':    {0:0,1:5,2:10,3:12,4:10,5:7,6:5,7:3},
    'control':     {0:0,1:4,2:10,3:9,4:8,5:8,6:6,7:5},
    'combo':       {0:0,1:6,2:12,3:10,4:8,5:6,6:4,7:2},
    'ramp':        {0:0,1:4,2:8,3:8,4:8,5:7,6:7,7:5},
    'voltron':     {0:0,1:6,2:10,3:10,4:8,5:6,6:4,7:2},
    'default':     {0:0,1:5,2:11,3:11,4:9,5:6,6:5,7:3}
  };
  function curveSmoothness(rows,deck,winConsReport){
    var actual={0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0};
    rows.forEach(function(r){
      var m=r.meta||{};
      var tl=(m.typeLine||'').toLowerCase();
      if(/land/.test(tl))return;
      var cmc=typeof m.cmc==='number'?Math.min(7,Math.max(0,Math.floor(m.cmc))):0;
      actual[cmc]=(actual[cmc]||0)+(r.qty||1);
    });
    // Archétype : à partir du plan primaire
    var arch='default';
    if(winConsReport&&winConsReport.primary){
      var pk=winConsReport.primary.kind;
      if(pk==='combat')arch='aggro';
      else if(pk==='voltron')arch='voltron';
      else if(pk==='control')arch='control';
      else if(pk==='alt-win'||pk==='combo')arch='combo';
      else if(pk==='tokens'||pk==='drain')arch='midrange';
      else if(pk==='mill')arch='control';
    }
    var ideal=IDEAL_CURVE[arch]||IDEAL_CURVE['default'];
    var gaps=[],humps=[];
    Object.keys(ideal).forEach(function(k){
      var c=parseInt(k,10);
      var diff=actual[c]-ideal[k];
      if(diff<=-3)gaps.push({cmc:c,have:actual[c],want:ideal[k]});
      else if(diff>=4)humps.push({cmc:c,have:actual[c],want:ideal[k]});
    });
    return {actual:actual,ideal:ideal,archetype:arch,gaps:gaps,humps:humps,
      verdict:gaps.length===0&&humps.length<=1?'✓ Courbe équilibrée pour ce plan':'⚠ '+(gaps.length+humps.length)+' anomalie(s) vs idéal '+arch};
  }

  // ─── 15. REMOVAL COVERAGE MATRIX (build 92) ────────────────────────────
  // Évalue ce que tes removals peuvent toucher : creature / artifact /
  // enchant / planeswalker / land / graveyard. Détecte angles morts.
  function removalCoverage(rows){
    var coverage={
      creature:{count:0,cards:[]},
      artifact:{count:0,cards:[]},
      enchantment:{count:0,cards:[]},
      planeswalker:{count:0,cards:[]},
      land:{count:0,cards:[]},
      graveyard:{count:0,cards:[]},
      counter:{count:0,cards:[]},
      bounce:{count:0,cards:[]}
    };
    rows.forEach(function(r){
      var m=r.meta||{};
      var ot=(m.oracleText||'').toLowerCase();
      var name=r.card&&r.card.name||r.name;
      // Removal cible créature
      if(/destroy target creature|exile target creature|target creature.*-x\/-x|return target creature/.test(ot)){
        coverage.creature.count++;coverage.creature.cards.push(name);
      }
      // Artifact
      if(/destroy target artifact|exile target artifact|destroy target (artifact|enchantment)/.test(ot)){
        coverage.artifact.count++;coverage.artifact.cards.push(name);
      }
      // Enchantment
      if(/destroy target enchantment|exile target enchantment|destroy target (artifact|enchantment)|destroy target nonland permanent/.test(ot)){
        coverage.enchantment.count++;coverage.enchantment.cards.push(name);
      }
      // Planeswalker
      if(/destroy target planeswalker|exile target planeswalker|destroy target nonland permanent|deals \d+ damage to any target/.test(ot)){
        coverage.planeswalker.count++;coverage.planeswalker.cards.push(name);
      }
      // Land destruction
      if(/destroy target land|exile target land|destroy all lands|target land.* doesn't untap/.test(ot)){
        coverage.land.count++;coverage.land.cards.push(name);
      }
      // Graveyard hate
      if(/exile target.*graveyard|exile.*graveyards|all cards in.*graveyard.*exile|each player.*graveyard.*exile/.test(ot)){
        coverage.graveyard.count++;coverage.graveyard.cards.push(name);
      }
      // Counter
      if(/counter target spell|counter target (creature|noncreature)/.test(ot)){
        coverage.counter.count++;coverage.counter.cards.push(name);
      }
      // Bounce (return to hand)
      if(/return target.* to (its owner's|owner's) hand|return target nonland permanent/.test(ot)){
        coverage.bounce.count++;coverage.bounce.cards.push(name);
      }
    });
    var blindSpots=[];
    Object.keys(coverage).forEach(function(k){
      var min={creature:5,artifact:2,enchantment:2,planeswalker:2,land:0,graveyard:1,counter:0,bounce:0}[k]||0;
      if(coverage[k].count<min)blindSpots.push({type:k,have:coverage[k].count,need:min});
    });
    return {
      coverage:coverage,
      blindSpots:blindSpots,
      verdict:blindSpots.length===0?'✓ Pas d\'angle mort détecté':blindSpots.length+' angle(s) mort(s) — couverture incomplète'
    };
  }

  // ─── 16. COACH MODE — TOP 5 FIXES PRIORISÉS (build 92) ─────────────────
  // Synthèse actionnable : sur la base de toutes les analyses, sort les 5
  // changements les plus prioritaires. Évite la surcharge cognitive du rapport
  // complet et donne une vraie roadmap d'optimisation.
  function coachTopFixes(report){
    var fixes=[];
    // Priorité 1 : légalité (cartes bannies = critique)
    if(report.legality&&report.legality.issues.length){
      report.legality.issues.filter(function(i){return i.sev==='high';}).slice(0,3).forEach(function(i){
        fixes.push({sev:'critical',category:'Légalité',title:'Retirer '+i.card,reason:i.msg,impact:50});
      });
    }
    // Priorité 2 : mono-plan
    if(report.winCons&&report.winCons.plans.length===0){
      fixes.push({sev:'critical',category:'Plan A',title:'Définir un plan de victoire',reason:'Aucun plan ne dépasse le seuil — le deck n\'a pas d\'objectif clair',impact:60});
    }else if(report.winCons&&report.winCons.plans.filter(function(p){return p.score>=35;}).length===1){
      fixes.push({sev:'high',category:'Redondance',title:'Ajouter un Plan B',reason:'Un seul plan viable — si le main plan est démantelé, plus de win',impact:35});
    }
    // Priorité 3 : manabase déséquilibrée
    if(report.manabase&&report.manabase.deficits.length){
      var worst=report.manabase.deficits.slice().sort(function(a,b){return b.deficit-a.deficit;})[0];
      if(worst&&worst.deficit>=3){
        fixes.push({sev:'high',category:'Manabase',title:'Ajouter '+worst.deficit+' sources '+worst.color,
          reason:'Manque '+worst.deficit+' sources de '+worst.color+' selon Karsten (cible '+worst.need+')',impact:40});
      }
    }
    // Priorité 4 : anti-synergies high severity
    if(report.antiSynergies&&report.antiSynergies.issues.length){
      report.antiSynergies.issues.filter(function(i){return i.sev==='high';}).slice(0,2).forEach(function(i){
        fixes.push({sev:'high',category:'Synergie',title:i.msg.split('→')[0].trim(),reason:i.msg,impact:30});
      });
    }
    // Priorité 5 : robustesse faible
    if(report.robustness&&report.robustness.score<45){
      var worstAxis=null,worstScore=100;
      ['wrathRecovery','comboInteraction','staxBreaker'].forEach(function(k){
        if(report.robustness[k]&&report.robustness[k].score<worstScore){worstScore=report.robustness[k].score;worstAxis=k;}
      });
      var axisLbl={wrathRecovery:'recovery wrath (récursion + threats cheap)',comboInteraction:'interaction instant-speed (counters + flash removal)',staxBreaker:'casseurs de stax (mass removal + protection)'};
      fixes.push({sev:'med',category:'Robustesse',title:'Renforcer '+(axisLbl[worstAxis]||worstAxis),reason:'Score '+worstScore+'/100 — deck fragile sur cet axe',impact:25});
    }
    // Priorité 6 : angles morts removal
    if(report.removalCoverage&&report.removalCoverage.blindSpots.length){
      report.removalCoverage.blindSpots.slice(0,2).forEach(function(b){
        var lbl={creature:'créatures',artifact:'artefacts',enchantment:'enchantements',planeswalker:'planeswalkers',graveyard:'cimetière (hate)'}[b.type]||b.type;
        fixes.push({sev:'med',category:'Removal',title:'Ajouter du removal anti-'+lbl,reason:'Seulement '+b.have+' carte(s) pour gérer cette catégorie (cible '+b.need+')',impact:22});
      });
    }
    // Priorité 7 : meilleurs swaps efficiency
    if(report.efficiency&&report.efficiency.byRole){
      Object.keys(report.efficiency.byRole).forEach(function(role){
        var data=report.efficiency.byRole[role];
        if(data.overcost&&data.overcost.length){
          var topSwap=data.overcost.filter(function(c){return c.suggestedSwap;}).slice(0,1)[0];
          if(topSwap){
            var gain=topSwap.suggestedSwap.impact-topSwap.impact;
            fixes.push({sev:'low',category:'Efficience',
              title:topSwap.name+' → '+topSwap.suggestedSwap.name.replace(/\b./g,function(c){return c.toUpperCase();}),
              reason:'Gain impact +'+gain.toFixed(0)+' · cmc '+topSwap.cmc+' → '+topSwap.suggestedSwap.cmc,impact:Math.max(10,gain/2)});
          }
        }
      });
    }
    // Trie par sévérité puis impact, garde top 5
    var sevOrder={critical:0,high:1,med:2,low:3};
    fixes.sort(function(a,b){
      var s=sevOrder[a.sev]-sevOrder[b.sev];if(s!==0)return s;
      return b.impact-a.impact;
    });
    return fixes.slice(0,5);
  }

  // ─── 17. UPGRADES DE TERRAINS (build 93) ───────────────────────────────
  // Recommande de remplacer X basics par des bilands/tribands selon :
  // - Couleurs requises par le deck (depuis pip counts)
  // - Budget de « ETB tapped » : pas plus de 30 % de la manabase
  // - Pertinence du type de biland (cycling, pain, check, shock, fetch)
  // Évite de sur-recommander (équilibre nb basics restants vs fixers).
  //
  // Catalogue de bilands rangés par PAIRE de couleurs (10 paires). Chaque
  // biland a un type (shock/fetch/pain/check/ETBuntapped/cycling/manlands)
  // et une « qualité » 0-100 (S=85+/A=70-84/B=55-69/C=<55).
  var BILAND_CATALOG = {
    // Format : 'WU' : [ {name, type, quality, etbTapped} ]
    'WU':[
      {name:'Hallowed Fountain',type:'shock',quality:95,etbTapped:false,note:'2 vie pour ETB untapped'},
      {name:'Tundra',type:'dual',quality:100,etbTapped:false,note:'dual original (cher)'},
      {name:'Flooded Strand',type:'fetch',quality:95,etbTapped:false,note:'fetch Onslaught/Khans'},
      {name:'Adarkar Wastes',type:'pain',quality:75,etbTapped:false,note:'1 dégât quand utilisée colorée'},
      {name:'Glacial Fortress',type:'check',quality:78,etbTapped:'cond',note:'untapped si Plains/Island'},
      {name:'Mystic Gate',type:'filter',quality:80,etbTapped:false,note:'Shadowmoor filter'},
      {name:'Seachrome Coast',type:'fast',quality:80,etbTapped:'cond',note:'untapped sur 2 premiers tours'},
      {name:'Hengegate Pathway',type:'pathway',quality:78,etbTapped:false,note:'au choix Plains OU Island'},
      {name:'Port Town',type:'reveal',quality:65,etbTapped:'cond',note:'reveal Plains/Island'},
      {name:'Tranquil Cove',type:'lifeland',quality:55,etbTapped:true,note:'ETB tapped + 1 vie'},
      {name:'Azorius Chancery',type:'bounce',quality:55,etbTapped:true,note:'ETB tapped + bounce'}
    ],
    'UB':[
      {name:'Watery Grave',type:'shock',quality:95,etbTapped:false,note:'2 vie pour ETB untapped'},
      {name:'Underground Sea',type:'dual',quality:100,etbTapped:false,note:'dual original (cher)'},
      {name:'Polluted Delta',type:'fetch',quality:95,etbTapped:false,note:'fetch Onslaught/Khans'},
      {name:'Underground River',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Drowned Catacomb',type:'check',quality:78,etbTapped:'cond',note:'untapped si Island/Swamp'},
      {name:'Sunken Ruins',type:'filter',quality:80,etbTapped:false,note:'Shadowmoor filter'},
      {name:'Darkslick Shores',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Clearwater Pathway',type:'pathway',quality:78,etbTapped:false,note:'au choix Island OU Swamp'},
      {name:'River of Tears',type:'special',quality:72,etbTapped:false,note:'situational'},
      {name:'Choked Estuary',type:'reveal',quality:65,etbTapped:'cond',note:'reveal Island/Swamp'},
      {name:'Dimir Aqueduct',type:'bounce',quality:55,etbTapped:true,note:'ETB tapped + bounce'}
    ],
    'BR':[
      {name:'Blood Crypt',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Badlands',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Bloodstained Mire',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Sulfurous Springs',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Dragonskull Summit',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Graven Cairns',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Blackcleave Cliffs',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Blightstep Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Foreboding Ruins',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Akoum Refuge',type:'lifeland',quality:55,etbTapped:true,note:'ETB tapped + 1 vie'},
      {name:'Rakdos Carnarium',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'RG':[
      {name:'Stomping Ground',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Taiga',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Wooded Foothills',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Karplusan Forest',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Rootbound Crag',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Fire-Lit Thicket',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Copperline Gorge',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Cragcrown Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Game Trail',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Gruul Turf',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'GW':[
      {name:'Temple Garden',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Savannah',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Windswept Heath',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Brushland',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Sunpetal Grove',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Wooded Bastion',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Razorverge Thicket',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Branchloft Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Fortified Village',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Selesnya Sanctuary',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'WB':[
      {name:'Godless Shrine',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Scrubland',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Marsh Flats',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Caves of Koilos',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Isolated Chapel',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Fetid Heath',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Concealed Courtyard',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Brightclimb Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Shineshadow Snarl',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Orzhov Basilica',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'UR':[
      {name:'Steam Vents',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Volcanic Island',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Scalding Tarn',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Shivan Reef',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Sulfur Falls',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Cascade Bluffs',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Spirebluff Canal',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Riverglide Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Frostboil Snarl',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Izzet Boilerworks',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'BG':[
      {name:'Overgrown Tomb',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Bayou',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Verdant Catacombs',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Llanowar Wastes',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Woodland Cemetery',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Twilight Mire',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Blooming Marsh',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Darkbore Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Necroblossom Snarl',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Golgari Rot Farm',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'RW':[
      {name:'Sacred Foundry',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Plateau',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Arid Mesa',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Battlefield Forge',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Clifftop Retreat',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Rugged Prairie',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Inspiring Vantage',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Needleverge Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Furycalm Snarl',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Boros Garrison',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ],
    'UG':[
      {name:'Breeding Pool',type:'shock',quality:95,etbTapped:false,note:'2 vie'},
      {name:'Tropical Island',type:'dual',quality:100,etbTapped:false,note:'dual original'},
      {name:'Misty Rainforest',type:'fetch',quality:95,etbTapped:false,note:'fetch'},
      {name:'Yavimaya Coast',type:'pain',quality:75,etbTapped:false,note:'1 dégât'},
      {name:'Hinterland Harbor',type:'check',quality:78,etbTapped:'cond',note:'check'},
      {name:'Flooded Grove',type:'filter',quality:80,etbTapped:false,note:'filter'},
      {name:'Botanical Sanctum',type:'fast',quality:80,etbTapped:'cond',note:'fast land'},
      {name:'Barkchannel Pathway',type:'pathway',quality:78,etbTapped:false,note:'pathway'},
      {name:'Lavascarred Snarl',type:'reveal',quality:65,etbTapped:'cond',note:'reveal'},
      {name:'Simic Growth Chamber',type:'bounce',quality:55,etbTapped:true,note:'bounce'}
    ]
  };
  // Détecte un basic land par nom
  function _isBasic(name){
    var n=_nlOf(name);
    return /^(plains|island|swamp|mountain|forest|wastes|snow-covered plains|snow-covered island|snow-covered swamp|snow-covered mountain|snow-covered forest)$/i.test(n);
  }
  function _basicColor(name){
    var n=_nlOf(name);
    if(/plains/i.test(n))return 'W';
    if(/island/i.test(n))return 'U';
    if(/swamp/i.test(n))return 'B';
    if(/mountain/i.test(n))return 'R';
    if(/forest/i.test(n))return 'G';
    return null;
  }
  function landUpgrades(rows,deck,manaReport){
    if(!deck)return null;
    // Détermine les couleurs principales du deck (depuis pipCount)
    var pc=manaReport&&manaReport.pipCount||{W:0,U:0,B:0,R:0,G:0};
    var active=Object.keys(pc).filter(function(c){return pc[c]>0;});
    if(active.length<2)return {checked:true,reason:'Deck mono-couleur, peu d\'intérêt aux bilands',suggestions:[]};
    // Compte basics actuels par couleur + total ETB tapped
    var basicByColor={W:0,U:0,B:0,R:0,G:0};
    var tappedLands=0;var fixers=0;var totalLands=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      if(!/land/.test(tl))return;
      totalLands+=r.qty||1;
      var n=r.card&&r.card.name||r.name;
      if(_isBasic(n)){
        var c=_basicColor(n);if(c)basicByColor[c]+=r.qty||1;
      }
      // Détection ETB tapped (lifeland / bounce land / triome / etc.)
      var ot=(m.oracleText||'').toLowerCase();
      if(/enters the battlefield tapped/.test(ot)&&!/unless|or/.test(ot.split('enters the battlefield tapped')[1]||'')){
        tappedLands+=r.qty||1;
      }
      // Compte les fixers existants
      if(/add (one|two|three) mana of any|search your library for a.* land|\{t\}.*add.*or.*\{[wubrg]\}/.test(ot)){
        fixers+=r.qty||1;
      }
    });
    var tappedPct=totalLands?Math.round(tappedLands/totalLands*100):0;
    // Trie les paires de couleurs par poids (somme des pips W+U pour 'WU')
    var pairs=[];
    var colorList=['W','U','B','R','G'];
    for(var i=0;i<colorList.length;i++){
      for(var j=i+1;j<colorList.length;j++){
        var key=colorList[i]+colorList[j];
        var alt=colorList[j]+colorList[i];
        var cat=BILAND_CATALOG[key]||BILAND_CATALOG[alt];
        if(!cat)continue;
        // Score paire = combien de pips dans ces 2 couleurs
        var score=pc[colorList[i]]+pc[colorList[j]];
        // Quelle clé existe dans le catalog
        var realKey=BILAND_CATALOG[key]?key:alt;
        pairs.push({pair:realKey,c1:colorList[i],c2:colorList[j],score:score,catalog:cat});
      }
    }
    pairs=pairs.filter(function(p){return p.score>0;});
    pairs.sort(function(a,b){return b.score-a.score;});
    // Quel set de bilands existe déjà dans le deck
    var existing={};
    rows.forEach(function(r){
      var n=_nlOf(r.card&&r.card.name||r.name);
      pairs.forEach(function(p){
        p.catalog.forEach(function(b){
          if(_nlOf(b.name)===n)existing[n]=true;
        });
      });
    });
    // Suggestions : pour chaque paire dans les top 3, propose les 2 meilleurs
    // bilands NON présents ET avec note « pas trop tapped »
    var suggestions=[];
    var tappedBudget=Math.max(0,Math.floor(totalLands*0.30)-tappedLands); // budget restant ≤ 30 % tapped
    pairs.slice(0,5).forEach(function(p){
      var alreadyHave=p.catalog.filter(function(b){return existing[_nlOf(b.name)];}).length;
      // On veut idéalement 3-4 bilands par paire active
      if(alreadyHave>=4)return;
      var slotsNeeded=Math.min(2,4-alreadyHave);
      // Sélection : meilleur biland disponible non-tapped d'abord, sinon tapped
      var candidates=p.catalog
        .filter(function(b){return !existing[_nlOf(b.name)];})
        .filter(function(b){
          // Si tapped budget = 0, on filtre les ETB tapped purs
          if(tappedBudget<=0&&b.etbTapped===true)return false;
          return true;
        })
        .sort(function(a,b){return b.quality-a.quality;});
      candidates.slice(0,slotsNeeded).forEach(function(b){
        suggestions.push({
          pair:p.pair,
          name:b.name,
          type:b.type,
          quality:b.quality,
          etbTapped:b.etbTapped,
          note:b.note,
          weight:p.score,
          replaces:'basic '+({W:'Plains',U:'Island',B:'Swamp',R:'Mountain',G:'Forest'}[basicByColor[p.c1]>=basicByColor[p.c2]?p.c1:p.c2]||'?')
        });
        if(b.etbTapped===true)tappedBudget--;
      });
    });
    return {
      checked:true,
      totalLands:totalLands,
      basicByColor:basicByColor,
      tappedPct:tappedPct,
      existingFixers:fixers,
      suggestions:suggestions.slice(0,8),
      tappedBudgetRemaining:Math.max(0,tappedBudget),
      verdict:suggestions.length===0?'✓ Manabase déjà bien fixée':suggestions.length+' upgrade(s) possible(s)'+(tappedPct>40?' · ⚠ déjà '+tappedPct+'% ETB tapped (limite recommandée 30%)':'')
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // BATCH 20-AXES PRO (build 94) — niveau coach professionnel
  // ═════════════════════════════════════════════════════════════════════

  // ─── 17. CASTABILITY TURN-BY-TURN (proba Karsten) ──────────────────────
  // Calcule la probabilité de pouvoir lancer une carte critique à son CMC.
  // Approximation : pour cmc=N et X pips colorés, on a besoin de N lands
  // ET X sources colorées dans la main par tour N (avec scry/draws extra).
  function _probAtLeast(n,k){
    // P(au moins k succès sur n tirages depuis le deck) — approximation
    // grossière. Utilise la cumulative binomiale avec p = succès / deck.
    return Math.min(1,Math.max(0,1-Math.pow(1-k/n,7)));
  }
  function castabilityByCMC(rows,deck,manaReport){
    if(!manaReport||!manaReport.sources)return null;
    var sources=manaReport.sources;var nLands=manaReport.nLands||0;
    var deckSize=0;rows.forEach(function(r){deckSize+=r.qty||1;});
    if(deckSize<60)return {checked:false};
    // Pour chaque carte non-land, calcule sa proba d'être castable à son CMC
    var byTurn={1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    var rates={1:0,2:0,3:0,4:0,5:0,6:0,7:0};var counts={1:0,2:0,3:0,4:0,5:0,6:0,7:0};
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      if(/land/.test(tl))return;
      var cmc=Math.max(1,Math.min(7,Math.floor(m.cmc||0)||1));
      var mc=(m.manaCost||'').toLowerCase();
      var pips={W:0,U:0,B:0,R:0,G:0};
      ['w','u','b','r','g'].forEach(function(c){
        var mm=mc.match(new RegExp('\\{'+c+'\\}','g'))||[];
        pips[c.toUpperCase()]=mm.length;
      });
      // Proba pouvoir lancer = proba avoir N lands × proba avoir sources colorées
      // Lands : cibles Karsten approximatives. Pour 60 cards : ~24 lands. EDH ~37.
      var landTarget=Math.ceil(cmc*deckSize/100*0.55);
      var pHaveLands=Math.min(1,nLands/landTarget);
      var pColors=1;
      ['W','U','B','R','G'].forEach(function(c){
        if(pips[c]<=0)return;
        var need=pips[c]===1?13:pips[c]===2?19:pips[c]===3?22:24;
        var have=sources[c]||0;
        var p=Math.min(1,have/need);
        pColors*=p;
      });
      var castProb=Math.round(pHaveLands*pColors*100);
      byTurn[cmc].push({name:r.card&&r.card.name||r.name,cmc:cmc,prob:castProb});
      rates[cmc]+=castProb*(r.qty||1);counts[cmc]+=r.qty||1;
    });
    var avgByTurn={};
    Object.keys(rates).forEach(function(t){
      avgByTurn[t]=counts[t]?Math.round(rates[t]/counts[t]):null;
    });
    // Cartes problématiques : prob < 60% à leur CMC
    var problems=[];
    Object.keys(byTurn).forEach(function(t){
      byTurn[t].filter(function(c){return c.prob<60;}).slice(0,3).forEach(function(c){problems.push(c);});
    });
    problems.sort(function(a,b){return a.prob-b.prob;});
    return {
      checked:true,
      avgByTurn:avgByTurn,
      problems:problems.slice(0,8),
      verdict:problems.length===0?'✓ Toutes les cartes sont castables à leur CMC':problems.length+' carte(s) avec castabilité douteuse'
    };
  }

  // ─── 18. CARD ADVANTAGE NET (cantrip vs engine) ────────────────────────
  function cardAdvantageNet(rows){
    var cantrips=0,twoForOne=0,engines=0,wheels=0,recurringDraw=0;
    var totalDrawCards=0;
    rows.forEach(function(r){
      var m=r.meta||{};var ot=(m.oracleText||'').toLowerCase();var nl=_nlOf(r.card&&r.card.name||r.name);
      var qty=r.qty||1;var cmc=m.cmc||0;
      // Cantrips (draw 1 + replaces itself ≈ net 0)
      if((/^|\n/).test(ot)&&/draw (a|one) card/.test(ot)&&cmc<=2&&!/whenever/.test(ot)){
        cantrips+=qty;totalDrawCards+=qty;return;
      }
      // 2-for-1 : draw 2+ cards on cast
      if(/draw (two|three|x|that many) cards?/.test(ot)&&!/whenever|at the beginning/.test(ot)){
        twoForOne+=qty;totalDrawCards+=qty;return;
      }
      // Wheels (each player draws + discard)
      if(/each player.*draws.* cards?|wheel of fortune/.test(ot)){
        wheels+=qty;totalDrawCards+=qty;return;
      }
      // Engines : repeated draw (whenever / at the beginning of)
      if(/whenever .* (deals damage|enters the battlefield|attacks|dies).*draw a card|at the beginning of .* draw a card|at the beginning of .* upkeep.*draw/.test(ot)){
        engines+=qty;totalDrawCards+=qty;return;
      }
      // Recurring draw (Sylvan Library, Necropotence, Phyrexian Arena)
      var staples=['phyrexian arena','sylvan library','necropotence','rhystic study','mystic remora','esper sentinel','consecrated sphinx','bolas\'s citadel','smothering tithe'];
      if(staples.indexOf(nl)>=0){
        recurringDraw+=qty;engines+=qty;totalDrawCards+=qty;return;
      }
    });
    // Score CA : engines + wheels comptent +3, 2-for-1 compte +1.5, cantrips +0.5
    var caScore=engines*3+wheels*2+twoForOne*1.5+cantrips*0.5;
    return {
      cantrips:cantrips,twoForOne:twoForOne,engines:engines,wheels:wheels,recurringDraw:recurringDraw,
      totalDrawCards:totalDrawCards,
      caScore:Math.round(caScore),
      verdict:caScore>=30?'✓ Card advantage solide':caScore>=18?'~ Card advantage moyen':'⚠ Manque d\'engines de draw — cantrips trop dominants'
    };
  }

  // ─── 19. CURVE-OUT PROBABILITY (sim 5k mains) ──────────────────────────
  function curveOutProbability(rows){
    var library=[];
    rows.forEach(function(r){
      var qty=r.qty||1;var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      var cmc=Math.max(0,Math.floor(m.cmc||0));
      var isLand=/land/.test(tl);
      for(var i=0;i<qty;i++){library.push({isLand:isLand,cmc:cmc});}
    });
    if(library.length<60)return {checked:false};
    var sims=5000;var perfect=0,decent=0;
    for(var sim=0;sim<sims;sim++){
      var shuf=_seededShuffle(library,sim+7919);
      var hand=shuf.slice(0,7);
      var deck=shuf.slice(7);
      // Compte les drops disponibles pour T1/T2/T3
      var availableByCmc={1:0,2:0,3:0};
      var landCount=0;
      hand.forEach(function(c){
        if(c.isLand)landCount++;
        else if(c.cmc>=1&&c.cmc<=3)availableByCmc[c.cmc]++;
      });
      // Simule T1 → tu draws 1 carte
      for(var t=1;t<=3;t++){
        if(t>=2){
          // Draw step
          var d=deck.shift();
          if(d){
            if(d.isLand)landCount++;
            else if(d.cmc>=1&&d.cmc<=3)availableByCmc[d.cmc]++;
          }
        }
      }
      var perfectCurve=(landCount>=3&&availableByCmc[1]>=1&&availableByCmc[2]>=1&&availableByCmc[3]>=1);
      var decentCurve=(landCount>=2&&(availableByCmc[1]+availableByCmc[2]+availableByCmc[3]>=2));
      if(perfectCurve)perfect++;
      if(decentCurve)decent++;
    }
    return {
      checked:true,
      perfectPct:Math.round(perfect/sims*100),
      decentPct:Math.round(decent/sims*100),
      verdict:perfect/sims>=0.30?'✓ Courbes de jeu fluides':perfect/sims>=0.15?'~ Curve-out occasionnel':'⚠ Courbe lente — manque de 1/2/3-drops'
    };
  }

  // ─── 20. STACK INTERACTION % ───────────────────────────────────────────
  function stackInteraction(rows){
    var totalSpells=0,instantSpeed=0,sorcerySpeed=0,flashCreatures=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var qty=r.qty||1;
      if(/land/.test(tl))return;
      totalSpells+=qty;
      if(/instant/.test(tl))instantSpeed+=qty;
      else if(/sorcery/.test(tl))sorcerySpeed+=qty;
      else if(/creature/.test(tl)&&/flash/.test(ot)){flashCreatures+=qty;instantSpeed+=qty;}
    });
    var pct=totalSpells?Math.round(instantSpeed/totalSpells*100):0;
    return {
      totalSpells:totalSpells,instantSpeed:instantSpeed,sorcerySpeed:sorcerySpeed,flashCreatures:flashCreatures,
      instantPct:pct,
      verdict:pct>=35?'✓ Forte présence stack (jeu réactif)':pct>=20?'~ Présence stack correcte':'⚠ Deck purement proactif (vulnérable au combo adverse)'
    };
  }

  // ─── 21. VELOCITY (cartes vues par tour) ───────────────────────────────
  function velocity(rows){
    var cantripCount=0,scryCount=0,tutorCount=0,drawX=0;
    rows.forEach(function(r){
      var m=r.meta||{};var ot=(m.oracleText||'').toLowerCase();var qty=r.qty||1;
      if(/draw (a|one) card/.test(ot)&&(m.cmc||0)<=2)cantripCount+=qty;
      if(/scry [1-9]/.test(ot))scryCount+=qty;
      if(/search your library for a/.test(ot))tutorCount+=qty;
      if(/draw (two|three) cards?/.test(ot))drawX+=qty;
    });
    // Vélocité estimée : par tour, en moyenne, combien de cartes en plus tu vois ?
    var perTurnExtra=(cantripCount*0.7+scryCount*0.4+tutorCount*0.9+drawX*1.2)/10;
    var totalSeen=1+perTurnExtra; // 1 = draw step normal
    return {
      cantrips:cantripCount,scry:scryCount,tutors:tutorCount,drawX:drawX,
      velocity:totalSeen.toFixed(1),
      verdict:totalSeen>=2.0?'✓ Velocity élevée (digging puissant)':totalSeen>=1.4?'~ Velocity correcte':'⚠ Velocity faible — manque de cantrips/scry'
    };
  }

  // ─── 22. INEVITABILITY (cartes qui transforment durée en victoire) ────
  // Build 102 : extension dictionnaire — 100+ cartes inevitability
  var INEVITABILITY_CARDS = [
    // Alt-wins
    'aetherflux reservoir','approach of the second sun','mortal combat','helix pinnacle',
    'mayael\'s aria','maze\'s end','felidar sovereign','test of endurance',
    'triskaidekaphobia','near-death experience','simic ascendancy','revel in riches',
    'coalition victory','barren glory','epic struggle','azor\'s elocutors',
    'hellkite tyrant','mechtitan core','laboratory maniac','jace, wielder of mysteries',
    'thassa\'s oracle','blightsteel colossus','marit lage',
    // Mass damage X-spells + combo finishers
    'insurrection','triumph of the hordes','craterhoof behemoth','finale of devastation',
    'overwhelming stampede','pathbreaker ibex','end-raze forerunners',
    'beacon of immortality','exsanguinate','torment of hailfire','crackle with power',
    'comet storm','rolling earthquake','jokulhaups','obliterate','decree of annihilation',
    // Game-ending engines
    'expropriate','rise of the dark realms','liliana, dreadhorde general',
    'living death','rise from the grave','animate dead chain','sun titan loop',
    'cataclysm','armageddon','ravages of war','smothering tithe',
    // Token sweeps + alpha
    'finale of glory','gather the townsfolk','secure the wastes finale',
    'last stand','draconic intervention',
    // Specific
    'dragon\'s approach','jaya\'s greeting','korlash, heir to blackblade',
    'dockside extortionist','peregrine drake','isochron scepter',
    'paradox engine','aetherflux reservoir','urza, lord high artificer',
    // Combos T6+
    'sanguine bond','exquisite blood','niv-mizzet, parun','curiosity'
  ];
  function inevitability(rows){
    var found=[];var set=_cardSet(rows);
    INEVITABILITY_CARDS.forEach(function(n){if(set[n])found.push(n);});
    return {
      cards:found,count:found.length,
      verdict:found.length>=2?'✓ Multiples inevitabilities détectées':found.length===1?'~ 1 inevitability ('+found[0]+')':'⚠ Aucune inevitability — pas de plan « gagner si la partie traîne »'
    };
  }

  // ─── 23. RECOVERY TIME POST-WRATH (sim) ────────────────────────────────
  function recoveryTimePostWrath(rows){
    var creaturesByCmc={1:0,2:0,3:0,4:0,5:0,6:0,7:0};var recurEffects=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var qty=r.qty||1;
      if(/creature/.test(tl)){
        var cmc=Math.max(1,Math.min(7,Math.floor(m.cmc||0)||1));
        creaturesByCmc[cmc]+=qty;
      }
      if(/return target creature.*from your graveyard|return.*creature.*battlefield/.test(ot))recurEffects+=qty;
    });
    // Estime tours pour rebuild : T1 si 1-drop dispo, T2 si 2-drop, etc.
    var earliestRebuild=7;
    for(var c=1;c<=7;c++){if(creaturesByCmc[c]>=3){earliestRebuild=c;break;}}
    // Recurring effects accélèrent
    if(recurEffects>=3&&earliestRebuild>2)earliestRebuild--;
    return {
      creaturesByCmc:creaturesByCmc,recurEffects:recurEffects,
      earliestRebuild:earliestRebuild,
      verdict:earliestRebuild<=2?'✓ Recovery rapide (≤T2)':earliestRebuild<=4?'~ Recovery moyenne (T3-T4)':'⚠ Recovery lente (T5+) — vulnérable aux wraths'
    };
  }

  // ─── 24. TEMPO LOSS (cartes « do nothing » au tour joué) ──────────────
  // Build 102 : étendu.
  var TEMPO_LOSS_CARDS = [
    // Draw engines lentes
    'necropotence','sylvan library','phyrexian arena','bolas\'s citadel',
    'rhystic study','mystic remora','smothering tithe','guardian project',
    'beast whisperer','underworld breach','sensei\'s divining top',
    'enlightened tutor','vampiric tutor','demonic tutor','mystical tutor',
    'sevinne\'s reclamation','search for tomorrow','isochron scepter',
    'dramatic reversal','aetherflux reservoir','helm of obedience',
    'painter\'s servant','grindstone','intuition','gamble','idyllic tutor'
  ];
  function tempoLoss(rows){
    var found=[];var set=_cardSet(rows);
    TEMPO_LOSS_CARDS.forEach(function(n){if(set[n])found.push(n);});
    return {
      cards:found,count:found.length,
      verdict:found.length<=3?'✓ Tempo OK':found.length<=6?'~ Plusieurs cartes setup — accepte le tempo loss':'⚠ Trop de cartes setup — risque de perdre l\'initiative'
    };
  }

  // ─── 25. MUST-ANSWER THREATS ───────────────────────────────────────────
  // Build 102 : élargi de 35 → 80+ cartes — bombs T3/T4 méta 2026 Q2.
  var MUST_ANSWER = [
    // Engines de draw
    'yawgmoth, thran physician','rhystic study','mystic remora','esper sentinel',
    'consecrated sphinx','sheoldred, the apocalypse','tymna the weaver',
    'archmage emeritus','beast whisperer','guardian project','elenda, saint of dusk',
    'phyrexian arena','sylvan library','necropotence','bolas\'s citadel',
    // Mana production
    'smothering tithe','dockside extortionist','kinnan, bonder prodigy',
    'urza, lord high artificer','derevi, empyrial tactician','kraum, ludevic\'s opus',
    'goldspan dragon','sythis, harvest\'s hand',
    // Combo enablers
    'underworld breach','aetherflux reservoir','isochron scepter','dramatic reversal',
    'paradox engine','peregrine drake','old gnawbone','vorinclex',
    // Threat creatures T2-T4
    'krenko, mob boss','yuriko, the tiger\'s shadow','najeela, the blade-blossom',
    'god-eternal kefnet','winota, joiner of forces','animar, soul of elements',
    'edgar markov','prosper, tome-bound','korvold, fae-cursed king','toxrill, the corrosive',
    'old stickfingers','hinata, dawn-crowned','grand arbiter augustin iv',
    'thrasios, triton hero','tergrid, god of fright','jin-gitaxias, core augur',
    // Stax pieces critiques
    'blood moon','back to basics','winter orb','static orb','tangle wire',
    'thalia, guardian of thraben','collector ouphe','null rod','stony silence',
    'rest in peace','leyline of the void','grafdigger\'s cage','torpor orb',
    'cursed totem','linvala, keeper of silence','aven mindcensor',
    'opposition agent','hullbreacher','notion thief','narset, parter of veils',
    'meekstone','sphere of resistance','thorn of amethyst','trinisphere',
    // Wraths qu'on ne veut pas voir résolus
    'cyclonic rift','farewell','damn','toxic deluge','fated retribution',
    // Voltron threats
    'voltron commanders','rafiq of the many','uril the miststalker'
  ];
  function mustAnswerThreats(rows){
    var found=[];var set=_cardSet(rows);
    MUST_ANSWER.forEach(function(n){if(set[n])found.push(n);});
    return {
      cards:found,count:found.length,
      verdict:found.length>=3?'✓ Plusieurs menaces qui exigent réponse':found.length>=1?'~ 1-2 must-answer threats':'⚠ Aucune menace qui force la réponse — adversaires peuvent t\'ignorer'
    };
  }

  // ─── 26. ANTI-META POSITIONING (vs top cards du méta) ──────────────────
  function antiMetaPositioning(rows,deck){
    // Cartes du méta génériques top toutes formats EDH
    var topMetaThreats=['dockside extortionist','rhystic study','mystic remora','smothering tithe',
      'urza, lord high artificer','tergrid, god of fright','yuriko, the tiger\'s shadow'];
    var coverage=0;var totalRemovalCanHit=0;
    rows.forEach(function(r){
      var m=r.meta||{};var ot=(m.oracleText||'').toLowerCase();
      if(/destroy target creature|exile target creature|destroy target permanent|exile target permanent|destroy target nonland permanent|counter target spell/.test(ot))totalRemovalCanHit+=r.qty||1;
    });
    coverage=Math.min(100,Math.round(totalRemovalCanHit*5));
    return {
      removalCanHit:totalRemovalCanHit,coverage:coverage,
      verdict:totalRemovalCanHit>=8?'✓ Capable de gérer les menaces classiques du méta':totalRemovalCanHit>=5?'~ Couverture méta correcte':'⚠ Faible coverage — vulnérable aux engines adverses'
    };
  }

  // ─── 27. SYNERGY ORPHANS (cartes sans interaction interne) ─────────────
  function synergyOrphans(rows,deck){
    // Approche simplifiée : extrait les keywords/types/themes du deck, puis pour
    // chaque carte vérifie qu'elle partage au moins 1 token avec ≥5 autres cartes
    var globalKws={};
    rows.forEach(function(r){
      var m=r.meta||{};var ot=(m.oracleText||'').toLowerCase();var tl=(m.typeLine||'').toLowerCase();
      var kws=[];
      // Extract types
      ['creature','artifact','enchantment','sorcery','instant','planeswalker','land'].forEach(function(t){
        if(tl.indexOf(t)>=0)kws.push(t);
      });
      // Extract simple keywords
      ['proliferate','+1/+1','treasure','token','sacrifice','blink','flicker','equipment',
        'aura','draw','counter','damage','life','graveyard','library'].forEach(function(k){
        if(ot.indexOf(k)>=0)kws.push(k);
      });
      kws.forEach(function(k){globalKws[k]=(globalKws[k]||0)+1;});
      r._kws=kws;
    });
    var orphans=[];
    rows.forEach(function(r){
      if(!r._kws)return;
      // Check if any keyword is shared with ≥5 other cards
      var hasOverlap=r._kws.some(function(k){return globalKws[k]>=5;});
      if(!hasOverlap){orphans.push(r.card&&r.card.name||r.name);}
    });
    return {
      orphans:orphans.slice(0,8),count:orphans.length,
      verdict:orphans.length===0?'✓ Aucune carte orpheline détectée':orphans.length<=3?'~ Quelques cartes orphelines à reconsidérer':'⚠ Beaucoup de cartes orphelines — manque de synergie interne'
    };
  }

  // ─── 28. MANA PRODUCTION CURVE ─────────────────────────────────────────
  function manaProductionCurve(rows){
    // Estimation : pour chaque tour T, mana disponible = lands_played + ramp_actif
    var lands=0,ramp1=0,ramp2=0,ramp3=0,rampHigher=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var qty=r.qty||1;var cmc=m.cmc||0;
      if(/land/.test(tl)){lands+=qty;return;}
      var isRamp=/add (one|two|three) mana|search your library for a.* land|\{t\}.*add.*\{[wubrgc]\}/.test(ot);
      if(!isRamp)return;
      if(cmc<=1)ramp1+=qty;
      else if(cmc===2)ramp2+=qty;
      else if(cmc===3)ramp3+=qty;
      else rampHigher+=qty;
    });
    var production={1:1,2:2,3:3,4:4,5:5,6:6,7:7};
    if(ramp1>=4)production[2]=3;
    if(ramp2>=4)production[3]=4;
    if(ramp1>=4&&ramp2>=4)production[3]=5;
    if(ramp3>=3)production[4]=6;
    return {
      lands:lands,ramp1:ramp1,ramp2:ramp2,ramp3:ramp3,
      productionByTurn:production,
      verdict:production[4]>=5?'✓ Production de mana explosive':production[4]>=4?'~ Production correcte':'⚠ Production lente — manque de ramp early'
    };
  }

  // ─── 29. COMBAT MATH v2 (build 101) — évasion + pondération CMC ───────
  // Avant : moyenne power vs toughness moyen. Faux à 70%.
  // Maintenant :
  //  - on isole les attaquants avec évasion (passent presque toujours)
  //  - on pondère par CMC (un 5/5 ne vaut pas un 1/1)
  //  - avg blocker dynamique selon format ET phase de partie estimée
  //  - on score séparément "avg attaquant qui passe" en early et late game
  function combatMath(rows,deck){
    var fmt=(deck&&deck.format||'').toLowerCase();
    // Avg blockeur réaliste : en EDH/Commander 3 (early) à 4 (late) ; en pauper 2 ; ailleurs 3
    var blockerEarly=fmt==='pauper'?2:3;
    var blockerLate=fmt==='commander'||fmt==='paupercmd'||fmt==='oathbreaker'?4:3;
    // 4 buckets : early évasion / early no-evasion / late évasion / late no-evasion
    var groups={ee:{pow:0,n:0},en:{pow:0,n:0},le:{pow:0,n:0},ln:{pow:0,n:0}};
    var totalCreatures=0;
    var evasionCount=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      if(!/creature/.test(tl))return;
      var p=parseInt(m.power||'0',10)||0;
      var cmc=m.cmc||0;
      var qty=r.qty||1;
      var hasEvasion=/flying|menace|unblockable|trample|shadow|horsemanship|fear|intimidate|can't be blocked|skulk|protection/.test(ot);
      var isLate=cmc>=4;
      var key=(isLate?'l':'e')+(hasEvasion?'e':'n');
      groups[key].pow+=p*qty;groups[key].n+=qty;
      totalCreatures+=qty;if(hasEvasion)evasionCount+=qty;
    });
    function _avg(g){return g.n?(g.pow/g.n):0;}
    var avgEarlyEvasion=_avg(groups.ee).toFixed(1);
    var avgEarlyNoEv=_avg(groups.en).toFixed(1);
    var avgLateEvasion=_avg(groups.le).toFixed(1);
    var avgLateNoEv=_avg(groups.ln).toFixed(1);
    // % évasion = signal majeur (passe le blockeur même si power bas)
    var evasionPct=totalCreatures?Math.round(evasionCount/totalCreatures*100):0;
    // Verdict pondéré : sur late, les créatures sans évasion sont chair à canon.
    var earlyOK=parseFloat(avgEarlyEvasion)>=blockerEarly-1||evasionPct>=30;
    var lateOK=parseFloat(avgLateEvasion)>=blockerLate||evasionPct>=40;
    var verdict;
    if(earlyOK&&lateOK)verdict='✓ Bons attaquants — early '+avgEarlyEvasion+' (évasion), late '+avgLateEvasion+' (évasion), '+evasionPct+'% du board passe';
    else if(!earlyOK&&!lateOK)verdict='⚠ Attaquants trop faibles partout — '+evasionPct+'% évasion seulement, blockeur '+blockerEarly+'/'+blockerLate;
    else if(!lateOK)verdict='~ Late game faible — attaquants sans évasion bloqués par 4+';
    else verdict='~ Early game faible — peu de pression T1-T3';
    return {
      avgEarlyEvasion:avgEarlyEvasion,avgEarlyNoEv:avgEarlyNoEv,
      avgLateEvasion:avgLateEvasion,avgLateNoEv:avgLateNoEv,
      evasionPct:evasionPct,totalCreatures:totalCreatures,
      blockerEarly:blockerEarly,blockerLate:blockerLate,
      verdict:verdict
    };
  }

  // ─── 30. THREATS KILLABLE SCOPE v2 (build 101) ─────────────────────────
  // Pondéré par CMC ET restriction. Le score "quality" est ce qui compte,
  // pas le count brut. Un Doom Blade (3 CMC, target creature non-black)
  // vaut moins qu'un Swords to Plowshares (1 CMC, target creature).
  //
  // Score d'un removal = base × CMC penalty × restriction penalty.
  // base = 10 ; CMC penalty = max(0.3, 1 - 0.15*cmc) ; restriction selon target.
  function threatsKillableScope(rows){
    var universal=0,creatureOnly=0,nonlandOnly=0,conditional=0;
    var qualityScore=0;
    var byMana={cheap:0,mid:0,expensive:0}; // ≤2, 3-4, 5+
    rows.forEach(function(r){
      var m=r.meta||{};var ot=(m.oracleText||'').toLowerCase();var qty=r.qty||1;
      var cmc=m.cmc||0;
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var category=null;var restrict=1.0;
      // Détection catégorie + restriction
      // Universal (target permanent / nonland permanent)
      if(/destroy target nonland permanent|exile target nonland permanent|destroy target permanent|exile target permanent|beast within|generous gift|chaos warp|assassin's trophy/.test(ot)||nl==='beast within'||nl==='generous gift'||nl==='chaos warp'){
        category='universal';universal+=qty;restrict=1.0;
      }
      // Counter target spell (universal)
      else if(/counter target spell/.test(ot)){
        category='nonland';nonlandOnly+=qty;restrict=0.9;
        if(/unless its controller pays/.test(ot))restrict=0.5; // tax counter = faible
      }
      // Multi-target (artifact, enchant, creature, PW)
      else if(/destroy target (artifact|enchantment|creature or planeswalker|nonbasic land)|exile target (artifact|enchantment|creature|planeswalker)/.test(ot)){
        // Si "artifact or enchantment" → nonlandOnly
        if(/artifact or enchantment|enchantment or artifact/.test(ot)){
          category='nonland';nonlandOnly+=qty;restrict=0.85;
        }else{
          category='nonland';nonlandOnly+=qty;restrict=0.8;
        }
      }
      // Creature-only (destroy target creature)
      else if(/destroy target creature|exile target creature/.test(ot)){
        category='creatureOnly';creatureOnly+=qty;restrict=0.6;
        // Restrictions de couleur / tough
        if(/non[-\s]?black|non[-\s]?white|non[-\s]?red|non[-\s]?blue|non[-\s]?green/.test(ot))restrict*=0.7;
        if(/toughness \d or less|with power \d or less|with mana value \d or less/.test(ot)){category='conditional';conditional+=qty;restrict*=0.4;}
        if(/lifelink|swords to plowshares|path to exile/.test(ot)||nl==='swords to plowshares'||nl==='path to exile')restrict=0.85;
      }
      // Conditional pure
      else if(/if it's|with mana value \d|with .* or less/.test(ot)){
        category='conditional';conditional+=qty;restrict=0.4;
      }
      if(!category)return;
      var cmcPenalty=Math.max(0.3,1-0.15*cmc);
      qualityScore+=10*cmcPenalty*restrict*qty;
      if(cmc<=2)byMana.cheap+=qty;
      else if(cmc<=4)byMana.mid+=qty;
      else byMana.expensive+=qty;
    });
    qualityScore=Math.round(qualityScore);
    var totalCounted=universal+creatureOnly+nonlandOnly+conditional;
    return {
      universal:universal,creatureOnly:creatureOnly,nonlandOnly:nonlandOnly,conditional:conditional,
      universalPct:totalCounted?Math.round(universal/totalCounted*100):0,
      qualityScore:qualityScore,
      byMana:byMana,
      verdict:qualityScore>=60?'✓ Removal de haute qualité ('+qualityScore+' pts, '+byMana.cheap+' cheap)':qualityScore>=30?'~ Removal moyen ('+qualityScore+' pts) — manque de cheap/flexible':'⚠ Removal faible ('+qualityScore+' pts) — trop conditionnel ou cher'
    };
  }

  // ─── 31. EDHREC INCLUSION % (créativité vs respect du méta) ────────────
  function edhrecInclusion(rows,deck){
    // Approximation : utilise les staples connus comme proxy
    // Pour vraie analyse il faudrait EDHrec API par commandant
    var staples=0,uniqueCards=0;
    var commonStaples=['sol ring','arcane signet','command tower','swords to plowshares',
      'path to exile','cyclonic rift','rhystic study','mystic remora','smothering tithe',
      'beast within','generous gift','counterspell','demonic tutor','vampiric tutor'];
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      if(commonStaples.indexOf(nl)>=0)staples++;
      uniqueCards++;
    });
    var stapleDensity=uniqueCards?Math.round(staples/uniqueCards*100):0;
    return {
      stapleCount:staples,uniqueCards:uniqueCards,density:stapleDensity,
      verdict:stapleDensity>=20?'~ Deck très staple-driven (peu de créativité)':stapleDensity>=10?'✓ Bon équilibre staples / créativité':'~ Très créatif (peu de staples)'
    };
  }

  // ─── 32a. EDHREC PAR COMMANDANT (build 95) ─────────────────────────────
  // Utilise le module mlEdhrec (déjà chargé) pour récupérer les cartes top
  // par commandant et croiser avec ce que joue l'utilisateur. Retourne :
  // - Cartes recommandées par EDHrec mais absentes du deck
  // - Cartes présentes dans le deck mais rares dans la communauté EDHrec
  function edhrecCommanderAnalysis(rows,deck,callback){
    if(!deck||!deck.commander||!deck.commander.name){callback&&callback({checked:false,reason:'Pas de commandant'});return;}
    if(typeof window.mlEdhrecFetch!=='function'){callback&&callback({checked:false,reason:'Module EDHrec non chargé'});return;}
    var cmdName=deck.commander.name;
    window.mlEdhrecFetch(cmdName,function(err,data){
      if(err||!data){callback&&callback({checked:false,reason:'EDHrec indisponible: '+(err&&err.message||'erreur')});return;}
      // Extrait les cartes recommandées
      var topRecs=[];
      var saltyCardsInDeck=[];
      try{
        var cardlists=(data.container&&data.container.json_dict&&data.container.json_dict.cardlists)||[];
        cardlists.forEach(function(list){
          (list.cardviews||[]).forEach(function(cv){
            if(cv.name&&!cv.cmc_only){
              topRecs.push({
                name:cv.name,
                inclusion:cv.inclusion||0,
                synergy:cv.synergy||0, // build 102 : %above moyenne = signal "high-synergy"
                salt:cv.salt||0,       // build 102 : score de haine communauté
                category:list.header||'?',
                price:cv.price||(cv.prices&&cv.prices.tcgplayer)||0
              });
            }
          });
        });
      }catch(_){}
      // Croisement avec le deck
      var deckSet={};rows.forEach(function(r){var nl=_nlOf(r.card&&r.card.name||r.name);if(nl)deckSet[nl]=true;});
      var missing=topRecs.filter(function(c){return !deckSet[_nlOf(c.name)];});
      // Build 102 : trier par "high synergy" plutôt que par inclusion seule.
      // Une carte "high-synergy" est jouée >moyenne avec CE commandant spécifiquement
      // (synergy > 30%). C'est plus précieux qu'une staple générique.
      var highSynergyMissing=missing.filter(function(c){return c.synergy>=30;}).sort(function(a,b){return b.synergy-a.synergy;}).slice(0,10);
      var staplesMissing=missing.filter(function(c){return c.inclusion>=40&&c.synergy<30;}).sort(function(a,b){return b.inclusion-a.inclusion;}).slice(0,8);
      // Salt score : cartes très "haineuses" en table casual
      var saltyInDeckMap={};
      topRecs.forEach(function(c){
        var nl=_nlOf(c.name);
        if(deckSet[nl]&&c.salt>=1.5)saltyInDeckMap[nl]={name:c.name,salt:c.salt};
      });
      saltyCardsInDeck=Object.values(saltyInDeckMap).sort(function(a,b){return b.salt-a.salt;});
      var totalSalt=saltyCardsInDeck.reduce(function(s,c){return s+c.salt;},0);
      var rare=[];
      var inclusionMap={};
      topRecs.forEach(function(c){inclusionMap[_nlOf(c.name)]=c.inclusion;});
      rows.forEach(function(r){
        var nl=_nlOf(r.card&&r.card.name||r.name);
        var meta=r.meta||{};var tl=(meta.typeLine||'').toLowerCase();
        if(/land/.test(tl))return;
        if(inclusionMap[nl]!=null&&inclusionMap[nl]<5)rare.push({name:r.card&&r.card.name||r.name,inclusion:inclusionMap[nl]});
      });
      // Budget : prix moyen des cartes du deck (proxy via EDHrec prices)
      var totalPrice=0;var pricedCount=0;
      rows.forEach(function(r){
        var nl=_nlOf(r.card&&r.card.name||r.name);
        var entry=topRecs.find(function(c){return _nlOf(c.name)===nl;});
        if(entry&&entry.price>0){totalPrice+=entry.price*(r.qty||1);pricedCount++;}
      });
      callback&&callback({
        checked:true,
        commander:cmdName,
        highSynergyMissing:highSynergyMissing,  // build 102
        staplesMissing:staplesMissing,           // build 102 (séparé)
        topRecommendations:missing.slice(0,12),  // legacy
        spicyCards:rare.slice(0,8),
        saltyCardsInDeck:saltyCardsInDeck.slice(0,8), // build 102
        totalSaltScore:Math.round(totalSalt*10)/10,    // build 102
        estimatedPrice:Math.round(totalPrice),         // build 102
        pricedCount:pricedCount,
        totalAnalyzed:topRecs.length,
        verdict:highSynergyMissing.length===0?'✓ Tu joues toutes les cartes high-synergy avec ce commandant':'Top '+highSynergyMissing.length+' cartes high-synergy manquantes (synergy ≥30%)'
      });
    });
  }

  // ─── 32. COACH NARRATIF ────────────────────────────────────────────────
  function coachNarrative(report){
    if(!report)return '';
    var parts=[];
    // Identité du deck — priorité à l'archétype détecté par clustering
    var arch=report.archetype&&report.archetype.primary?report.archetype.primary.archetype:(report.curve&&report.curve.archetype||'midrange');
    var primary=report.winCons&&report.winCons.primary?report.winCons.primary.label:'plan flou';
    parts.push('Ton deck est un <b>'+arch+'</b> qui gagne via <b>'+primary+'</b>.');
    if(report.archetype&&report.archetype.tribalSubtype){
      parts.push('Profil tribal : <b>'+report.archetype.tribalSubtype.type+'</b> ('+report.archetype.tribalSubtype.count+' cartes).');
    }
    // Force principale
    if(report.robustness&&report.robustness.score>=70){
      parts.push('<b>Force :</b> deck robuste (score '+report.robustness.score+'/100), résistant face aux contre-mesures.');
    }
    if(report.bracket){
      parts.push('Niveau compétitif : <b>Bracket '+report.bracket.bracket+' ('+report.bracket.label+')</b>.');
    }
    // Faiblesse principale
    if(report.redundancy&&report.redundancy.sev!=='good'){
      parts.push('<b>Faiblesse :</b> '+report.redundancy.msg);
    }
    if(report.threats&&report.threats.dryTurns.length){
      parts.push('Attention aux <b>tours vides</b> : T'+report.threats.dryTurns.join(', T')+' — pas de jouable.');
    }
    // Inevitability
    if(report.inevitability&&report.inevitability.count){
      parts.push('Plan late-game : <b>'+report.inevitability.cards.join(' / ')+'</b>.');
    }
    // Coach top
    if(report.coach&&report.coach.length){
      parts.push('Si tu fais une seule chose : <b>'+report.coach[0].title+'</b>.');
    }
    return parts.join(' ');
  }

  // ─── 32b. WEB WORKER pour sims lourdes (build 95) ─────────────────────
  // Offload mulligan + curveOut sur un worker pour ne pas freezer le main
  // thread (~400 ms cumulé). Worker créé à la volée via Blob URL — pas de
  // fichier séparé à servir. Fallback sync si Worker indisponible.
  var _mlWorker=null;
  function _getMlWorker(){
    if(_mlWorker)return _mlWorker;
    if(typeof Worker==='undefined')return null;
    var src=
      'function _shuf(a,s){s|=0;function r(){s=s+0x6D2B79F5|0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}'+
      'var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(r()*(i+1));var x=b[i];b[i]=b[j];b[j]=x;}return b;}'+
      'function simMull(library){'+
      ' var keepable=0,kp=0,avgL=0,avgR=0,avgA=0,scr=0,fld=0;'+
      ' for(var s=0;s<10000;s++){'+
      '  var h=_shuf(library,s+1).slice(0,7);'+
      '  var l=0,rmp=0,ac=0;h.forEach(function(c){if(c.isLand)l++;if(c.isRamp)rmp++;if(c.isEarlyAction)ac++;});'+
      '  avgL+=l;avgR+=rmp;avgA+=ac;if(l<=1)scr++;if(l>=6)fld++;'+
      '  if((l>=2&&l<=5)&&(rmp>=1||ac>=1))kp++;'+
      ' }'+
      ' return {keepablePct:Math.round(kp/100),avgLands:(avgL/10000).toFixed(2),avgRamp:(avgR/10000).toFixed(2),avgAction:(avgA/10000).toFixed(2),manaScrewPct:Math.round(scr/100),manaFloodPct:Math.round(fld/100)};'+
      '}'+
      'function simCurve(library){'+
      ' var perf=0,dec=0;'+
      ' for(var s=0;s<5000;s++){'+
      '  var sh=_shuf(library,s+7919);var h=sh.slice(0,7);var d=sh.slice(7);'+
      '  var av={1:0,2:0,3:0};var lc=0;'+
      '  h.forEach(function(c){if(c.isLand)lc++;else if(c.cmc>=1&&c.cmc<=3)av[c.cmc]++;});'+
      '  for(var t=2;t<=3;t++){var dd=d.shift();if(dd){if(dd.isLand)lc++;else if(dd.cmc>=1&&dd.cmc<=3)av[dd.cmc]++;}}'+
      '  if(lc>=3&&av[1]>=1&&av[2]>=1&&av[3]>=1)perf++;'+
      '  if(lc>=2&&(av[1]+av[2]+av[3]>=2))dec++;'+
      ' }'+
      ' return {perfectPct:Math.round(perf/50),decentPct:Math.round(dec/50)};'+
      '}'+
      'self.onmessage=function(e){'+
      ' var d=e.data;'+
      ' if(d.type==="mulligan")self.postMessage({type:"mulligan",result:simMull(d.library)});'+
      ' else if(d.type==="curveOut")self.postMessage({type:"curveOut",result:simCurve(d.library)});'+
      '};';
    try{
      var blob=new Blob([src],{type:'application/javascript'});
      _mlWorker=new Worker(URL.createObjectURL(blob));
    }catch(e){console.warn('[mlAnaPro] Worker init failed',e);return null;}
    return _mlWorker;
  }
  // Versions async via worker (utilisables si on veut vraiment offload)
  function mulliganProbabilityAsync(rows,deck,callback){
    var library=[];
    rows.forEach(function(r){
      var qty=r.qty||1;var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var cmc=typeof m.cmc==='number'?m.cmc:0;
      var role=_detectCardRole(m);
      var isLand=/land/.test(tl);var isRamp=role==='ramp'&&cmc<=2;
      var isEarlyAction=(/creature|instant|sorcery/.test(tl))&&cmc<=3;
      for(var i=0;i<qty;i++){library.push({isLand:isLand,isRamp:isRamp,isEarlyAction:isEarlyAction,cmc:cmc});}
    });
    if(library.length<7){callback({checked:false});return;}
    var w=_getMlWorker();
    if(!w){callback(mulliganProbability(rows,deck));return;}
    var handler=function(e){
      if(e.data.type==='mulligan'){
        w.removeEventListener('message',handler);
        var r=e.data.result;r.checked=true;
        r.verdict=r.keepablePct>=85?'✓ Mains d\'ouverture solides':r.keepablePct>=70?'~ Mulligan occasionnel':'⚠ Mulligan fréquent';
        callback(r);
      }
    };
    w.addEventListener('message',handler);
    w.postMessage({type:'mulligan',library:library});
  }

  // ─── 33. COMPARE 2 REPORTS (before / after) ───────────────────────────
  function compareReports(prev,current){
    if(!prev||!current)return null;
    var diffs=[];
    function _diff(label,p,c,positive){
      if(p==null||c==null)return;
      var delta=c-p;if(delta===0)return;
      diffs.push({label:label,prev:p,current:c,delta:delta,positive:positive?delta>0:delta<0});
    }
    if(prev.bracket&&current.bracket)_diff('Bracket',prev.bracket.bracket,current.bracket.bracket,false);
    if(prev.robustness&&current.robustness)_diff('Robustesse',prev.robustness.score,current.robustness.score,true);
    if(prev.mulligan&&current.mulligan)_diff('Keepable %',prev.mulligan.keepablePct,current.mulligan.keepablePct,true);
    if(prev.redundancy&&current.redundancy)_diff('Plans viables',prev.redundancy.count,current.redundancy.count,true);
    if(prev.curveOut&&current.curveOut&&prev.curveOut.checked&&current.curveOut.checked)_diff('Curve-out parfait %',prev.curveOut.perfectPct,current.curveOut.perfectPct,true);
    if(prev.cardAdvantage&&current.cardAdvantage)_diff('Card advantage',prev.cardAdvantage.caScore,current.cardAdvantage.caScore,true);
    if(prev.stackInteraction&&current.stackInteraction)_diff('Stack interaction %',prev.stackInteraction.instantPct,current.stackInteraction.instantPct,true);
    if(prev.velocity&&current.velocity)_diff('Velocity',parseFloat(prev.velocity.velocity),parseFloat(current.velocity.velocity),true);
    return {diffs:diffs,prevTs:prev.timestamp,currentTs:current.timestamp};
  }
  // Stockage du dernier rapport par deck pour comparaison
  function _saveLastReport(deckId,report){
    try{localStorage.setItem('mlapro_last_'+deckId,JSON.stringify({report:report,ts:Date.now()}));}catch(_){}
  }
  function _loadLastReport(deckId){
    try{var raw=localStorage.getItem('mlapro_last_'+deckId);if(raw)return JSON.parse(raw).report;}catch(_){}
    return null;
  }
  // ─── 33b. COMPARE 2 DECKS DISTINCTS (build 96) ─────────────────────────
  // Diff étendu pour comparaison side-by-side entre deux decks distincts
  // (vs compareReports qui compare avant/après le MÊME deck).
  // Retourne une grille richesse de métriques avec verdict A/B/match.
  function compareTwoDecks(reportA,reportB,nameA,nameB){
    if(!reportA||!reportB)return null;
    var rows=[];
    function _row(label,va,vb,unit,higherBetter){
      if(va==null||vb==null)return;
      var win=null;
      if(va!==vb){
        if(higherBetter==null)win='neutral';
        else if(higherBetter)win=va>vb?'A':'B';
        else win=va<vb?'A':'B';
      }
      rows.push({label:label,a:va,b:vb,unit:unit||'',win:win});
    }
    // Bracket (lower = casual, higher = cEDH — pas universellement « mieux »)
    if(reportA.bracket&&reportB.bracket)_row('Bracket',reportA.bracket.bracket,reportB.bracket.bracket,'',null);
    // Plans viables (higher = better)
    if(reportA.redundancy&&reportB.redundancy)_row('Plans viables',reportA.redundancy.count,reportB.redundancy.count,'',true);
    // Robustesse (higher = better)
    if(reportA.robustness&&reportB.robustness)_row('Robustesse',reportA.robustness.score,reportB.robustness.score,'/100',true);
    // Mulligan keepable (higher = better)
    if(reportA.mulligan&&reportB.mulligan&&reportA.mulligan.checked&&reportB.mulligan.checked)_row('Mains keepables',reportA.mulligan.keepablePct,reportB.mulligan.keepablePct,'%',true);
    // Curve out (higher = better)
    if(reportA.curveOut&&reportB.curveOut&&reportA.curveOut.checked&&reportB.curveOut.checked)_row('Curve-out parfait',reportA.curveOut.perfectPct,reportB.curveOut.perfectPct,'%',true);
    // Card advantage (higher = better)
    if(reportA.cardAdvantage&&reportB.cardAdvantage)_row('Card advantage',reportA.cardAdvantage.caScore,reportB.cardAdvantage.caScore,'pts',true);
    // Stack interaction (higher = better — plus de présence)
    if(reportA.stackInteraction&&reportB.stackInteraction)_row('Stack interaction',reportA.stackInteraction.instantPct,reportB.stackInteraction.instantPct,'%',true);
    // Velocity (higher = better — plus de digging)
    if(reportA.velocity&&reportB.velocity)_row('Velocity',parseFloat(reportA.velocity.velocity),parseFloat(reportB.velocity.velocity),'/tour',true);
    // Recovery T post-wrath (lower = better — recover plus vite)
    if(reportA.recovery&&reportB.recovery)_row('Recovery T post-wrath',reportA.recovery.earliestRebuild,reportB.recovery.earliestRebuild,'',false);
    // Inevitability (higher = better)
    if(reportA.inevitability&&reportB.inevitability)_row('Inevitability cards',reportA.inevitability.count,reportB.inevitability.count,'',true);
    // Combos (higher = better selon stratégie)
    if(reportA.combos&&reportB.combos)_row('Combos détectés',reportA.combos.count,reportB.combos.count,'',true);
    // Must-answer threats (higher = better — épuise les réponses adverses)
    if(reportA.mustAnswerThreats&&reportB.mustAnswerThreats)_row('Must-answer threats',reportA.mustAnswerThreats.count,reportB.mustAnswerThreats.count,'',true);
    // Mana T4 max (higher = better — production explosive)
    if(reportA.manaProduction&&reportB.manaProduction)_row('Mana T4 max',reportA.manaProduction.productionByTurn[4],reportB.manaProduction.productionByTurn[4],'',true);
    // Anti-meta coverage (higher = better)
    if(reportA.antiMeta&&reportB.antiMeta)_row('Anti-meta coverage',reportA.antiMeta.coverage,reportB.antiMeta.coverage,'%',true);
    // Removal universal % (higher = better)
    if(reportA.threatsKillableScope&&reportB.threatsKillableScope)_row('Removal universel',reportA.threatsKillableScope.universalPct,reportB.threatsKillableScope.universalPct,'%',true);
    // Synergy orphans (lower = better — moins d'orphelines)
    if(reportA.synergyOrphans&&reportB.synergyOrphans)_row('Synergy orphans',reportA.synergyOrphans.count,reportB.synergyOrphans.count,'',false);
    // Tempo loss (lower = better)
    if(reportA.tempoLoss&&reportB.tempoLoss)_row('Cartes tempo-loss',reportA.tempoLoss.count,reportB.tempoLoss.count,'',false);
    // Densité staples (≤15 créatif, >25 staple-driven — pas universellement mieux)
    if(reportA.edhrecInclusion&&reportB.edhrecInclusion)_row('Densité staples',reportA.edhrecInclusion.density,reportB.edhrecInclusion.density,'%',null);
    // Compute winner global
    var aWins=rows.filter(function(r){return r.win==='A';}).length;
    var bWins=rows.filter(function(r){return r.win==='B';}).length;
    var ties=rows.filter(function(r){return r.win==='neutral'||r.win===null;}).length;
    var globalWinner=aWins>bWins+2?'A':bWins>aWins+2?'B':'close';
    return {
      rows:rows,nameA:nameA||'Deck A',nameB:nameB||'Deck B',
      aWins:aWins,bWins:bWins,ties:ties,globalWinner:globalWinner,
      verdict:globalWinner==='A'?nameA+' domine sur '+aWins+'/'+(aWins+bWins+ties)+' axes':globalWinner==='B'?nameB+' domine sur '+bWins+'/'+(aWins+bWins+ties)+' axes':'Match serré ('+aWins+' vs '+bWins+')'
    };
  }
  function renderCompareTwoDecks(diff){
    if(!diff)return '';
    var h='<div class="anapro-card" style="border-color:rgba(180,140,220,.42);background:linear-gradient(135deg,rgba(180,140,220,.06),rgba(74,160,232,.02))">';
    h+='<div class="anapro-cat" style="color:#b48cdc">🆚 Comparaison '+_esc(diff.nameA)+' vs '+_esc(diff.nameB)+'</div>';
    var verdictCol=diff.globalWinner==='close'?'#f0c84a':'#9ddf8c';
    h+='<div style="font-size:.9rem;color:'+verdictCol+';font-weight:700;margin-bottom:10px">'+_esc(diff.verdict)+'</div>';
    h+='<div style="overflow-x:auto"><table style="width:100%;font-size:.82rem;border-collapse:collapse">';
    h+='<thead><tr style="font-size:.66rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em">'
      +'<th style="text-align:left;padding:6px 8px">Axe</th>'
      +'<th style="text-align:right;padding:6px 8px">'+_esc(diff.nameA)+'</th>'
      +'<th style="text-align:right;padding:6px 8px">'+_esc(diff.nameB)+'</th>'
      +'<th style="text-align:center;padding:6px 8px">Winner</th>'
      +'</tr></thead><tbody>';
    diff.rows.forEach(function(r){
      var aCol=r.win==='A'?'#9ddf8c':'var(--tx)';
      var bCol=r.win==='B'?'#9ddf8c':'var(--tx)';
      var aBold=r.win==='A'?'700':'400';
      var bBold=r.win==='B'?'700':'400';
      var winIco=r.win==='A'?'◀':r.win==='B'?'▶':'=';
      var winCol=r.win==='A'||r.win==='B'?'#9ddf8c':'#7e8696';
      h+='<tr style="border-top:.5px solid var(--bd)">'
        +'<td style="padding:6px 8px;color:var(--tx2)">'+_esc(r.label)+'</td>'
        +'<td style="text-align:right;padding:6px 8px;color:'+aCol+';font-weight:'+aBold+';font-family:var(--ff-mono,monospace)">'+r.a+r.unit+'</td>'
        +'<td style="text-align:right;padding:6px 8px;color:'+bCol+';font-weight:'+bBold+';font-family:var(--ff-mono,monospace)">'+r.b+r.unit+'</td>'
        +'<td style="text-align:center;padding:6px 8px;color:'+winCol+';font-weight:700">'+winIco+'</td>'
        +'</tr>';
    });
    h+='</tbody></table></div>';
    h+='</div>';
    return h;
  }

  // ─── 33c. COMMANDER SPELLBOOK API (build 96) ───────────────────────────
  // Fetch les combos depuis l'API Commander Spellbook + cache localStorage
  // 30 jours. Étend dynamiquement la liste COMBOS sans changer la signature
  // de detectCombos. Fonctionne en best-effort : si API down, garde les 100+
  // combos hardcodés.
  function loadCommanderSpellbookCombos(callback){
    var cacheKey='mlapro_csb_combos';
    var cacheTTL=30*86400000; // 30 jours
    try{
      var raw=localStorage.getItem(cacheKey);
      if(raw){
        var cached=JSON.parse(raw);
        if(cached&&cached.ts&&Date.now()-cached.ts<cacheTTL){
          callback&&callback(cached.combos||[]);
          return;
        }
      }
    }catch(_){}
    // Fetch async (best-effort). L'API renvoie un JSON volumineux ~10 MB.
    // On utilise un endpoint plus léger : variants compactes.
    fetch('https://json.commanderspellbook.com/variants/').then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(data){
      var combos=[];
      // Parser le JSON Commander Spellbook (format variants)
      if(Array.isArray(data)){
        data.slice(0,2000).forEach(function(v){
          if(!v.uses||v.uses.length<2)return;
          var cards=v.uses.map(function(u){return (u.card&&u.card.name||'').toLowerCase();}).filter(Boolean);
          if(cards.length<2)return;
          var result=(v.produces||[]).map(function(p){return p.feature&&p.feature.name||'';}).filter(Boolean).join(', ')||'combo';
          var types=[];
          if(/infinite/i.test(result))types.push('mana');
          if(/damage/i.test(result))types.push('drain','combat');
          if(/draw/i.test(result))types.push('draw');
          if(/mill/i.test(result))types.push('mill');
          if(/win/i.test(result)||/alternate/i.test(result))types.push('alt-win');
          combos.push({
            n:cards.slice(0,2).map(function(c){return c.charAt(0).toUpperCase()+c.slice(1);}).join(' + '),
            cards:cards,
            result:result.slice(0,80),
            mana:v.manaValueNeeded||5,
            turn:Math.min(7,Math.max(3,Math.round((v.manaValueNeeded||5)/1.5))),
            types:types.length?types:['combo']
          });
        });
      }
      try{localStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),combos:combos}));}catch(_){}
      callback&&callback(combos);
    }).catch(function(e){
      console.warn('[Commander Spellbook] fetch failed:',e&&e.message||e);
      callback&&callback([]); // fallback : on garde juste les combos hardcodés
    });
  }
  // Étend COMBOS avec les combos chargés (mutation en place)
  function extendCombosFromCSB(extraCombos){
    if(!Array.isArray(extraCombos)||!extraCombos.length)return 0;
    var existing={};COMBOS.forEach(function(c){existing[c.cards.sort().join('|')]=true;});
    var added=0;
    extraCombos.forEach(function(c){
      var key=c.cards.slice().sort().join('|');
      if(existing[key])return;
      COMBOS.push(c);existing[key]=true;added++;
    });
    return added;
  }

  // ─── 33d. AUTO-DÉTECTION D'ARCHÉTYPE PAR CLUSTERING (build 96) ─────────
  // Score 10 archétypes sur la base de signaux quantifiés. Retourne le top
  // 3 avec confiance. Plus fin que le mapping basé sur winCons.primary.
  function detectArchetype(rows,deck){
    var sig={
      aggro:0,control:0,combo:0,midrange:0,ramp:0,
      voltron:0,stax:0,tribal:0,tokens:0,spellslinger:0,reanimator:0,landfall:0
    };
    var typeCount={creature:0,instant:0,sorcery:0,artifact:0,enchantment:0,planeswalker:0,land:0};
    var cmcSum=0,cmcN=0;var lowCmcCreatures=0,highCmcCreatures=0;
    var counters=0,wraths=0,removalCount=0;
    var tutors=0,combos2Cards=0;
    var anthems=0,tokenGen=0;
    var taxEffects=0,lockPieces=0;
    var instOrSorc=0,spellTriggers=0;
    var graveyardRef=0,reanimEffects=0;
    var landRamp=0,landfallRef=0;
    var typeCluster={};
    var keyword={};
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var cmc=m.cmc||0;var qty=r.qty||1;
      if(/creature/.test(tl)){typeCount.creature+=qty;if(cmc<=2)lowCmcCreatures+=qty;if(cmc>=5)highCmcCreatures+=qty;}
      if(/instant/.test(tl)){typeCount.instant+=qty;instOrSorc+=qty;}
      if(/sorcery/.test(tl)){typeCount.sorcery+=qty;instOrSorc+=qty;}
      if(/artifact/.test(tl))typeCount.artifact+=qty;
      if(/enchantment/.test(tl))typeCount.enchantment+=qty;
      if(/planeswalker/.test(tl))typeCount.planeswalker+=qty;
      if(/land/.test(tl))typeCount.land+=qty;
      else{cmcSum+=cmc*qty;cmcN+=qty;}
      // Type cluster : extrait les sub-types tribaux (Goblin, Elf, etc.)
      var subMatch=tl.match(/—\s*(.+?)(?:\s*\/|$)/);
      if(subMatch){
        var subs=subMatch[1].split(/\s+/);
        subs.forEach(function(s){if(s.length>2)typeCluster[s]=(typeCluster[s]||0)+qty;});
      }
      // Keywords / themes
      if(/counter target spell/.test(ot))counters+=qty;
      if(/destroy all|exile all/.test(ot))wraths+=qty;
      if(/destroy target|exile target/.test(ot))removalCount+=qty;
      if(/search your library for a/.test(ot))tutors+=qty;
      if(/creatures you control get \+|other creatures you control get \+/.test(ot)){anthems+=qty;sig.tokens+=qty;}
      if(/create .* token/.test(ot))tokenGen+=qty;
      if(/skip your.* phase|sacrifice .* unless|lands? don\'t untap|spells.* cost.* more/.test(ot)){taxEffects+=qty;lockPieces+=qty;}
      if(/whenever you cast (a|an) (instant|sorcery)/.test(ot))spellTriggers+=qty;
      if(/from your graveyard|in your graveyard/.test(ot))graveyardRef+=qty;
      if(/return target creature.*graveyard.*battlefield|put target creature.*graveyard.*battlefield/.test(ot))reanimEffects+=qty;
      if(/search your library for a.* land|landfall|whenever a land.* enters/.test(ot)){landRamp+=qty;if(/landfall|whenever a land/.test(ot))landfallRef+=qty;}
    });
    var totalNonLand=cmcN;
    var avgCmc=cmcN?cmcSum/cmcN:0;
    // ─ Scoring par archétype ─
    // Aggro : beaucoup de créatures cheap, low CMC, anthems
    sig.aggro=lowCmcCreatures*2+anthems*3+(avgCmc<3?15:0);
    // Control : counters, wraths, instant speed, high removal
    sig.control=counters*4+wraths*5+typeCount.instant*1.5+(removalCount>=10?15:removalCount);
    // Combo : tutors, low CMC engines, combos détectés
    sig.combo=tutors*5+(avgCmc<3.5?10:0);
    // Midrange : équilibre threats + interaction
    sig.midrange=(typeCount.creature>=20&&typeCount.creature<=30?20:0)+(removalCount>=6?10:0)+(avgCmc>=2.5&&avgCmc<=4?15:0);
    // Ramp : ramp 1-2 CMC + gros payoffs
    sig.ramp=landRamp*2+highCmcCreatures*3;
    // Voltron : 1 commandant + équipements + protection
    sig.voltron=(deck&&deck.commander?15:0)+typeCount.artifact*0.5;
    // Stax : taxes + lock
    sig.stax=taxEffects*5+lockPieces*3;
    // Tribal : forte concentration sur 1 sub-type
    var topTribe=Object.keys(typeCluster).sort(function(a,b){return typeCluster[b]-typeCluster[a];})[0];
    if(topTribe&&typeCluster[topTribe]>=15){sig.tribal=typeCluster[topTribe]*2;}
    // Tokens : générateurs + anthems
    sig.tokens+=tokenGen*3+anthems*4;
    // Spellslinger : instants/sorceries + spell triggers
    sig.spellslinger=instOrSorc*1.5+spellTriggers*8;
    // Reanimator : références cimetière + effets de reanim
    sig.reanimator=graveyardRef*1.5+reanimEffects*4;
    // Landfall : landfall references
    sig.landfall=landfallRef*5+landRamp*1.5;
    // Top 3
    var sorted=Object.keys(sig).map(function(k){return {archetype:k,score:Math.round(sig[k])};}).sort(function(a,b){return b.score-a.score;});
    var primary=sorted[0];
    var confidence=primary&&sorted[1]?Math.min(100,Math.round((primary.score-sorted[1].score)/Math.max(1,primary.score)*100)+40):50;
    return {
      primary:primary,top3:sorted.slice(0,3),confidence:confidence,
      tribalSubtype:topTribe&&typeCluster[topTribe]>=15?{type:topTribe,count:typeCluster[topTribe]}:null,
      verdict:confidence>=70?'✓ Archétype clair : '+primary.archetype:confidence>=50?'~ Profil dominant : '+primary.archetype:'⚠ Archétype hybride / peu cohérent'
    };
  }
  // Rendu HTML pour la card « Diff avant/après »
  function renderDiff(diff){
    if(!diff||!diff.diffs||!diff.diffs.length)return '';
    var h='<div class="anapro-card" style="border-color:rgba(126,200,106,.42);background:linear-gradient(135deg,rgba(126,200,106,.06),rgba(74,160,232,.02))">';
    h+='<div class="anapro-cat" style="color:#9ddf8c">📊 Diff vs analyse précédente</div>';
    h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px">Comparaison automatique avec la dernière analyse de ce deck. Les changements positifs (verts) confirment ton swap, les négatifs (rouges) suggèrent de revenir en arrière.</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">';
    diff.diffs.forEach(function(d){
      var col=d.positive?'#9ddf8c':'#e8847b';
      var arrow=d.delta>0?'▲':'▼';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-left:3px solid '+col+';border-radius:7px">';
      h+='<div style="font-size:.66rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:3px">'+_esc(d.label)+'</div>';
      h+='<div style="display:flex;align-items:baseline;gap:6px">';
      h+='<span style="font-size:.84rem;color:var(--tx3);text-decoration:line-through;font-family:var(--ff-mono,monospace)">'+d.prev+'</span>';
      h+='<span style="font-size:.7rem;color:'+col+'">→</span>';
      h+='<span style="font-size:1rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace)">'+d.current+'</span>';
      h+='<span style="font-size:.74rem;color:'+col+';font-weight:700;margin-left:auto">'+arrow+' '+(d.delta>0?'+':'')+d.delta+'</span>';
      h+='</div>';
      h+='</div>';
    });
    h+='</div>';
    return h;
  }

  // ─── 35. ENABLER / PAYOFF PAIR CHECK (build 100) ───────────────────────
  // Un payoff sans son enabler = brick. Ex. Anointed Procession sans token
  // maker. On scanne par paires connues.
  //
  // Format : {payoff:nameOrRegex, enablers:[regex|name], minEnablers:int, label:string}
  var ENABLER_PAYOFF_PAIRS = [
    // ─── Tokens ───
    {payoff:'anointed procession', enablers:[/create .* token/, /populate/], minEnablers:5, label:'Token doubler sans token makers'},
    {payoff:'parallel lives', enablers:[/create .* token/, /populate/], minEnablers:5, label:'Token doubler sans token makers'},
    {payoff:'doubling season', enablers:[/create .* token/, /\+1\/\+1 counter/, /loyalty/], minEnablers:6, label:'Doubling Season sans tokens/counters/PW'},
    {payoff:'mondrak, glory dominus', enablers:[/create .* token/], minEnablers:5, label:'Mondrak sans token makers'},
    {payoff:'ojer kaslem, deepest growth', enablers:[/create .* token/], minEnablers:4, label:'Ojer Kaslem sans token engine'},
    // ─── +1/+1 counters ───
    {payoff:'hardened scales', enablers:[/\+1\/\+1 counter/], minEnablers:6, label:'Hardened Scales sans payoffs +1/+1'},
    {payoff:'branching evolution', enablers:[/\+1\/\+1 counter/], minEnablers:6, label:'Branching Evolution sans counters'},
    {payoff:'innkeeper\'s talent', enablers:[/\+1\/\+1 counter/, /loyalty/], minEnablers:6, label:'Innkeeper sans counters/loyalty'},
    // ─── Sacrifice (Aristos) ───
    {payoff:'blood artist', enablers:[/sacrifice a creature/, /whenever .* dies/, /aristocrat/], minEnablers:5, label:'Blood Artist sans outlet sacrifice'},
    {payoff:'zulaport cutthroat', enablers:[/sacrifice a creature/, /whenever .* dies/], minEnablers:5, label:'Zulaport sans outlet'},
    {payoff:'mayhem devil', enablers:[/sacrifice/, /create .* treasure/], minEnablers:5, label:'Mayhem Devil sans sac engine'},
    {payoff:'cruel celebrant', enablers:[/sacrifice/, /dies/], minEnablers:5, label:'Cruel Celebrant sans dies/sac'},
    // ─── Landfall ───
    {payoff:'lotus cobra', enablers:[/landfall/, /search your library for a .* land/, /fetch/], minEnablers:8, label:'Lotus Cobra sans density landfall'},
    {payoff:'aesi, tyrant of gyre strait', enablers:[/landfall/, /\bland.*onto the battlefield/], minEnablers:6, label:'Aesi sans landfall density'},
    {payoff:'tatyova, benthic druid', enablers:[/landfall/, /\bland.*onto the battlefield/], minEnablers:6, label:'Tatyova sans landfall density'},
    {payoff:'omnath, locus of creation', enablers:[/landfall/, /\bland.*onto the battlefield/], minEnablers:6, label:'Omnath sans landfall density'},
    {payoff:'avenger of zendikar', enablers:[/landfall/, /\bland.*onto the battlefield/], minEnablers:5, label:'Avenger sans landfall'},
    // ─── Spellslinger ───
    {payoff:'guttersnipe', enablers:[/instant/, /sorcery/], minEnablers:18, label:'Guttersnipe sans spell density'},
    {payoff:'thousand-faced shadow', enablers:[/instant/, /sorcery/], minEnablers:15, label:'TFS sans spell density'},
    {payoff:'young pyromancer', enablers:[/instant/, /sorcery/], minEnablers:15, label:'Young Pyro sans spell density'},
    {payoff:'storm-kiln artist', enablers:[/instant/, /sorcery/], minEnablers:15, label:'Storm-Kiln sans spells'},
    // ─── Lifegain ───
    {payoff:'aetherflux reservoir', enablers:[/gain .* life/, /lifelink/], minEnablers:8, label:'Aetherflux sans lifegain'},
    {payoff:'sanguine bond', enablers:[/gain .* life/], minEnablers:8, label:'Sanguine Bond sans lifegain'},
    {payoff:'exquisite blood', enablers:[/loses? \d+ life/, /opponent loses? life/, /drain/], minEnablers:6, label:'Exquisite Blood sans drain'},
    // ─── Graveyard ───
    {payoff:'underworld breach', enablers:[/instant/, /sorcery/, /mill/], minEnablers:15, label:'UW Breach sans spells/mill'},
    {payoff:'muldrotha, the gravetide', enablers:[/return target.*from your graveyard/, /mill/, /dredge/], minEnablers:8, label:'Muldrotha sans self-mill'},
    {payoff:'meren of clan nel toth', enablers:[/sacrifice a creature/, /dies/], minEnablers:8, label:'Meren sans dies/sac'},
    // ─── Treasure ───
    {payoff:'smothering tithe', enablers:[], minEnablers:0, label:''}, // auto-fonctionnel
    {payoff:'goldspan dragon', enablers:[/treasure token/, /create a treasure/], minEnablers:5, label:'Goldspan sans treasure engine'},
    {payoff:'hellkite tyrant', enablers:[/artifact/], minEnablers:12, label:'Hellkite Tyrant sans artifacts'},
    // ─── Discard / wheel ───
    {payoff:'waste not', enablers:[/each opponent discards/, /target opponent discards/, /wheel/], minEnablers:5, label:'Waste Not sans discard'},
    {payoff:'liliana of the veil', enablers:[/discard/, /madness/], minEnablers:6, label:'Liliana sans discard payoffs'},
    // ─── Equipment / Voltron ───
    {payoff:'sigarda\'s aid', enablers:[/equipment/, /aura/], minEnablers:8, label:'Sigarda\'s Aid sans equip/aura'},
    {payoff:'puresteel paladin', enablers:[/equipment/], minEnablers:8, label:'Puresteel sans equipment'},
    // ─── Storm / Spells matter ───
    {payoff:'aetherflux reservoir', enablers:[/instant/, /sorcery/], minEnablers:18, label:'Aetherflux storm sans spells'},
    // ─── Mill self ───
    {payoff:'syr konrad, the grim', enablers:[/mill/, /from your library.*graveyard/, /discard/], minEnablers:6, label:'Syr Konrad sans mill/discard'}
  ];
  function enablerPayoffPairs(rows){
    var set=_cardSet(rows);
    var issues=[];
    var passed=[];
    ENABLER_PAYOFF_PAIRS.forEach(function(pair){
      if(!set[pair.payoff])return; // payoff pas dans le deck → no-op
      if(pair.minEnablers===0){passed.push({payoff:pair.payoff,reason:'autosuffisant'});return;}
      var count=0;
      rows.forEach(function(r){
        var m=r.meta||{};
        var ot=(m.oracleText||'').toLowerCase();
        var nl=_nlOf(r.card&&r.card.name||r.name);
        if(nl===pair.payoff)return; // ne pas compter le payoff lui-même
        pair.enablers.forEach(function(en){
          if(en instanceof RegExp){if(en.test(ot))count+=(r.qty||1);}
          else if(typeof en==='string'){if(nl===en||ot.indexOf(en)>=0)count+=(r.qty||1);}
        });
      });
      if(count<pair.minEnablers){
        issues.push({payoff:pair.payoff,label:pair.label,enablersFound:count,minRequired:pair.minEnablers,gap:pair.minEnablers-count});
      }else{
        passed.push({payoff:pair.payoff,enablersFound:count,minRequired:pair.minEnablers});
      }
    });
    return {
      issues:issues, passed:passed,
      verdict:issues.length===0?'✓ Tous tes payoffs ont assez d\'enablers':issues.length<=2?'~ '+issues.length+' payoff(s) sous-équipé(s)':'⚠ '+issues.length+' payoffs sans support — cartes mortes en main'
    };
  }

  // ─── 36. TURN-TO-KILL ESTIMATION (build 100) ───────────────────────────
  // Combien de tours pour passer 40 dommages commander OU 120 PV totaux ?
  // Approche : moyenne pondérée des dommages combat + burn/drain.
  function turnToKill(rows,winConsReport){
    var creatures=[];var burnDmg=0,drainPerTurn=0;
    var anthems=0,evasionCreatures=0;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var qty=r.qty||1;
      if(/creature/.test(tl)){
        var p=parseInt(m.power||'0',10)||0;
        var cmc=m.cmc||0;
        var hasEvasion=/flying|menace|unblockable|trample|shadow|horsemanship|fear|intimidate|can't be blocked/.test(ot);
        for(var i=0;i<qty;i++)creatures.push({power:p,cmc:cmc,evasion:hasEvasion});
        if(hasEvasion)evasionCreatures+=qty;
      }
      // Burn ponctuel
      var bm=ot.match(/deals? (\d+) damage to (any target|target player|target opponent|each opponent)/);
      if(bm){burnDmg+=parseInt(bm[1],10)*qty;}
      // Drain par tour (engine)
      if(/at the beginning of .* upkeep .* loses? (\d+) life|each opponent loses? (\d+) life/.test(ot)){
        var dm=ot.match(/loses? (\d+) life/);if(dm)drainPerTurn+=parseInt(dm[1],10)*qty;
      }
      // Anthems
      if(/creatures you control get \+(\d)/.test(ot)){
        var am=ot.match(/get \+(\d)/);if(am)anthems+=parseInt(am[1],10);
      }
    });
    creatures.sort(function(a,b){return a.cmc-b.cmc;});
    // Sim simple : on suppose drop 1 créature/tour à partir du CMC, attaque dès que possible
    // Cible 40 PV (commander) ; on calcule tour où on dépasse 40 cumul.
    var dmgPerTurn=[0,0,0,0,0,0,0,0,0,0,0,0,0]; // T0-T12
    var creaturesOnBoard=[];
    for(var t=1;t<=12;t++){
      // Ajoute les créatures castables ce tour (cmc<=t)
      while(creatures.length&&creatures[0].cmc<=t){
        creaturesOnBoard.push(creatures.shift());
      }
      // Attaque à T+1 (summoning sickness) — on simplifie : attaque dès T (haste implicite)
      var turnDmg=0;
      creaturesOnBoard.forEach(function(c){
        // Coefficient évasion : 0.9 (passe presque toujours) vs 0.45 (chip-block)
        var coef=c.evasion?0.9:0.45;
        turnDmg+=(c.power+anthems)*coef;
      });
      turnDmg+=drainPerTurn;
      dmgPerTurn[t]=turnDmg;
    }
    // Cumul
    var cum=0;var turnTo40=null;var turnTo120=null;
    for(var tt=1;tt<=12;tt++){
      cum+=dmgPerTurn[tt];
      if(turnTo40===null&&(cum+burnDmg)>=40)turnTo40=tt;
      if(turnTo120===null&&(cum*3+burnDmg)>=120)turnTo120=tt; // 3 adversaires
    }
    // Plans non-combat : pas pertinent
    var primaryKind=winConsReport&&winConsReport.primary?winConsReport.primary.kind:null;
    if(primaryKind==='alt-win'||primaryKind==='combo')return {checked:false,reason:'plan alt-win — turn-to-kill non pertinent'};
    var verdict;
    if(!turnTo40)verdict='⚠ Plus de 12 tours pour kill commander — pas de pression';
    else if(turnTo40<=5)verdict='✓ Kill commander rapide (T'+turnTo40+')';
    else if(turnTo40<=8)verdict='~ Kill commander moyen (T'+turnTo40+')';
    else verdict='⚠ Kill commander lent (T'+turnTo40+') — vulnérable aux wraths';
    return {
      checked:true,
      turnTo40:turnTo40, turnTo120:turnTo120,
      burnDirectDmg:burnDmg, drainPerTurn:drainPerTurn,
      evasionCreatures:evasionCreatures, anthemBonus:anthems,
      verdict:verdict
    };
  }

  // ─── 37. INTERNAL SABOTAGE (build 100) ─────────────────────────────────
  // Détecte les paires de cartes qui se torpillent l'une l'autre.
  // C'est ce qui différencie un brewer débutant d'un pro.
  var SABOTAGE_PAIRS = [
    {a:'smothering tithe', b:'hullbreacher', msg:'Smothering Tithe + Hullbreacher : Hullbreacher empêche les adversaires de draw donc moins de treasures pour Tithe'},
    {a:'narset, parter of veils', b:'wheel of fortune', msg:'Narset + wheels : Narset coupe tes propres wheels (tu ne piocheras qu\'une carte)'},
    {a:'narset, parter of veils', b:'windfall', msg:'Narset + Windfall : tu cap à 1 carte au lieu de full hand'},
    {a:'sensei\'s divining top', b:'wheel of fortune', msg:'Sensei\'s Top + wheels : tu te shuffles ton top dans la lib'},
    {a:'sensei\'s divining top', b:'windfall', msg:'Sensei\'s Top + Windfall : ton top va dans la lib shufflée'},
    {a:'necropotence', b:'rhystic study', msg:'Necropotence + Rhystic Study : Necro skip ta draw step, donc Rhystic ne déclenche pas pour TES cartes piochées'},
    {a:'rest in peace', b:'underworld breach', msg:'Rest in Peace + Underworld Breach : Breach inutile sans graveyard'},
    {a:'rest in peace', b:'muldrotha, the gravetide', msg:'Rest in Peace exile graveyard → Muldrotha n\'a rien à recaster'},
    {a:'leyline of the void', b:'underworld breach', msg:'Leyline of the Void exile → Breach inutile'},
    {a:'leyline of the void', b:'meren of clan nel toth', msg:'Leyline of the Void exile → Meren ne peut rien return'},
    {a:'grafdigger\'s cage', b:'underworld breach', msg:'Grafdigger\'s Cage bloque tes Breach casts'},
    {a:'grafdigger\'s cage', b:'demonic tutor', msg:'Grafdigger\'s Cage bloque les tutors (tu peux pas play depuis lib)... ah non Grafdigger ne bloque que play depuis grave/lib, tutor reste OK'},
    {a:'stony silence', b:'sol ring', msg:'Stony Silence stop tes propres mana rocks (incluant Sol Ring)'},
    {a:'stony silence', b:'arcane signet', msg:'Stony Silence éteint tes signets'},
    {a:'collector ouphe', b:'sol ring', msg:'Collector Ouphe éteint tes mana rocks'},
    {a:'collector ouphe', b:'arcane signet', msg:'Collector Ouphe éteint tes signets'},
    {a:'null rod', b:'sol ring', msg:'Null Rod éteint tes mana rocks (incluant Sol Ring)'},
    {a:'null rod', b:'arcane signet', msg:'Null Rod éteint tes signets'},
    {a:'blood moon', b:'command tower', msg:'Blood Moon transforme Command Tower en montagne (multicolor cassé)'},
    {a:'back to basics', b:'command tower', msg:'Back to Basics tap tes nonbasics (Command Tower tapée)'},
    {a:'ashiok, dream render', b:'demonic tutor', msg:'Ashiok exile tes lib quand tu tutor (à vérifier wording mais peut interférer)'},
    {a:'opposition agent', b:'demonic tutor', msg:'Opposition Agent vole les tutors adverses, OK — mais attention si plusieurs autour de la table avec tutors'}, // info, pas vraiment sabotage
    {a:'jin-gitaxias, core augur', b:'rhystic study', msg:'Jin-Gitaxias adversaires défaussent jusqu\'à 7 → Rhystic moins de triggers'},
    {a:'notion thief', b:'wheel of fortune', msg:'Notion Thief + Wheel : tu pioches les leurs, mais pas la tienne (tu défausses puis 0 pioche)'},
    {a:'hullbreacher', b:'wheel of fortune', msg:'Hullbreacher + ta propre Wheel : tu défausses puis 0 pioche, juste treasures'}
  ];
  function internalSabotage(rows){
    var set=_cardSet(rows);
    var conflicts=[];
    SABOTAGE_PAIRS.forEach(function(p){
      if(set[p.a]&&set[p.b]){
        conflicts.push({a:p.a,b:p.b,msg:p.msg});
      }
    });
    return {
      conflicts:conflicts,count:conflicts.length,
      verdict:conflicts.length===0?'✓ Aucun sabotage interne détecté':conflicts.length<=2?'~ '+conflicts.length+' synergie(s) négative(s) à vérifier':'⚠ '+conflicts.length+' conflits internes — ton deck se nuit à lui-même'
    };
  }

  // ─── 38. TABLE THREAT LEVEL (build 101) ────────────────────────────────
  // 3 dimensions :
  //  1. Critical-path concentration : combien de cartes uniques portent ton plan A ?
  //     2-3 = fragile (un removal te tue). 6+ = résilient.
  //  2. Commandant menaçant (attire wrath/haine) → vrai en mid game.
  //  3. Plan lisible (combo T3-T4 obvious) → tu prends la disruption.
  var HATE_COMMANDERS = [
    'atraxa, praetors\' voice','atraxa, grand unifier','krenko, mob boss',
    'yuriko, the tiger\'s shadow','sheoldred, the apocalypse','urza, lord high artificer',
    'kinnan, bonder prodigy','najeela, the blade-blossom','thrasios, triton hero',
    'tymna the weaver','tergrid, god of fright','winota, joiner of forces',
    'edgar markov','prosper, tome-bound','grand arbiter augustin iv','derevi, empyrial tactician',
    'narset, enlightened master','hokori, dust drinker','korvold, fae-cursed king',
    'animar, soul of elements','god-eternal kefnet','breya, etherium shaper'
  ];
  function tableThreatLevel(rows,deck,winConsReport,combosReport){
    // 1. Concentration critical path
    // Heuristique : on prend les combos détectés + les win-cons "alt-win"
    // Si <=4 cartes uniques portent le plan → fragile
    var criticalCards={};
    if(combosReport&&combosReport.combos){
      combosReport.combos.forEach(function(c){
        (c.cards||[]).forEach(function(n){criticalCards[n]=true;});
      });
    }
    // Inevitabilities et must-answer comptent comme critical path
    var altWinSet={};
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      // Alt-wins comptent forcément
      if(['thassa\'s oracle','laboratory maniac','jace, wielder of mysteries','approach of the second sun','aetherflux reservoir','helix pinnacle','simic ascendancy','revel in riches'].indexOf(nl)>=0){
        criticalCards[nl]=true;altWinSet[nl]=true;
      }
    });
    var criticalCount=Object.keys(criticalCards).length;
    // 2. Commandant menaçant
    var cmdName=deck&&deck.commander&&deck.commander.name?_nlOf(deck.commander.name):null;
    var commanderIsThreat=cmdName&&HATE_COMMANDERS.indexOf(cmdName)>=0;
    // 3. Plan lisible — combo T3-T4 obvious ?
    var earlyComboObvious=false;
    if(combosReport&&combosReport.combos){
      combosReport.combos.forEach(function(c){
        if(c.turn&&c.turn<=4)earlyComboObvious=true;
      });
    }
    // Scoring
    var fragility=criticalCount===0?0:criticalCount<=3?80:criticalCount<=5?50:25;
    var hateMagnet=(commanderIsThreat?40:0)+(earlyComboObvious?30:0);
    // Verdict synthétique
    var msgs=[];
    if(criticalCount>0&&criticalCount<=3){
      msgs.push('Fragile : seulement '+criticalCount+' carte(s) uniques portent ton plan A — 1 disruption te tue');
    }else if(criticalCount>=6){
      msgs.push('Résilient : '+criticalCount+' cartes portent le plan → diversifié');
    }
    if(commanderIsThreat){
      msgs.push('Commandant "hate magnet" : attendez-vous au wrath mid-game');
    }
    if(earlyComboObvious){
      msgs.push('Combo T3-T4 lisible : adversaires sauront vous disrupter');
    }
    if(!msgs.length)msgs.push('Deck équilibré — pas de profil "menace évidente" ni "fragile"');
    var levelLabel;
    if(fragility>=70||hateMagnet>=50)levelLabel='⚠ Profil à risque';
    else if(fragility>=40||hateMagnet>=30)levelLabel='~ Profil modéré';
    else levelLabel='✓ Profil discret / résilient';
    return {
      criticalCardCount:criticalCount,
      criticalCards:Object.keys(criticalCards),
      commanderIsThreat:commanderIsThreat,
      earlyComboObvious:earlyComboObvious,
      fragilityScore:fragility,
      hateMagnetScore:hateMagnet,
      messages:msgs,
      verdict:levelLabel
    };
  }

  // ─── 39. SIMULATED GAME METRICS (build 102) ────────────────────────────
  // Simule 50 parties partielles (T1-T10) avec une state machine simplifiée :
  //  - mulligan à 7 si moins de 2-5 lands
  //  - draw step + land drop chaque tour
  //  - cast la plus grosse carte affordable chaque tour (priorité ramp/draw)
  //  - track : tour de premier commandant cast, tour de premier win-con visible,
  //            tour de stabilisation (5+ mana disponibles), proba d'avoir touché
  //            certaines cartes-clés à T5/T7.
  function simulatedGameMetrics(rows,deck){
    var library=[];
    var keyCards={};
    rows.forEach(function(r){
      var qty=r.qty||1;var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var cmc=Math.max(0,Math.floor(m.cmc||0));
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var isLand=/land/.test(tl);
      var isRamp=!isLand&&/add (one|two|three) mana|search your library for a.* land|\{t\}.*add.*\{[wubrgc]\}/.test(ot);
      var isDraw=!isLand&&/draw .* cards?/.test(ot);
      var isWincon=['thassa\'s oracle','approach of the second sun','aetherflux reservoir','craterhoof behemoth','triumph of the hordes','expropriate','jin-gitaxias, core augur'].indexOf(nl)>=0;
      var isCmd=deck&&deck.commander&&_nlOf(deck.commander.name)===nl;
      for(var i=0;i<qty;i++){
        library.push({
          name:nl,cmc:cmc,isLand:isLand,isRamp:isRamp,isDraw:isDraw,isWincon:isWincon
        });
      }
      if(isWincon)keyCards[nl]='wincon';
    });
    if(library.length<60)return {checked:false,reason:'Deck incomplet ('+library.length+' cartes)'};
    // PRNG mulberry32
    function mkRand(seed){var s=seed|0;return function(){s|=0;s=s+0x6D2B79F5|0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
    function shuffle(arr,rnd){
      var a=arr.slice();
      for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
      return a;
    }
    var sims=50;
    var stats={
      sampleSize:sims,
      avgCmdTurn:0,cmdHits:0,
      avgFirstWinconTurn:0,winconHits:0,
      avgT5Cards:0,avgT5Mana:0,
      avgT7Mana:0,
      mulligansTaken:0,
      keepableMulligans:0,
      avgStabilizeTurn:0,stabHits:0,
      avgFirstRampTurn:0,rampHits:0
    };
    var hasCommander=deck&&deck.commander&&deck.commander.name;
    var cmdName=hasCommander?_nlOf(deck.commander.name):null;
    var cmdCmc=hasCommander?(deck.commander.cmc||4):4;
    for(var sim=0;sim<sims;sim++){
      var rnd=mkRand(sim*7919+13);
      // Mulligan: garde si ≥2 et ≤5 lands sur 7
      var hand=null;var deckRem=null;var mulls=0;
      for(var att=0;att<3;att++){
        var shuf=shuffle(library,rnd);
        hand=shuf.slice(0,7);
        var landCt=hand.filter(function(c){return c.isLand;}).length;
        if(landCt>=2&&landCt<=5){
          deckRem=shuf.slice(7);break;
        }
        mulls++;
      }
      if(!deckRem){var shuf2=shuffle(library,rnd);hand=shuf2.slice(0,7-mulls);deckRem=shuf2.slice(7-mulls);}
      stats.mulligansTaken+=mulls;
      if(mulls===0)stats.keepableMulligans++;
      // Game loop T1-T10
      var manaAvail=0;var landsPlayed=0;
      var firstRamp=null,firstWincon=null,cmdCastTurn=null,stabilizeTurn=null;
      var t5Cards=0,t5Mana=0,t7Mana=0;
      for(var t=1;t<=10;t++){
        // Draw
        if(t>1&&deckRem.length){hand.push(deckRem.shift());}
        // Land drop
        var landIdx=hand.findIndex(function(c){return c.isLand;});
        if(landIdx>=0){hand.splice(landIdx,1);landsPlayed++;}
        manaAvail=landsPlayed;
        // Casts (priorité ramp T1-T3, puis draw, puis commander)
        var castsThisTurn=0;
        for(var pass=0;pass<3;pass++){
          // Tente ramp en priorité au T1-T3
          var rIdx=-1;
          if(t<=3){
            rIdx=hand.findIndex(function(c){return c.isRamp&&c.cmc<=manaAvail;});
            if(rIdx>=0&&firstRamp===null)firstRamp=t;
          }
          // Sinon draw
          if(rIdx<0)rIdx=hand.findIndex(function(c){return c.isDraw&&c.cmc<=manaAvail;});
          // Sinon plus grosse carte affordable
          if(rIdx<0){
            var bestCmc=-1;
            hand.forEach(function(c,i){if(!c.isLand&&c.cmc<=manaAvail&&c.cmc>bestCmc){bestCmc=c.cmc;rIdx=i;}});
          }
          if(rIdx<0)break;
          var castCard=hand[rIdx];
          if(castCard.isWincon&&firstWincon===null)firstWincon=t;
          if(hasCommander&&castCard.name===cmdName&&cmdCastTurn===null)cmdCastTurn=t;
          manaAvail-=castCard.cmc;
          if(castCard.isRamp){manaAvail+=1;} // simu : ramp donne +1 mana ce tour
          hand.splice(rIdx,1);castsThisTurn++;
        }
        // Stabilize : 5+ mana ET au moins 1 engine ou 1 board
        if(stabilizeTurn===null&&landsPlayed>=5)stabilizeTurn=t;
        if(t===5){t5Cards=hand.length;t5Mana=landsPlayed;}
        if(t===7){t7Mana=landsPlayed;}
        // Cast commander si pas encore et castable
        if(hasCommander&&cmdCastTurn===null&&manaAvail>=cmdCmc){
          cmdCastTurn=t;manaAvail-=cmdCmc;
        }
      }
      stats.avgT5Cards+=t5Cards;stats.avgT5Mana+=t5Mana;stats.avgT7Mana+=t7Mana;
      if(firstRamp){stats.avgFirstRampTurn+=firstRamp;stats.rampHits++;}
      if(firstWincon){stats.avgFirstWinconTurn+=firstWincon;stats.winconHits++;}
      if(cmdCastTurn){stats.avgCmdTurn+=cmdCastTurn;stats.cmdHits++;}
      if(stabilizeTurn){stats.avgStabilizeTurn+=stabilizeTurn;stats.stabHits++;}
    }
    function avg(s,n){return n?Math.round((s/n)*10)/10:null;}
    stats.avgT5Cards=avg(stats.avgT5Cards,sims);
    stats.avgT5Mana=avg(stats.avgT5Mana,sims);
    stats.avgT7Mana=avg(stats.avgT7Mana,sims);
    stats.avgFirstRampTurn=avg(stats.avgFirstRampTurn,stats.rampHits);
    stats.avgFirstWinconTurn=avg(stats.avgFirstWinconTurn,stats.winconHits);
    stats.avgCmdTurn=avg(stats.avgCmdTurn,stats.cmdHits);
    stats.avgStabilizeTurn=avg(stats.avgStabilizeTurn,stats.stabHits);
    stats.cmdHitPct=Math.round(stats.cmdHits/sims*100);
    stats.winconHitPct=Math.round(stats.winconHits/sims*100);
    stats.rampHitPct=Math.round(stats.rampHits/sims*100);
    stats.keepableMulliganPct=Math.round(stats.keepableMulligans/sims*100);
    // Verdict
    var verdict;
    if(stats.avgCmdTurn&&stats.avgCmdTurn<=cmdCmc+1&&stats.avgFirstWinconTurn&&stats.avgFirstWinconTurn<=7)verdict='✓ Setup rapide — commandant T'+stats.avgCmdTurn+', wincon visible T'+stats.avgFirstWinconTurn;
    else if(stats.avgCmdTurn&&stats.avgCmdTurn<=cmdCmc+2)verdict='~ Setup correct — commandant T'+stats.avgCmdTurn;
    else verdict='⚠ Setup lent — commandant T'+(stats.avgCmdTurn||'∞')+' en moyenne';
    return {
      checked:true,
      sampleSize:sims,
      avgCmdTurn:stats.avgCmdTurn,cmdHitPct:stats.cmdHitPct,
      avgFirstWinconTurn:stats.avgFirstWinconTurn,winconHitPct:stats.winconHitPct,
      avgT5Mana:stats.avgT5Mana,avgT5Cards:stats.avgT5Cards,avgT7Mana:stats.avgT7Mana,
      avgFirstRampTurn:stats.avgFirstRampTurn,rampHitPct:stats.rampHitPct,
      avgStabilizeTurn:stats.avgStabilizeTurn,
      keepableMulliganPct:stats.keepableMulliganPct,
      avgMulligansTaken:Math.round(stats.mulligansTaken/sims*10)/10,
      verdict:verdict
    };
  }

  // ─── 41. HAND EVALUATION (build 103) ───────────────────────────────────
  // Sample 3 mains representatives + score 0-100 par main avec verdict.
  // Score = lands*8 + ramp_2cmc*10 + interaction*8 + drawEngine*12 + curve_smooth*15
  function _scoreHand(hand,deck){
    var lands=0,ramp1=0,ramp2=0,ramp3plus=0,interact=0,drawEng=0,cmd=0,bombs=0;
    var cmcs=[];
    var hasCmd=deck&&deck.commander&&deck.commander.name;
    var cmdName=hasCmd?_nlOf(deck.commander.name):null;
    hand.forEach(function(c){
      cmcs.push(c.cmc);
      if(c.isLand)lands++;
      else if(c.isRamp){if(c.cmc<=1)ramp1++;else if(c.cmc===2)ramp2++;else ramp3plus++;}
      else if(c.isInteract)interact++;
      else if(c.isDraw)drawEng++;
      if(cmdName&&c.name===cmdName)cmd++;
      if(c.cmc>=6)bombs++;
    });
    var score=0;
    score+=Math.min(40,lands*8);
    score+=ramp1*12+ramp2*10+ramp3plus*4;
    score+=Math.min(24,interact*8);
    score+=Math.min(24,drawEng*12);
    if(cmd>0)score+=10;
    score-=Math.max(0,bombs-1)*8; // 2+ bombs = brick
    if(lands<2||lands>5)score=Math.max(0,score-25); // mauvaise main mana
    // Lissage courbe : variance des CMC < 4 = bonus
    var avgCmc=cmcs.reduce(function(s,c){return s+c;},0)/cmcs.length;
    var variance=cmcs.reduce(function(s,c){return s+(c-avgCmc)*(c-avgCmc);},0)/cmcs.length;
    if(variance<=2.5)score+=10;
    return Math.max(0,Math.min(100,Math.round(score)));
  }
  function _handVerdict(score,lands){
    if(score>=70)return {label:'✓ Keep — main de qualité',col:'#9ddf8c'};
    if(score>=50)return {label:'~ Keep marginal — possible mull to 6',col:'#f0c84a'};
    if(lands<2||lands>5)return {label:'⚠ Mull — mauvaise distribution lands ('+lands+')',col:'#e8847b'};
    return {label:'⚠ Mull to 6 — main faible',col:'#e8847b'};
  }
  function _handReasons(hand,score){
    var reasons=[];
    var lands=hand.filter(function(c){return c.isLand;}).length;
    var ramp=hand.filter(function(c){return c.isRamp;}).length;
    var interact=hand.filter(function(c){return c.isInteract;}).length;
    var drawEng=hand.filter(function(c){return c.isDraw;}).length;
    if(lands>=3&&lands<=4)reasons.push({txt:'✓ Manabase équilibrée ('+lands+' lands)',col:'#9ddf8c'});
    else if(lands<2)reasons.push({txt:'⚠ Trop peu de lands ('+lands+')',col:'#e8847b'});
    else if(lands>5)reasons.push({txt:'⚠ Flood (lands '+lands+')',col:'#e8847b'});
    if(ramp>=1)reasons.push({txt:'✓ Ramp early présent',col:'#9ddf8c'});
    else reasons.push({txt:'~ Pas de ramp',col:'#f0c84a'});
    if(interact>=1)reasons.push({txt:'✓ Interaction ('+interact+')',col:'#9ddf8c'});
    else reasons.push({txt:'~ Pas d\'interaction',col:'#f0c84a'});
    if(drawEng>=1)reasons.push({txt:'✓ Engine draw présent',col:'#9ddf8c'});
    return reasons;
  }
  function handEvaluation(rows,deck){
    var library=[];
    rows.forEach(function(r){
      var qty=r.qty||1;var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();var ot=(m.oracleText||'').toLowerCase();
      var cmc=Math.max(0,Math.floor(m.cmc||0));
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var isLand=/land/.test(tl);
      var isRamp=!isLand&&/add (one|two|three) mana|search your library for a.* land|\{t\}.*add.*\{[wubrgc]\}/.test(ot);
      var isDraw=!isLand&&/draw .* cards?/.test(ot);
      var isInteract=!isLand&&/destroy target|exile target|counter target|return target.*to.*hand/.test(ot);
      for(var i=0;i<qty;i++){
        library.push({name:nl,cmc:cmc,isLand:isLand,isRamp:isRamp,isDraw:isDraw,isInteract:isInteract});
      }
    });
    if(library.length<60)return {checked:false,reason:'Deck incomplet'};
    function mkRand(seed){var s=seed|0;return function(){s|=0;s=s+0x6D2B79F5|0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
    function shuffle(arr,rnd){
      var a=arr.slice();
      for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
      return a;
    }
    // Sample 100 mains, garde best/median/worst
    var samples=[];
    for(var sim=0;sim<100;sim++){
      var rnd=mkRand(sim*1009+3);
      var shuf=shuffle(library,rnd);
      var hand=shuf.slice(0,7);
      var score=_scoreHand(hand,deck);
      samples.push({hand:hand,score:score});
    }
    samples.sort(function(a,b){return b.score-a.score;});
    var best=samples[0];
    var median=samples[50];
    var worst=samples[99];
    function _formatHand(sample){
      var lands=sample.hand.filter(function(c){return c.isLand;}).length;
      var verdict=_handVerdict(sample.score,lands);
      return {
        score:sample.score,
        lands:lands,
        verdict:verdict,
        reasons:_handReasons(sample.hand,sample.score),
        cards:sample.hand.map(function(c){return {name:c.name,cmc:c.cmc,isLand:c.isLand,isRamp:c.isRamp,isDraw:c.isDraw,isInteract:c.isInteract};})
      };
    }
    var avgScore=Math.round(samples.reduce(function(s,x){return s+x.score;},0)/samples.length);
    var keepablePct=Math.round(samples.filter(function(s){return s.score>=50;}).length/samples.length*100);
    return {
      checked:true,
      avgScore:avgScore,
      keepablePct:keepablePct,
      best:_formatHand(best),
      median:_formatHand(median),
      worst:_formatHand(worst),
      verdict:avgScore>=65?'✓ Mains moyennes solides ('+avgScore+'/100, '+keepablePct+'% gardables)':avgScore>=50?'~ Mains correctes ('+avgScore+'/100, '+keepablePct+'% gardables)':'⚠ Mains faibles ('+avgScore+'/100) — manabase ou répartition à revoir'
    };
  }

  // ─── 42. POLITIQUE MULTIJOUEUR (build 103) ─────────────────────────────
  // 3 axes : threat-deal density, goad/redirect, pillow-fort.
  // Pertinent uniquement formats multijoueur (commander).
  var PILLOW_FORT_CARDS = [
    'propaganda','ghostly prison','sphere of safety','dissipation field',
    'no mercy','windborn muse','crawlspace','silent arbiter','meekstone',
    'norn\'s annex','aura of silence','mystic barrier','isperia\'s tutelage',
    'baird, steward of argive','michiko konda, truth seeker','solitary confinement',
    'maze of ith','glacial chasm','peacekeeper','moat','teferi\'s protection',
    'arcane lighthouse','homeward path','reverse the sands','divine deflection',
    'shahrazad'
  ];
  var KINGMAKER_CARDS = [
    'edric, spymaster of trest','wedding ring','illicit auction',
    'donate','captive audience','keiga, the tide star','akroma\'s memorial donate',
    'puca\'s mischief','homeward path','propaganda donation','treacherous link',
    'forbidden orchard','tempting wurm','vow of duty','vow of flight','vow of malice','vow of lightning','vow of wildness'
  ];
  var GOAD_REDIRECT_CARDS = [
    'agitator ant','disrupt decorum','grenzo, havoc raiser','goad','propaganda',
    'arcane lighthouse','marisi, breaker of the coil','kardur, doomscourge',
    'frenzied saddlebrute','keep watch','curse of disturbance','curse of opulence',
    'curse of vengeance','curse of misfortunes','grand melee'
  ];
  function politicsMultiplayer(rows,deck){
    var fmt=(deck&&deck.format||'').toLowerCase();
    var isMulti=fmt==='commander'||fmt==='paupercmd'||fmt==='brawl'||fmt==='oathbreaker';
    if(!isMulti)return {checked:false,reason:'Format mono-adversaire'};
    var set=_cardSet(rows);
    var pf=PILLOW_FORT_CARDS.filter(function(n){return set[n];});
    var km=KINGMAKER_CARDS.filter(function(n){return set[n];});
    var gr=GOAD_REDIRECT_CARDS.filter(function(n){return set[n];});
    var pfScore=pf.length>=3?'fort':pf.length>=1?'modéré':'aucun';
    var politicalSignals=pf.length+km.length+gr.length;
    var verdict;
    if(politicalSignals===0)verdict='⚠ Deck purement aggro — aucune dimension politique (deals/goad/pillow-fort)';
    else if(politicalSignals<=3)verdict='~ Signal politique léger ('+politicalSignals+' cartes)';
    else verdict='✓ Deck politique armé ('+politicalSignals+' outils sociaux)';
    return {
      checked:true,
      pillowFort:pf,
      kingmaker:km,
      goadRedirect:gr,
      pillowFortScore:pfScore,
      totalPoliticalCards:politicalSignals,
      verdict:verdict
    };
  }

  // ─── 43. COACHING SYNERGY-AWARE (build 103) ────────────────────────────
  // Utilise les données EDHrec (synergy par carte avec ce commandant) pour
  // dire : "Cette carte vaut X avec [Cmd] alors qu'elle vaut Y en général".
  // Async — appelle EDHrec, callback.
  function coachSynergyAware(rows,deck,callback){
    if(!deck||!deck.commander||!deck.commander.name){callback&&callback({checked:false,reason:'Pas de commandant'});return;}
    if(typeof window.mlEdhrecFetch!=='function'){callback&&callback({checked:false,reason:'Module EDHrec non chargé'});return;}
    var cmdName=deck.commander.name;
    window.mlEdhrecFetch(cmdName,function(err,data){
      if(err||!data){callback&&callback({checked:false,reason:'EDHrec indisponible'});return;}
      var synergyMap={};
      try{
        var cardlists=(data.container&&data.container.json_dict&&data.container.json_dict.cardlists)||[];
        cardlists.forEach(function(list){
          (list.cardviews||[]).forEach(function(cv){
            if(cv.name)synergyMap[_nlOf(cv.name)]={synergy:cv.synergy||0,inclusion:cv.inclusion||0,category:list.header||''};
          });
        });
      }catch(_){}
      // Pour chaque carte du deck, regarde synergy
      var lowSynergy=[];
      var highSynergy=[];
      rows.forEach(function(r){
        var nl=_nlOf(r.card&&r.card.name||r.name);
        var meta=r.meta||{};var tl=(meta.typeLine||'').toLowerCase();
        if(/land/.test(tl))return;
        var entry=synergyMap[nl];
        if(!entry)return;
        var name=r.card&&r.card.name||r.name;
        if(entry.synergy<=-15&&entry.inclusion<20){
          lowSynergy.push({name:name,synergy:entry.synergy,inclusion:entry.inclusion,category:entry.category});
        }
        if(entry.synergy>=30){
          highSynergy.push({name:name,synergy:entry.synergy,inclusion:entry.inclusion,category:entry.category});
        }
      });
      lowSynergy.sort(function(a,b){return a.synergy-b.synergy;});
      highSynergy.sort(function(a,b){return b.synergy-a.synergy;});
      callback&&callback({
        checked:true,
        commander:cmdName,
        lowSynergyInDeck:lowSynergy.slice(0,10),
        highSynergyInDeck:highSynergy.slice(0,10),
        verdict:lowSynergy.length===0?'✓ Aucune carte "off-commander" identifiée':lowSynergy.length+' carte(s) jouées hors-synergie avec '+cmdName
      });
    });
  }

  // ─── 44. FORMAT-AWARE (build 104) ──────────────────────────────────────
  // Switch des seuils selon le format. Permet aux formats non-EDH d'avoir
  // une analyse adaptée (life total, nombre adversaires, méta connu).
  var FORMAT_PROFILES = {
    'commander':{lifeTotal:40,opponents:3,decksize:100,sideboard:0,banList:[]},
    'paupercmd':{lifeTotal:40,opponents:3,decksize:100,sideboard:0,banList:[]},
    'brawl':{lifeTotal:40,opponents:1,decksize:100,sideboard:0,banList:[]},
    'oathbreaker':{lifeTotal:20,opponents:3,decksize:60,sideboard:0,banList:[]},
    'modern':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:['arcum\'s astrolabe','splinter twin','birthing pod','sensei\'s divining top','dread return','mind\'s desire','golgari grave-troll','mental misstep','seething song','treasure cruise','dig through time','grief','fury']},
    'pioneer':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:['oko, thief of crowns','field of the dead','smuggler\'s copter','once upon a time','uro, titan of nature\'s wrath','lurrus of the dream-den','geological appraiser','karn, the great creator (pioneer)']},
    'pauper':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:['cranial plating','daze','sinkhole','frantic search','arcum\'s astrolabe','gush','treasure cruise','temporal fissure','grapeshot','high tide','mystical tutor']},
    'legacy':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:['ancestral recall','black lotus','library of alexandria','mox sapphire','time walk']},
    'vintage':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:[]},
    'standard':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:[]},
    'historic':{lifeTotal:20,opponents:1,decksize:60,sideboard:15,banList:[]}
  };
  // Métagame top decks par format (sample, à mettre à jour trimestriellement)
  var FORMAT_METAGAME = {
    'modern':[{deck:'Murktide Regent',share:'12%'},{deck:'Living End',share:'9%'},{deck:'Hammer Time',share:'8%'},{deck:'Domain Zoo',share:'7%'},{deck:'Yawgmoth',share:'7%'},{deck:'Rakdos Scam',share:'6%'},{deck:'Tron',share:'6%'},{deck:'Amulet Titan',share:'5%'}],
    'pioneer':[{deck:'Izzet Phoenix',share:'14%'},{deck:'Rakdos Vampires',share:'10%'},{deck:'Lotus Field',share:'9%'},{deck:'Mono-Green Devotion',share:'8%'},{deck:'Boros Heroic',share:'7%'},{deck:'Spirits',share:'7%'},{deck:'Azorius Control',share:'6%'}],
    'pauper':[{deck:'Mono-U Faeries',share:'14%'},{deck:'Affinity',share:'12%'},{deck:'Burn',share:'10%'},{deck:'Caw-Gates',share:'8%'},{deck:'Tortured Existence',share:'7%'},{deck:'Dimir Terror',share:'7%'}],
    'legacy':[{deck:'UR Delver',share:'15%'},{deck:'Painter',share:'10%'},{deck:'Reanimator',share:'9%'},{deck:'4c Beanstalk',share:'8%'},{deck:'Death \'n Taxes',share:'7%'},{deck:'Lands',share:'6%'}],
    'standard':[{deck:'Esper Pixie',share:'12%'},{deck:'Domain Ramp',share:'10%'},{deck:'Mono-Red Aggro',share:'9%'},{deck:'Dimir Midrange',share:'8%'}]
  };
  function formatAware(rows,deck){
    var fmt=(deck&&deck.format||'').toLowerCase();
    var profile=FORMAT_PROFILES[fmt];
    if(!profile)return {checked:false,reason:'Format inconnu: '+fmt};
    var set=_cardSet(rows);
    var bansFound=[];
    (profile.banList||[]).forEach(function(b){
      if(set[b])bansFound.push(b);
    });
    var meta=FORMAT_METAGAME[fmt]||null;
    // Decksize check
    var totalCards=rows.reduce(function(s,r){return s+(r.qty||1);},0);
    var sideCount=(deck.sideboard||[]).reduce(function(s,c){return s+(c.qty||1);},0);
    var sizeWarnings=[];
    if(totalCards!==profile.decksize)sizeWarnings.push(totalCards+'/'+profile.decksize+' cartes mainboard');
    if(profile.sideboard&&sideCount!==profile.sideboard&&sideCount!==0)sizeWarnings.push(sideCount+'/'+profile.sideboard+' cartes sideboard');
    return {
      checked:true,
      format:fmt,
      lifeTotal:profile.lifeTotal,opponents:profile.opponents,
      decksize:profile.decksize,sideboardExpected:profile.sideboard,
      bansFound:bansFound,
      sizeWarnings:sizeWarnings,
      metagame:meta,
      verdict:bansFound.length?'⚠ '+bansFound.length+' carte(s) bannie(s) en '+fmt:sizeWarnings.length?'~ '+sizeWarnings.join(' · '):'✓ Format '+fmt+' — conforme'
    };
  }

  // ─── 45. SEQUENCING TURN-BY-TURN (build 104) ───────────────────────────
  // Plan de jeu T1-T7 narratif. Reprend simulatedGameMetrics et formule
  // un play optimal en texte.
  function sequencingPlan(rows,deck,simReport,manaReport){
    if(!simReport||!simReport.checked)return {checked:false,reason:'Sim non disponible'};
    var plan=[];
    var avgCmd=simReport.avgCmdTurn;
    var avgFirstRamp=simReport.avgFirstRampTurn;
    var avgWincon=simReport.avgFirstWinconTurn;
    var cmdCmc=deck&&deck.commander&&deck.commander.cmc||4;
    // T1
    plan.push({turn:1,action:'Play land',details:'Drop land #1, pass. Si tu as un cantrip/scry cheap, jette-le maintenant.',pri:'land'});
    // T2
    if(avgFirstRamp&&avgFirstRamp<=2){
      plan.push({turn:2,action:'Ramp 2-CMC',details:'Pose 2e land, cast Arcane Signet / Sol Ring si en main. Sinon développement.',pri:'ramp'});
    }else{
      plan.push({turn:2,action:'Setup',details:'Pose land, joue interaction cheap si en main (Counterspell, Path).',pri:'interact'});
    }
    // T3
    plan.push({turn:3,action:avgFirstRamp&&avgFirstRamp<=2?'Engine draw':'Ramp tardif',details:avgFirstRamp&&avgFirstRamp<=2?'Pose 3e land + cast Rhystic / Esper Sentinel / Mystic Remora. Priorité absolue.':'Pose land, cast Cultivate / Kodama\'s Reach / Signet 3-CMC.',pri:'draw'});
    // T-cmd
    if(avgCmd){
      plan.push({turn:avgCmd,action:'Cast commandant',details:'Premier deploy attendu T'+avgCmd+' ('+simReport.cmdHitPct+'% des parties). Garde mana ouvert pour protection si possible.',pri:'cmd'});
    }
    // T5
    plan.push({turn:5,action:'Pression / défense',details:'Soit tu mets pression (bombs 5-CMC, anthem, board wipe préventif), soit tu te prépares à wrather.',pri:'mid'});
    // T-wincon
    if(avgWincon){
      plan.push({turn:avgWincon,action:'Wincon visible',details:'T'+avgWincon+' tu vois ta première winning piece. Protège-la (instants).',pri:'wincon'});
    }
    // Conseil mana base
    var fixWarn=null;
    if(manaReport&&manaReport.issues&&manaReport.issues.length){
      fixWarn='⚠ Attention manabase : '+manaReport.issues.map(function(i){return i.color;}).join(', ')+' sous-représenté(s).';
    }
    return {
      checked:true,
      plan:plan,fixWarn:fixWarn,
      avgCmd:avgCmd,avgWincon:avgWincon,
      verdict:'Plan de play T1-T'+(avgWincon||7)+' tracé'
    };
  }

  // ─── 46. MANABASE OPTIMISATION (build 104) ─────────────────────────────
  // Au-delà de bilands : ratio fetch / shock / triome / pain idéal selon
  // nombre de couleurs ET format. Recommandations targetées.
  var FETCH_LANDS = ['flooded strand','polluted delta','bloodstained mire','wooded foothills','windswept heath','marsh flats','scalding tarn','verdant catacombs','arid mesa','misty rainforest','prismatic vista','fabled passage','evolving wilds','terramorphic expanse'];
  var SHOCK_LANDS = ['hallowed fountain','watery grave','blood crypt','stomping ground','temple garden','overgrown tomb','steam vents','godless shrine','sacred foundry','breeding pool'];
  var TRIOME_LANDS = ['ketria triome','indatha triome','savai triome','raugrin triome','zagoth triome','spara\'s headquarters','xander\'s lounge','jetmir\'s garden','raffine\'s tower','ziatora\'s proving ground'];
  var PAIN_LANDS = ['adarkar wastes','underground river','sulfurous springs','karplusan forest','llanowar wastes','battlefield forge','brushland','caves of koilos','shivan reef','yavimaya coast'];
  function manabaseOptimisation(rows,deck,manaReport){
    var fmt=(deck&&deck.format||'').toLowerCase();
    var colorCount=manaReport&&manaReport.colorReqs?Object.keys(manaReport.colorReqs).filter(function(c){return c!=='C'&&manaReport.colorReqs[c]>0;}).length:0;
    var set=_cardSet(rows);
    var fetches=FETCH_LANDS.filter(function(n){return set[n];});
    var shocks=SHOCK_LANDS.filter(function(n){return set[n];});
    var triomes=TRIOME_LANDS.filter(function(n){return set[n];});
    var pains=PAIN_LANDS.filter(function(n){return set[n];});
    // Ratios optimaux selon couleurs + format
    var idealFetches=0,idealShocks=0,idealTriomes=0;
    if(fmt==='commander'){
      if(colorCount===1)idealFetches=0;
      else if(colorCount===2){idealFetches=4;idealShocks=2;}
      else if(colorCount===3){idealFetches=6;idealShocks=3;idealTriomes=1;}
      else if(colorCount===4){idealFetches=8;idealShocks=4;idealTriomes=2;}
      else if(colorCount===5){idealFetches=8;idealShocks=5;idealTriomes=3;}
    }else if(fmt==='modern'||fmt==='pioneer'||fmt==='legacy'){
      if(colorCount===2){idealFetches=6;idealShocks=4;}
      else if(colorCount===3){idealFetches=9;idealShocks=6;idealTriomes=2;}
      else if(colorCount>=4){idealFetches=10;idealShocks=8;idealTriomes=3;}
    }
    var fetchGap=Math.max(0,idealFetches-fetches.length);
    var shockGap=Math.max(0,idealShocks-shocks.length);
    var triomeGap=Math.max(0,idealTriomes-triomes.length);
    var recs=[];
    if(fetchGap>0)recs.push({type:'fetch',gap:fetchGap,msg:'Ajoute '+fetchGap+' fetch land(s) — fix les couleurs ET thin la lib'});
    if(shockGap>0)recs.push({type:'shock',gap:shockGap,msg:'Ajoute '+shockGap+' shock land(s) — entrée untapped si tu paies 2 PV'});
    if(triomeGap>0&&colorCount>=3)recs.push({type:'triome',gap:triomeGap,msg:'Ajoute '+triomeGap+' triome(s) — fix 3 couleurs + cycling'});
    if(colorCount>=3&&pains.length===0&&fmt==='commander')recs.push({type:'pain',gap:1,msg:'Considère pain lands (Underground River etc.) si budget limité — entrée untapped'});
    return {
      checked:true,
      colorCount:colorCount,
      fetches:{count:fetches.length,ideal:idealFetches,gap:fetchGap},
      shocks:{count:shocks.length,ideal:idealShocks,gap:shockGap},
      triomes:{count:triomes.length,ideal:idealTriomes,gap:triomeGap},
      pains:pains.length,
      recommendations:recs,
      verdict:recs.length===0?'✓ Manabase optimisée pour '+colorCount+' couleur(s) en '+(fmt||'?'):recs.length+' suggestion(s) d\'upgrade manabase'
    };
  }

  // ─── 47. INDIVIDUAL CARD SCORING (build 104) ───────────────────────────
  // Pour chaque carte, score 0-100 + raison + alternative si dispo.
  // Coûteux : on limite aux 20 cartes les plus "fragiles" (faible tier).
  function individualCardScoring(rows,deck){
    var scored=[];
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      if(/land/.test(tl))return;
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var role=_detectCardRole(m);
      var cmc=m.cmc||0;
      var rank=m.edhrecRank||999999;
      // Score base : tier de la carte si connue
      var tierScore=50;
      if(role&&CARD_TIERS[role]&&CARD_TIERS[role][nl])tierScore=CARD_TIERS[role][nl]*15;
      // Bonus EDHrec rank (top 1000 = +20)
      var rankBonus=0;
      if(rank<=1000)rankBonus=20;
      else if(rank<=5000)rankBonus=10;
      else if(rank<=20000)rankBonus=0;
      else rankBonus=-10;
      // Penalty CMC élevé sans payoff
      var cmcPenalty=cmc>=6?-10:cmc>=4?-3:0;
      var score=Math.max(0,Math.min(100,tierScore+rankBonus+cmcPenalty+25));
      var reasons=[];
      if(tierScore>=60)reasons.push('staple reconnu');
      else if(tierScore>=45)reasons.push('solide');
      else reasons.push('faible tier');
      if(rankBonus>=10)reasons.push('top EDHrec');
      else if(rankBonus<=-10)reasons.push('rarement jouée');
      if(cmcPenalty<-5)reasons.push('cher hors-plan');
      scored.push({name:r.card&&r.card.name||r.name,nl:nl,score:score,role:role,cmc:cmc,reasons:reasons});
    });
    scored.sort(function(a,b){return a.score-b.score;});
    return {
      checked:true,
      weakest:scored.slice(0,12),
      strongest:scored.slice(-8).reverse(),
      avgScore:scored.length?Math.round(scored.reduce(function(s,c){return s+c.score;},0)/scored.length):0,
      verdict:'Score moyen carte : '+(scored.length?Math.round(scored.reduce(function(s,c){return s+c.score;},0)/scored.length):0)+'/100'
    };
  }

  // ─── 48. REPLAY ANALYSIS (build 105) ───────────────────────────────────
  // Parseur de game log texte simple. Format attendu (ligne par tour) :
  //   T1: Land - Forest | Cast - Llanowar Elves
  //   T2: Land - Forest | Cast - Elvish Mystic
  //   ...
  // Détecte les erreurs classiques : skip land drop, hold-up mana inutile,
  // sequencing sous-optimal.
  function replayAnalysis(gameLog){
    if(!gameLog||typeof gameLog!=='string')return {checked:false,reason:'Pas de game log fourni'};
    var lines=gameLog.split(/\n/).map(function(l){return l.trim();}).filter(Boolean);
    var turns=[];
    lines.forEach(function(line){
      var m=line.match(/^T(\d+):\s*(.+)$/i);
      if(!m)return;
      var t=parseInt(m[1],10);
      var actions=m[2].split('|').map(function(s){return s.trim();});
      var landDrops=0,casts=[];
      actions.forEach(function(a){
        var lm=a.match(/^Land\s*[-:]?\s*(.+)$/i);if(lm){landDrops++;return;}
        var cm=a.match(/^Cast\s*[-:]?\s*(.+)$/i);if(cm){casts.push(cm[1].trim());return;}
      });
      turns.push({t:t,landDrops:landDrops,casts:casts,raw:line});
    });
    if(!turns.length)return {checked:false,reason:'Format game log non reconnu. Utilise "T1: Land - Forest | Cast - Llanowar Elves"'};
    var issues=[];
    var praises=[];
    var lastTurn=0;
    turns.forEach(function(turn,i){
      // Skip land drop
      if(turn.landDrops===0&&i<7)issues.push({turn:turn.t,sev:'high',msg:'Pas de land drop T'+turn.t+' — perte de tempo critique early'});
      // Multiple land drops in a turn (illégal sauf effet)
      if(turn.landDrops>=2)issues.push({turn:turn.t,sev:'info',msg:'T'+turn.t+' : '+turn.landDrops+' land drops — assure-toi d\'avoir un effet "extra land drop"'});
      // No casts (passive turn)
      if(turn.casts.length===0&&turn.t<=4)issues.push({turn:turn.t,sev:'med',msg:'T'+turn.t+' : aucun cast — hold-up mana ou main mauvaise ?'});
      if(turn.casts.length>=2)praises.push({turn:turn.t,msg:'T'+turn.t+' : '+turn.casts.length+' casts — bon développement'});
      lastTurn=turn.t;
    });
    return {
      checked:true,
      turnsParsed:turns.length,
      issues:issues,
      praises:praises,
      totalCasts:turns.reduce(function(s,t){return s+t.casts.length;},0),
      totalLandDrops:turns.reduce(function(s,t){return s+t.landDrops;},0),
      verdict:issues.length===0?'✓ Aucune erreur évidente sur '+turns.length+' tours analysés':issues.length+' erreur(s) sur '+turns.length+' tours'
    };
  }

  // ─── 49. SIDEBOARD ANALYSIS (build 105) ────────────────────────────────
  // Analyse les 15 cartes du sideboard si format compétitif. Check :
  //  - taille exacte (15)
  //  - couverture des matchups méta
  //  - graveyard hate, artifact hate, counter density
  var SIDE_HATE_TYPES = {
    'graveyard':['rest in peace','leyline of the void','grafdigger\'s cage','tormod\'s crypt','soul-guide lantern','relic of progenitus','endurance','silent gravestone'],
    'artifact':['stony silence','collector ouphe','null rod','shattering spree','meltdown','seal of cleansing','disenchant','natural state','force of vigor'],
    'creature':['celestial purge','disfigure','fatal push','prismatic ending','solitude','engineered explosives','toxic deluge'],
    'counter':['mindbreak trap','negate','dispel','spell pierce','pyroblast','red elemental blast','flusterstorm','force of negation','veil of summer']
  };
  function sideboardAnalysis(deck){
    var fmt=(deck&&deck.format||'').toLowerCase();
    var profile=FORMAT_PROFILES[fmt];
    if(!profile||!profile.sideboard)return {checked:false,reason:'Format sans sideboard'};
    var side=deck.sideboard||[];
    var sideCount=side.reduce(function(s,c){return s+(c.qty||1);},0);
    var coverage={};
    Object.keys(SIDE_HATE_TYPES).forEach(function(k){coverage[k]=0;});
    side.forEach(function(c){
      var nl=_nlOf(c.name);
      Object.keys(SIDE_HATE_TYPES).forEach(function(k){
        if(SIDE_HATE_TYPES[k].indexOf(nl)>=0)coverage[k]+=c.qty||1;
      });
    });
    var blindSpots=[];
    if(coverage.graveyard<2)blindSpots.push('graveyard');
    if(coverage.artifact<1)blindSpots.push('artifact/enchant');
    if(coverage.counter<2&&fmt!=='pauper')blindSpots.push('counters');
    return {
      checked:true,
      sideCount:sideCount,expected:profile.sideboard,
      coverage:coverage,
      blindSpots:blindSpots,
      verdict:sideCount!==profile.sideboard?'⚠ Sideboard '+sideCount+'/'+profile.sideboard+' cartes':blindSpots.length===0?'✓ Sideboard couvre les angles classiques':blindSpots.length+' angle(s) mort(s) : '+blindSpots.join(', ')
    };
  }

  // ─── 50. TOURNAMENT VIABILITY (build 105) ──────────────────────────────
  // Pour formats compétitifs : check le deck contre les Tier 1 du méta.
  // Heuristique : un deck est "tournament-viable" s'il a au moins :
  //   - 60% des cartes Tier 1 du méta connu (proxy via STAPLE_CMC + GAME_CHANGERS)
  //   - removal + counter coverage suffisante
  //   - mana base optimisée
  function tournamentViability(rows,deck,reportFragments){
    var fmt=(deck&&deck.format||'').toLowerCase();
    if(!FORMAT_METAGAME[fmt])return {checked:false,reason:'Format non-compétitif ou méta non tracé'};
    // Score 0-100 :
    //  - efficacité (manaEfficiency.score) : 30 pts
    //  - removal quality : 25 pts
    //  - mana base : 20 pts
    //  - card advantage : 15 pts
    //  - stack interaction : 10 pts
    var score=0;
    var notes=[];
    if(reportFragments){
      var eff=reportFragments.efficiency;
      var killScope=reportFragments.threatsKillableScope;
      var manabase=reportFragments.manabase;
      var cardAdv=reportFragments.cardAdvantage;
      var stack=reportFragments.stackInteraction;
      if(eff&&eff.score!=null){var s=Math.min(30,eff.score*0.3);score+=s;if(s<15)notes.push('Efficience mana faible');}
      else score+=15;
      if(killScope&&killScope.qualityScore!=null){var s2=Math.min(25,killScope.qualityScore*0.4);score+=s2;if(s2<12)notes.push('Removal sous-dimensionné');}
      else score+=12;
      if(manabase&&manabase.issues&&manabase.issues.length===0)score+=20;
      else{score+=10;notes.push('Manabase à fixer');}
      if(cardAdv&&cardAdv.caScore!=null){var s3=Math.min(15,cardAdv.caScore*0.5);score+=s3;if(s3<7)notes.push('Card advantage faible');}
      else score+=7;
      if(stack&&stack.instantPct){var s4=Math.min(10,stack.instantPct*0.25);score+=s4;}
      else score+=3;
    }
    score=Math.round(score);
    var meta=FORMAT_METAGAME[fmt]||[];
    return {
      checked:true,
      format:fmt,
      score:score,
      notes:notes,
      topMetaDecks:meta.slice(0,5),
      verdict:score>=75?'✓ Profil tournament-viable en '+fmt+' (score '+score+'/100)':score>=55?'~ Compétitif local mais sub-tier ('+score+'/100)':'⚠ Pas prêt pour tournoi '+fmt+' ('+score+'/100)'
    };
  }

  // ─── 51. DECK COST OPTIMIZATION (build 105) ────────────────────────────
  // Pour chaque carte chère du deck, propose un downgrade budget équivalent.
  // Source : dict statique de fallbacks budget par staple.
  var BUDGET_DOWNGRADES = {
    'mana crypt':{cheap:'sol ring',role:'fast mana 0-CMC',savings:200},
    'jeweled lotus':{cheap:'arcane signet',role:'ramp commander',savings:150},
    'mana vault':{cheap:'mind stone',role:'mana rock',savings:80},
    'mox diamond':{cheap:'fellwar stone',role:'mana rock 1-CMC',savings:550},
    'dockside extortionist':{cheap:'jeska\'s will',role:'ramp explosif',savings:90},
    'force of will':{cheap:'mana drain',role:'counterspell',savings:90},
    'force of negation':{cheap:'arcane denial',role:'counter free',savings:50},
    'mana drain':{cheap:'counterspell',role:'counter premium',savings:50},
    'demonic tutor':{cheap:'diabolic tutor',role:'tutor noir',savings:50},
    'vampiric tutor':{cheap:'mastermind\'s acquisition',role:'tutor noir cheap',savings:90},
    'imperial seal':{cheap:'diabolic intent',role:'tutor noir',savings:300},
    'mystical tutor':{cheap:'merchant scroll',role:'tutor bleu instant',savings:30},
    'enlightened tutor':{cheap:'idyllic tutor',role:'tutor blanc',savings:40},
    'cyclonic rift':{cheap:'evacuation',role:'bounce mass',savings:25},
    'rhystic study':{cheap:'mystic remora',role:'tax draw',savings:25},
    'smothering tithe':{cheap:'monologue tax',role:'tax ramp',savings:30},
    'underworld breach':{cheap:'mizzix\'s mastery',role:'graveyard recur',savings:15},
    'craterhoof behemoth':{cheap:'overwhelming stampede',role:'finisher',savings:25},
    'finale of devastation':{cheap:'green sun\'s zenith',role:'tutor créature',savings:20},
    'rishadan port':{cheap:'wasteland',role:'land control',savings:25},
    'wasteland':{cheap:'strip mine',role:'mld land',savings:25}
  };
  function deckCostOptimization(rows){
    var suggestions=[];
    var totalSavings=0;
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var dg=BUDGET_DOWNGRADES[nl];
      if(!dg)return;
      suggestions.push({
        original:r.card&&r.card.name||r.name,
        cheap:dg.cheap.replace(/\b./g,function(c){return c.toUpperCase();}),
        role:dg.role,
        savings:dg.savings
      });
      totalSavings+=dg.savings*(r.qty||1);
    });
    suggestions.sort(function(a,b){return b.savings-a.savings;});
    return {
      checked:true,
      suggestions:suggestions,
      totalSavings:totalSavings,
      verdict:suggestions.length===0?'✓ Aucune carte premium évidente à downgrader':'Économies potentielles : ~$'+totalSavings+' sur '+suggestions.length+' carte(s)'
    };
  }

  // ─── 52. RAPPORT GLOBAL ────────────────────────────────────────────────
  function analyze(deck,rows){
    if(!deck||!Array.isArray(rows))return null;
    var winCons=detectWinCons(rows,deck);
    var mana=manabaseByColor(rows,deck);
    var bracket=bracketEDH(rows,deck);
    var combos=detectCombos(rows,deck,winCons);
    var anti=antiSynergies(rows,deck);
    var keywords=keywordsAlignment(rows,winCons);
    var robust=robustness(rows,deck);
    var legality=legalityCheck(rows,deck);
    var swaps=suggestSwaps(rows,deck);
    var efficiency=manaEfficiency(rows,deck);
    // Build 92 : 5 nouveaux axes
    var redundancy=winconRedundancy(winCons);
    var mulligan=mulliganProbability(rows,deck);
    var threats=threatDensityByTurn(rows);
    var curve=curveSmoothness(rows,deck,winCons);
    var removalCov=removalCoverage(rows);
    var landUpg=landUpgrades(rows,deck,mana);
    // Build 94 : batch 20-axes pro
    var castability=castabilityByCMC(rows,deck,mana);
    var cardAdv=cardAdvantageNet(rows);
    var curveOut=curveOutProbability(rows);
    var stack=stackInteraction(rows);
    var vel=velocity(rows);
    var inev=inevitability(rows);
    var recovery=recoveryTimePostWrath(rows);
    var tempo=tempoLoss(rows);
    var mustAns=mustAnswerThreats(rows);
    var antiMeta=antiMetaPositioning(rows,deck);
    var orphans=synergyOrphans(rows,deck);
    var manaProd=manaProductionCurve(rows);
    var combat=combatMath(rows,deck);
    var killScope=threatsKillableScope(rows);
    var edhrec=edhrecInclusion(rows,deck);
    var archetype=detectArchetype(rows,deck);
    var tribalSuggestions=suggestTribalCards(rows,deck);
    // Build 100 : enabler/payoff + turn-to-kill + sabotage interne
    var pairs=enablerPayoffPairs(rows);
    var ttk=turnToKill(rows,winCons);
    var sabotage=internalSabotage(rows);
    // Build 101 : table threat level
    var threatLevel=tableThreatLevel(rows,deck,winCons,combos);
    // Build 102 : simulation 50 parties
    var simMetrics=simulatedGameMetrics(rows,deck);
    // Build 103 : hand evaluation + politique + (synergy-aware = async, séparé)
    var handEval=handEvaluation(rows,deck);
    var politics=politicsMultiplayer(rows,deck);
    // Build 104 : format-aware + sequencing + manabase opt + card scoring
    var fmtAware=formatAware(rows,deck);
    var sequencing=sequencingPlan(rows,deck,simMetrics,mana);
    var manaOpt=manabaseOptimisation(rows,deck,mana);
    var cardScores=individualCardScoring(rows,deck);
    // Build 105 : sideboard + tournament viability + cost downgrade
    var sideAna=sideboardAnalysis(deck);
    var costOpt=deckCostOptimization(rows);
    var report={
      winCons:winCons,
      redundancy:redundancy,
      manabase:mana,
      bracket:bracket,
      combos:combos,
      antiSynergies:anti,
      keywords:keywords,
      robustness:robust,
      legality:legality,
      swaps:swaps,
      efficiency:efficiency,
      mulligan:mulligan,
      threats:threats,
      curve:curve,
      removalCoverage:removalCov,
      landUpgrades:landUpg,
      castability:castability,
      cardAdvantage:cardAdv,
      curveOut:curveOut,
      stackInteraction:stack,
      velocity:vel,
      inevitability:inev,
      recovery:recovery,
      tempoLoss:tempo,
      mustAnswerThreats:mustAns,
      antiMeta:antiMeta,
      synergyOrphans:orphans,
      manaProduction:manaProd,
      combatMath:combat,
      threatsKillableScope:killScope,
      edhrecInclusion:edhrec,
      archetype:archetype,
      tribalSuggestions:tribalSuggestions,
      enablerPayoffPairs:pairs,
      turnToKill:ttk,
      internalSabotage:sabotage,
      tableThreatLevel:threatLevel,
      simulatedGameMetrics:simMetrics,
      handEvaluation:handEval,
      politicsMultiplayer:politics,
      formatAware:fmtAware,
      sequencingPlan:sequencing,
      manabaseOptimisation:manaOpt,
      individualCardScoring:cardScores,
      sideboardAnalysis:sideAna,
      deckCostOptimization:costOpt,
      timestamp:Date.now()
    };
    // Build 94 : narrative est calculée APRÈS car elle synthétise tout
    // Build 105 : tournament viability needs the assembled report
    report.tournamentViability=tournamentViability(rows,deck,report);
    report.narrative=coachNarrative(report);
    // Build 95 : diff vs analyse précédente du même deck (si dispo)
    if(deck&&deck.id){
      var prev=_loadLastReport(deck.id);
      if(prev&&prev.timestamp&&Date.now()-prev.timestamp<7*86400000){
        report.diff=compareReports(prev,report);
      }
      _saveLastReport(deck.id,report);
    }
    // Coach mode : top 5 fixes prioritaires
    report.coach=coachTopFixes(report);
    return report;
  }

  // ─── 18. CACHE PAR DECK (build 92) ─────────────────────────────────────
  // Évite de recalculer si rien n'a changé. Hash basé sur la liste de cartes
  // + format + commandant. Persistant en localStorage.
  function _deckHash(deck,rows){
    var parts=[];
    parts.push(deck.format||'?');
    parts.push((deck.commander&&deck.commander.name)||'?');
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      parts.push(nl+':'+(r.qty||1));
    });
    parts.sort();
    // Hash simple (FNV-1a)
    var s=parts.join('|');
    var h=2166136261;
    for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }
  function analyzeCached(deck,rows){
    if(!deck||!Array.isArray(rows))return null;
    var hash=_deckHash(deck,rows);
    var cacheKey='mlapro_cache_'+(deck.id||hash);
    try{
      var raw=localStorage.getItem(cacheKey);
      if(raw){
        var cached=JSON.parse(raw);
        if(cached.hash===hash&&Date.now()-cached.timestamp<3600000){
          return cached.report;
        }
      }
    }catch(_){}
    var report=analyze(deck,rows);
    if(report){
      try{
        localStorage.setItem(cacheKey,JSON.stringify({hash:hash,timestamp:Date.now(),report:report}));
      }catch(_){}
    }
    return report;
  }

  // ─── 7. RENDU HTML ─────────────────────────────────────────────────────
  function _esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function render(report){
    if(!report)return '<div style="padding:16px;color:var(--tx3);font-style:italic">Pas de rapport disponible. Lance l\'analyse d\'abord.</div>';
    var h='';
    h+='<div style="display:flex;flex-direction:column;gap:14px">';
    // ─ Header global ─
    h+='<div style="background:linear-gradient(135deg,rgba(74,160,232,.14),rgba(74,160,232,.03));border:1px solid rgba(74,160,232,.42);border-radius:12px;padding:14px 18px">';
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">';
    h+='<span style="font-size:.62rem;color:#7ec0f0;letter-spacing:.14em;text-transform:uppercase;font-weight:700">🔬 Analyse Pro · 51 axes</span>';
    h+='<span style="font-size:.6rem;color:var(--tx3);padding:2px 7px;background:rgba(180,140,220,.10);border:.5px solid rgba(180,140,220,.30);border-radius:99px;font-family:var(--ff-mono,monospace)" title="Version des dictionnaires méta (cartes, bombs, must-answer). MAJ trimestrielle.">méta '+META_VERSION+' · MAJ '+META_UPDATED+'</span>';
    h+='<span style="flex:1"></span>';
    h+='<button onclick="if(typeof anaProCompareDecks===\'function\')anaProCompareDecks()" style="font-size:.72rem;padding:4px 10px;background:rgba(180,140,220,.14);border:.5px solid rgba(180,140,220,.4);border-radius:6px;color:#b48cdc;cursor:pointer;font-family:inherit;margin-right:6px" title="Comparer ce deck avec un autre side-by-side">🆚 Compare</button>';
    h+='<button onclick="if(typeof anaProRunEdhrec===\'function\')anaProRunEdhrec()" style="font-size:.72rem;padding:4px 10px;background:rgba(126,200,106,.14);border:.5px solid rgba(126,200,106,.4);border-radius:6px;color:#9ddf8c;cursor:pointer;font-family:inherit;margin-right:6px" title="Analyse contextuelle EDHrec par commandant">🌐 EDHrec</button>';
    h+='<button onclick="if(typeof anaProRunSynergy===\'function\')anaProRunSynergy()" style="font-size:.72rem;padding:4px 10px;background:rgba(180,140,220,.14);border:.5px solid rgba(180,140,220,.4);border-radius:6px;color:#b48cdc;cursor:pointer;font-family:inherit;margin-right:6px" title="Coaching synergy-aware (EDHrec synergy par commandant)">🧠 Synergy</button>';
    h+='<button onclick="if(typeof anaProOpenReplay===\'function\')anaProOpenReplay()" style="font-size:.72rem;padding:4px 10px;background:rgba(240,200,74,.14);border:.5px solid rgba(240,200,74,.4);border-radius:6px;color:#f0c84a;cursor:pointer;font-family:inherit;margin-right:6px" title="Analyse de game log (importer une partie jouée)">🎮 Replay</button>';
    h+='<button onclick="if(typeof anaProExportPdf===\'function\')anaProExportPdf()" style="font-size:.72rem;padding:4px 10px;background:rgba(74,160,232,.14);border:.5px solid rgba(74,160,232,.4);border-radius:6px;color:#7ec0f0;cursor:pointer;font-family:inherit" title="Exporter le rapport en PDF">📄 PDF</button>';
    h+='</div>';
    h+='<div style="font-size:.84rem;color:var(--tx2);line-height:1.5">Diagnostic complet déterministe : plan A + Plan B / manabase / bracket / combos / anti-synergies / mulligan probability / threat density / lissage courbe / removal coverage. Aucun LLM, résultats reproductibles, cache localStorage.</div>';
    h+='</div>';
    // ─ Placeholder pour analyse EDHrec async (build 95) ─
    h+='<div id="anapro-edhrec-placeholder"></div>';
    // ─ COACH MODE — top 5 fixes en tête (build 92) ─
    if(report.coach&&report.coach.length){
      h+='<div class="anapro-card" style="border:1.5px solid rgba(74,160,232,.55);background:linear-gradient(135deg,rgba(74,160,232,.10),rgba(74,160,232,.02))">';
      h+='<div class="anapro-cat" style="color:#7ec0f0;font-size:.72rem">🎯 Coach mode — Top '+report.coach.length+' priorités</div>';
      h+='<div style="font-size:.78rem;color:var(--tx2);margin-bottom:10px;line-height:1.5">Si tu ne fais qu\'<b>une chose</b> aujourd\'hui : commence par #1. Si tu fais cinq choses : suis l\'ordre. Chaque fix est priorisé par sévérité + impact attendu.</div>';
      report.coach.forEach(function(fix,i){
        var col={critical:'#e8847b',high:'#f09060',med:'#f0c84a',low:'#9ddf8c'}[fix.sev]||'#7ec0f0';
        var bg={critical:'rgba(232,132,123,.06)',high:'rgba(240,144,96,.06)',med:'rgba(240,200,74,.06)',low:'rgba(126,200,106,.06)'}[fix.sev]||'rgba(74,160,232,.06)';
        h+='<div style="display:flex;align-items:flex-start;gap:11px;padding:10px 13px;background:'+bg+';border-left:4px solid '+col+';border-radius:0 8px 8px 0;margin-bottom:6px">';
        h+='<div style="font-size:1.2rem;font-weight:700;color:'+col+';font-family:var(--ff-mono,monospace);line-height:1.2;min-width:24px">#'+(i+1)+'</div>';
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="font-size:.66rem;color:'+col+';letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:3px">'+_esc(fix.category)+'</div>';
        h+='<div style="font-size:.92rem;color:#fff;font-weight:700;margin-bottom:2px">'+_esc(fix.title)+'</div>';
        h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.45">'+_esc(fix.reason)+'</div>';
        h+='</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    // ─ Redondance wincons (build 92) ─
    if(report.redundancy){
      var rdCol=report.redundancy.sev==='good'?'#9ddf8c':report.redundancy.sev==='med'?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🔁 Redondance des plans de victoire</div>';
      h+='<div style="display:flex;align-items:center;gap:14px">';
      h+='<div style="font-size:2.2rem;font-weight:700;color:'+rdCol+';font-family:var(--ff-mono,monospace);text-shadow:0 0 12px '+rdCol+'66">'+report.redundancy.count+'</div>';
      h+='<div style="flex:1"><div style="color:'+rdCol+';font-weight:700;font-size:1rem">'+_esc(report.redundancy.label)+'</div>';
      h+='<div style="font-size:.82rem;color:var(--tx2);line-height:1.5">'+_esc(report.redundancy.msg)+'</div>';
      h+='</div></div>';
      h+='</div>';
    }
    // ─ 1. WinCons ─
    h+='<div class="anapro-card">';
    h+='<div class="anapro-cat">🎯 Plans de victoire</div>';
    if(report.winCons.primary){
      h+='<div style="font-size:1rem;color:#fff;font-weight:700;margin-bottom:6px">'+_esc(report.winCons.primary.label)+' <span style="color:#7ec0f0;font-family:var(--ff-mono,monospace)">'+report.winCons.primary.score+'/100</span></div>';
    }
    if(report.winCons.missing){
      h+='<div style="color:#e8847b;font-weight:600;margin-bottom:6px">'+_esc(report.winCons.missing)+'</div>';
      h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.5">Ton deck doit avoir un plan A clair. Ajoute soit 15+ créatures évasives (combat), 5+ effets de drain, 8+ générateurs de tokens, ou une carte alt-win (Approach, Felidar Sovereign, Test of Endurance).</div>';
    }else{
      h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">';
      report.winCons.plans.slice(0,4).forEach(function(p){
        h+='<span class="anapro-tag" title="'+_esc(JSON.stringify(p.evidence))+'">'+_esc(p.label)+' <b style="color:#7ec0f0">'+p.score+'</b></span>';
      });
      h+='</div>';
    }
    h+='</div>';
    // ─ 2. Manabase ─
    var mb=report.manabase;
    h+='<div class="anapro-card">';
    h+='<div class="anapro-cat">🏔 Manabase par couleur</div>';
    h+='<div style="font-size:.86rem;color:'+(mb.deficits.length===0?'#9ddf8c':'#f0c84a')+';font-weight:700;margin-bottom:8px">'+_esc(mb.verdict)+'</div>';
    if(mb.byColor.length){
      h+='<div style="overflow-x:auto"><table style="width:100%;font-size:.78rem;border-collapse:collapse">';
      h+='<thead><tr style="color:var(--tx3);text-transform:uppercase;font-size:.66rem;letter-spacing:.06em">'
        +'<th style="text-align:left;padding:4px 6px">Couleur</th>'
        +'<th style="text-align:right;padding:4px 6px">Pips total</th>'
        +'<th style="text-align:right;padding:4px 6px">Sources actuelles</th>'
        +'<th style="text-align:right;padding:4px 6px">Cible Karsten</th>'
        +'<th style="text-align:right;padding:4px 6px">Δ</th>'
        +'</tr></thead><tbody>';
      var colNames={W:'⚪ Blanc',U:'🔵 Bleu',B:'⚫ Noir',R:'🔴 Rouge',G:'🟢 Vert'};
      mb.byColor.forEach(function(b){
        var delta=b.sources-b.target;
        var dcol=delta>=0?'#9ddf8c':delta>=-2?'#f0c84a':'#e8847b';
        h+='<tr style="border-top:.5px solid var(--bd)">'
          +'<td style="padding:5px 6px;color:var(--tx)">'+colNames[b.color]+'</td>'
          +'<td style="padding:5px 6px;text-align:right;color:var(--tx2);font-family:var(--ff-mono,monospace)">'+b.pips+'</td>'
          +'<td style="padding:5px 6px;text-align:right;color:var(--tx);font-family:var(--ff-mono,monospace);font-weight:700">'+b.sources+'</td>'
          +'<td style="padding:5px 6px;text-align:right;color:var(--tx2);font-family:var(--ff-mono,monospace)">'+b.target+'</td>'
          +'<td style="padding:5px 6px;text-align:right;color:'+dcol+';font-family:var(--ff-mono,monospace);font-weight:700">'+(delta>=0?'+':'')+delta+'</td>'
          +'</tr>';
      });
      h+='</tbody></table></div>';
      h+='<div style="font-size:.7rem;color:var(--tx3);margin-top:6px;font-style:italic;line-height:1.45">Cibles selon le standard Frank Karsten : 14 sources pour 1 pip, 20 pour 2 pips, 23 pour 3 pips. Les sources "any color" comptent pour toutes les couleurs.</div>';
    }
    h+='<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem;color:var(--tx2)">';
    h+='<span>🏔 <b style="color:#fff">'+mb.nLands+'</b> terrains</span>';
    h+='<span>🎴 <b style="color:#fff">'+mb.nNonland+'</b> non-terrains</span>';
    h+='<span>🔄 <b style="color:#fff">'+mb.multilands+'</b> bilands</span>';
    h+='<span>🔍 <b style="color:#fff">'+mb.fetches+'</b> fetches</span>';
    h+='</div>';
    h+='</div>';
    // ─ 3. Bracket EDH ─
    if(report.bracket){
      var br=report.bracket;
      var bCol=br.bracket<=2?'#9ddf8c':br.bracket===3?'#f0c84a':br.bracket===4?'#f09060':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">📊 Bracket EDH</div>';
      h+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">';
      h+='<div style="font-size:2.2rem;font-weight:700;color:'+bCol+';font-family:var(--ff-mono,monospace);text-shadow:0 0 14px '+bCol+'66">'+br.bracket+'</div>';
      h+='<div><div style="color:#fff;font-weight:700;font-size:1.05rem">'+_esc(br.label)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3)">Score : '+br.score+'</div></div>';
      h+='</div>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:.74rem;color:var(--tx2)">';
      Object.keys(br.stats).forEach(function(k){
        var v=br.stats[k];if(!v)return;
        var lbl={gameChangers:'🎯 Game Changers',mld:'💥 Mass Land Denial',tutors:'🔮 Tutors',combos:'⚡ Combos',fastMana:'💨 Fast Mana'}[k]||k;
        h+='<span class="anapro-tag">'+lbl+' <b style="color:#7ec0f0">'+v+'</b></span>';
      });
      h+='</div>';
      h+='</div>';
    }
    // ─ 4. Combos ─
    if(report.combos.count){
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">⚡ Combos détectés</div>';
      h+='<div style="font-size:.84rem;color:var(--tx);margin-bottom:8px"><b style="color:#7ec0f0">'+report.combos.count+'</b> combo(s) infinis présent(s)'+(report.combos.relevantCount<report.combos.count?', dont <b style="color:#9ddf8c">'+report.combos.relevantCount+'</b> pertinent(s) pour ton plan':'')+'</div>';
      report.combos.combos.forEach(function(c){
        var col=c.relevant?'#9ddf8c':'#7e8696';
        h+='<div style="padding:8px 12px;background:rgba(74,160,232,.04);border-left:3px solid '+col+';border-radius:0 6px 6px 0;margin-bottom:6px">';
        h+='<div style="font-weight:700;color:var(--tx);font-size:.86rem">'+_esc(c.n)+(c.relevant?'':' <span style="color:#7e8696;font-weight:400;font-size:.74rem">(hors plan)</span>')+'</div>';
        h+='<div style="font-size:.76rem;color:var(--tx3);margin-top:2px">→ '+_esc(c.result)+' · mana ~'+c.mana+' · T'+c.turn+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    // ─ 5. Anti-synergies ─
    if(report.antiSynergies.issues.length){
      h+='<div class="anapro-card" style="border-color:rgba(240,144,96,.42)">';
      h+='<div class="anapro-cat" style="color:#f09060">⚠ Anti-synergies détectées</div>';
      report.antiSynergies.issues.forEach(function(iss){
        var col=iss.sev==='high'?'#e8847b':'#f0c84a';
        h+='<div style="padding:8px 12px;background:rgba(240,144,96,.04);border-left:3px solid '+col+';border-radius:0 6px 6px 0;margin-bottom:6px;font-size:.84rem;color:var(--tx)">'+_esc(iss.msg)+'</div>';
      });
      h+='</div>';
    }
    // ─ 6. Mots-clés vs plan (build 89) ─
    if(report.keywords&&report.keywords.primary){
      var kw=report.keywords;
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🏷 Mots-clés vs plan « '+_esc(kw.primary)+' »</div>';
      if(kw.expected.length===0){
        h+='<div style="font-size:.78rem;color:var(--tx2)">Pas de keywords standards attendus pour ce plan.</div>';
      }else{
        h+='<div style="margin-bottom:8px"><span style="font-size:.74rem;color:var(--tx3)">Attendus pour ce plan : </span>';
        kw.expected.forEach(function(k){
          var has=kw.counts[k]||0;
          var col=has>=3?'#9ddf8c':has>=1?'#f0c84a':'#e8847b';
          var bg=has>=3?'rgba(126,200,106,.10)':has>=1?'rgba(240,200,74,.10)':'rgba(232,132,123,.10)';
          h+='<span style="display:inline-block;padding:3px 9px;background:'+bg+';border:.5px solid '+col+';border-radius:99px;font-size:.72rem;margin:2px;color:var(--tx)">'+_esc(k)+' <b style="color:'+col+';font-family:var(--ff-mono,monospace)">'+has+'</b></span>';
        });
        h+='</div>';
        if(kw.missing.length){
          h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.5"><b style="color:#e8847b">'+kw.missing.length+'</b> mot(s)-clé(s) attendus mais absents du deck : <span style="color:var(--tx)">'+kw.missing.map(_esc).join(', ')+'</span></div>';
        }else{
          h+='<div style="font-size:.78rem;color:#9ddf8c">✓ Tous les keywords du plan sont présents</div>';
        }
      }
      h+='</div>';
    }
    // ─ 7. Robustesse (build 89) ─
    if(report.robustness){
      var rb=report.robustness;
      var rCol=rb.score>=70?'#9ddf8c':rb.score>=45?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🛡 Robustesse face aux menaces</div>';
      h+='<div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">';
      h+='<div style="font-size:2rem;font-weight:700;color:'+rCol+';font-family:var(--ff-mono,monospace);text-shadow:0 0 14px '+rCol+'66;line-height:1">'+rb.score+'<span style="font-size:.9rem;opacity:.7">/100</span></div>';
      h+='<div style="color:'+rCol+';font-weight:700;font-size:.94rem">'+_esc(rb.verdict)+'</div>';
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">';
      [['💥 Recovery wrath',rb.wrathRecovery,'recursion','protection','cheapThreats'],
       ['🛡 Stop combo T3-T4',rb.comboInteraction,'instantInteraction'],
       ['⛓ Break stax / lock',rb.staxBreaker,'wipes','protection']].forEach(function(t){
        var label=t[0],data=t[1];
        h+='<div style="padding:9px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:8px">';
        h+='<div style="font-size:.7rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:600;margin-bottom:3px">'+label+'</div>';
        h+='<div style="font-size:1.05rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace)">'+data.score+'<span style="font-size:.7rem;opacity:.6">/100</span></div>';
        var details=[];
        for(var i=2;i<t.length;i++){
          var key=t[i];if(data[key]!=null)details.push(key+': '+data[key]);
        }
        if(details.length)h+='<div style="font-size:.66rem;color:var(--tx3);margin-top:2px">'+details.join(' · ')+'</div>';
        h+='</div>';
      });
      h+='</div>';
      h+='</div>';
    }
    // ─ 8. Légalité de format (build 90) ─
    if(report.legality&&report.legality.checked){
      if(report.legality.issues.length){
        h+='<div class="anapro-card" style="border-color:rgba(232,132,123,.55);background:linear-gradient(135deg,rgba(232,132,123,.10),rgba(232,132,123,.02))">';
        h+='<div class="anapro-cat" style="color:#e8847b">🚫 Légalité '+_esc(report.legality.fmt)+' — '+report.legality.issues.length+' carte(s) hors-format</div>';
        report.legality.issues.forEach(function(iss){
          var col=iss.sev==='high'?'#e8847b':'#f0c84a';
          h+='<div style="padding:7px 11px;background:rgba(232,132,123,.06);border-left:3px solid '+col+';border-radius:0 6px 6px 0;margin-bottom:5px;font-size:.84rem;color:var(--tx)"><b>'+_esc(iss.card)+'</b> — '+_esc(iss.msg)+'</div>';
        });
        h+='</div>';
      }else{
        h+='<div class="anapro-card" style="border-color:rgba(126,200,106,.35)">';
        h+='<div class="anapro-cat" style="color:#9ddf8c">✓ Légalité '+_esc(report.legality.fmt)+'</div>';
        h+='<div style="font-size:.82rem;color:var(--tx2)">Toutes les cartes sont légales dans ce format.</div>';
        h+='</div>';
      }
    }
    // ─ Suggestions tribales (build 98) — affiché AVANT les autres swaps ─
    if(report.tribalSuggestions){
      var ts=report.tribalSuggestions;
      h+='<div class="anapro-card" style="border-color:rgba(180,140,220,.42);background:linear-gradient(135deg,rgba(180,140,220,.06),rgba(74,160,232,.02))">';
      h+='<div class="anapro-cat" style="color:#b48cdc">🦅 Suggestions tribales — '+_esc(ts.tribe)+' ('+ts.count+' cartes)</div>';
      if(!ts.catalog){
        h+='<div style="font-size:.84rem;color:var(--tx2);line-height:1.5">'+_esc(ts.verdict)+'</div>';
      }else{
        h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.5;margin-bottom:10px">Cartes <b style="color:#b48cdc">'+_esc(ts.tribe)+'</b> de notre catalogue NON présentes dans ton deck. Source : top staples tribaux du consensus EDHrec.</div>';
        if(ts.missingCreatures.length){
          h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px">🦅 Créatures '+_esc(ts.tribe)+' manquantes</div>';
          h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">';
          ts.missingCreatures.forEach(function(name){
            var pretty=name.replace(/\b./g,function(c){return c.toUpperCase();});
            h+='<span style="padding:4px 11px;background:rgba(180,140,220,.10);border:.5px solid rgba(180,140,220,.40);border-radius:99px;font-size:.78rem;color:var(--tx);font-weight:500">'+_esc(pretty)+'</span>';
          });
          h+='</div>';
        }
        if(ts.missingPayoffs.length){
          h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px">🎯 Payoffs / enablers '+_esc(ts.tribe)+' manquants</div>';
          h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">';
          ts.missingPayoffs.forEach(function(name){
            var pretty=name.replace(/\b./g,function(c){return c.toUpperCase();});
            h+='<span style="padding:4px 11px;background:rgba(126,200,106,.08);border:.5px solid rgba(126,200,106,.30);border-radius:99px;font-size:.78rem;color:var(--tx)">'+_esc(pretty)+'</span>';
          });
          h+='</div>';
        }
        // Build 99 : créatures tribales FAIBLES (dans le tribe mais hors catalog)
        if(ts.weakTribalInDeck&&ts.weakTribalInDeck.length){
          h+='<div style="margin-top:12px;padding-top:12px;border-top:.5px solid rgba(180,140,220,.2)">';
          h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">🔄 Créatures '+_esc(ts.tribe)+' à reconsidérer</div>';
          h+='<div style="font-size:.74rem;color:var(--tx3);line-height:1.5;margin-bottom:8px">Ces créatures sont du tribe mais <b>pas dans nos staples du catalogue</b>. À swapper contre les Rogues manquants ci-dessus si tu veux monter en puissance.</div>';
          ts.weakTribalInDeck.forEach(function(c){
            h+='<div style="display:flex;align-items:center;gap:9px;padding:6px 11px;background:rgba(232,132,123,.04);border-left:3px solid #e8847b;border-radius:0 6px 6px 0;margin-bottom:4px;font-size:.82rem">';
            h+='<span style="color:var(--tx);font-weight:600;flex:1">'+_esc(c.name)+'</span>';
            h+='<span style="font-size:.7rem;color:var(--tx3);font-family:var(--ff-mono,monospace)">cmc '+c.cmc+(c.edhrecRank?' · rank '+c.edhrecRank:'')+'</span>';
            h+='</div>';
          });
          h+='</div>';
        }
        // Build 99 : staples tribaux confirmés (en vert)
        if(ts.tribalStaplesInDeck&&ts.tribalStaplesInDeck.length){
          h+='<div style="margin-top:10px;padding-top:10px;border-top:.5px solid rgba(180,140,220,.2)">';
          h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px">✓ Staples '+_esc(ts.tribe)+' déjà présents — protégés du swap</div>';
          h+='<div style="display:flex;flex-wrap:wrap;gap:4px">';
          ts.tribalStaplesInDeck.forEach(function(c){
            h+='<span style="padding:2px 9px;background:rgba(126,200,106,.10);border:.5px solid rgba(126,200,106,.30);border-radius:99px;font-size:.72rem;color:#9ddf8c">'+_esc(c.name)+'</span>';
          });
          h+='</div></div>';
        }
        if(!ts.missingCreatures.length&&!ts.missingPayoffs.length&&!ts.weakTribalInDeck.length){
          h+='<div style="font-size:.86rem;color:#9ddf8c;font-weight:700">✓ Tu joues déjà tous les staples '+_esc(ts.tribe)+' de notre catalogue !</div>';
        }
      }
      h+='</div>';
    }
    // ─ 9b. Efficience mana (build 91) ─ avant les suggestions par tier
    if(report.efficiency&&report.efficiency.byRole){
      var eff=report.efficiency.byRole;
      var hasOvercost=Object.keys(eff).some(function(r){return eff[r].overcost&&eff[r].overcost.length;});
      if(hasOvercost){
        var roleEffLbl={ramp:'⛰ Ramp',draw:'📜 Pioche',removal:'🗡 Removal',interaction:'🛡 Interaction',
          wipe:'💥 Wraths',tutor:'🔮 Tutors',counter:'✋ Contresorts',landFix:'🌐 Fixers'};
        h+='<div class="anapro-card" style="border-color:rgba(240,200,74,.42)">';
        h+='<div class="anapro-cat" style="color:#f0c84a">⚡ Efficience mana — coût / effet</div>';
        // Build 99 : avis tribal raffiné — seuls les staples sont protégés
        if(report.efficiency.dominantTribe){
          var dt=report.efficiency.dominantTribe;
          h+='<div style="padding:8px 12px;background:rgba(180,140,220,.06);border:.5px solid rgba(180,140,220,.30);border-radius:7px;margin-bottom:10px;font-size:.78rem;color:var(--tx2);line-height:1.5">🛡 <b style="color:#b48cdc">Tribe '+_esc(dt.tribe)+'</b> ('+dt.count+' cartes). Seuls les '+_esc(dt.tribe)+'s <b>reconnus comme staples</b> de notre catalogue sont protégés ('+report.efficiency.tribeProtectedCount+' créature(s)). Les autres restent éligibles au swap — vers d\'autres '+_esc(dt.tribe)+'s, listés dans la card « 🦅 Suggestions tribales » plus haut.</div>';
        }
        h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.55;margin-bottom:10px">Cartes dont le <b>CMC est élevé pour l\'effet rendu</b>. Pour chacune, on propose un staple <b style="color:#9ddf8c">à coût inférieur ou égal</b> avec un impact supérieur. <span style="color:var(--tx3);font-style:italic">Score impact = power_tier ÷ CMC</span></div>';
        Object.keys(eff).forEach(function(role){
          var data=eff[role];
          if(!data.overcost||!data.overcost.length)return;
          h+='<div style="margin-bottom:12px">';
          h+='<div style="font-size:.74rem;color:var(--tx2);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">'+_esc(roleEffLbl[role]||role)+' <span style="color:var(--tx3);font-weight:400;font-size:.66rem">· '+data.cards.length+' carte(s) · impact moy '+data.avgImpact+'</span></div>';
          data.overcost.forEach(function(c){
            h+='<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:8px 11px;background:rgba(240,200,74,.04);border:.5px solid rgba(240,200,74,.20);border-radius:8px;margin-bottom:5px">';
            // Current card (faible impact)
            h+='<div>';
            h+='<div style="font-size:.84rem;color:var(--tx)"><b>'+_esc(c.name)+'</b></div>';
            h+='<div style="font-size:.7rem;color:var(--tx3);font-family:var(--ff-mono,monospace)">cmc '+c.cmc+' · impact '+c.impact+'</div>';
            h+='</div>';
            // Arrow
            h+='<div style="font-size:1.2rem;color:#9ddf8c">→</div>';
            // Suggested swap
            if(c.suggestedSwap){
              var s=c.suggestedSwap;
              var gain=s.impact-c.impact;
              h+='<div>';
              h+='<div style="font-size:.84rem;color:#9ddf8c"><b>'+_esc(s.name.replace(/\b./g,function(x){return x.toUpperCase();}))+'</b></div>';
              h+='<div style="font-size:.7rem;color:var(--tx3);font-family:var(--ff-mono,monospace)">cmc '+s.cmc+' · impact '+s.impact+' <b style="color:#9ddf8c">(+'+gain.toFixed(0)+')</b></div>';
              h+='</div>';
            }else{
              h+='<div style="font-size:.74rem;color:var(--tx3);font-style:italic">Pas d\'alternative low-CMC</div>';
            }
            h+='</div>';
          });
          h+='</div>';
        });
        h+='</div>';
      }
    }
    // ─ 9. Suggestions de swap par tier (build 90) ─
    if(report.swaps&&report.swaps.byRole){
      var roleLabels={ramp:'⛰ Ramp',draw:'📜 Pioche',removal:'🗡 Removal',interaction:'🛡 Interaction',
        wipe:'💥 Wraths',tutor:'🔮 Tutors',counter:'✋ Contresorts',landFix:'🌐 Fixers terrains'};
      var hasAnySwap=false;
      Object.keys(report.swaps.byRole).forEach(function(role){
        var data=report.swaps.byRole[role];
        if(data.weak.length||data.suggest.length)hasAnySwap=true;
      });
      if(hasAnySwap){
        h+='<div class="anapro-card">';
        h+='<div class="anapro-cat">🔄 Suggestions de swap — par rôle</div>';
        // Build 97 : avis tribal protection
        if(report.swaps&&report.swaps.dominantTribe){
          var dts=report.swaps.dominantTribe;
          h+='<div style="padding:8px 12px;background:rgba(180,140,220,.06);border:.5px solid rgba(180,140,220,.30);border-radius:7px;margin-bottom:10px;font-size:.78rem;color:var(--tx2);line-height:1.5">🛡 <b style="color:#b48cdc">Thème tribal détecté : '+_esc(dts.tribe)+'</b> ('+dts.count+' cartes). Les créatures '+_esc(dts.tribe)+' sont <b>protégées des suggestions de swap</b> pour préserver l\'identité du deck.</div>';
        }
        h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.5;margin-bottom:10px">Pour chaque rôle, les cartes <b style="color:#e8847b">faibles</b> de ton deck à envisager pour upgrade, et des <b style="color:#9ddf8c">staples manquants</b> à considérer. Source : tier list S/A/B/C consensus communautaire.</div>';
        Object.keys(report.swaps.byRole).forEach(function(role){
          var data=report.swaps.byRole[role];
          if(!data.weak.length&&!data.suggest.length)return;
          h+='<details style="margin-bottom:8px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:8px;padding:6px 10px">';
          h+='<summary style="cursor:pointer;font-size:.86rem;color:var(--tx);font-weight:700;list-style:none">'+_esc(roleLabels[role]||role)+' <span style="color:var(--tx3);font-weight:400;font-size:.74rem">· '+data.count+' carte(s)'+(data.weak.length?' · <span style="color:#e8847b">'+data.weak.length+' faible(s)</span>':'')+(data.suggest.length?' · <span style="color:#9ddf8c">'+data.suggest.length+' staple(s) manquant(s)</span>':'')+'</span></summary>';
          h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">';
          // Faibles
          h+='<div><div style="font-size:.68rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:5px">À envisager pour upgrade</div>';
          if(data.weak.length){
            data.weak.forEach(function(c){
              h+='<div style="font-size:.78rem;color:var(--tx2);padding:3px 7px;border-radius:5px;background:rgba(232,132,123,.06);margin-bottom:3px"><b style="color:#e8847b;font-family:var(--ff-mono,monospace);font-size:.66rem">'+c.power+'</b> '+_esc(c.name)+'</div>';
            });
          }else{
            h+='<div style="font-size:.74rem;color:var(--tx3);font-style:italic">Pas de faibles détectés</div>';
          }
          h+='</div>';
          // Suggestions
          h+='<div><div style="font-size:.68rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:5px">Staples manquants</div>';
          if(data.suggest.length){
            data.suggest.forEach(function(c){
              h+='<div style="font-size:.78rem;color:var(--tx2);padding:3px 7px;border-radius:5px;background:rgba(126,200,106,.06);margin-bottom:3px"><b style="color:#9ddf8c;font-family:var(--ff-mono,monospace);font-size:.66rem">'+c.power+'</b> '+_esc(c.name)+'</div>';
            });
          }else{
            h+='<div style="font-size:.74rem;color:var(--tx3);font-style:italic">Tous les staples sont présents</div>';
          }
          h+='</div>';
          h+='</div></details>';
        });
        h+='</div>';
      }
    }
    // ─ Mulligan probability (build 92) ─
    if(report.mulligan&&report.mulligan.checked){
      var mp=report.mulligan;
      var mpCol=mp.keepablePct>=85?'#9ddf8c':mp.keepablePct>=70?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🃏 Probabilité de mulligan (sim 10 000 mains)</div>';
      h+='<div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">';
      h+='<div style="font-size:2.2rem;font-weight:700;color:'+mpCol+';font-family:var(--ff-mono,monospace);text-shadow:0 0 12px '+mpCol+'66;line-height:1">'+mp.keepablePct+'<span style="font-size:.9rem;opacity:.7">%</span></div>';
      h+='<div style="flex:1"><div style="color:'+mpCol+';font-weight:700;font-size:.94rem">'+_esc(mp.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-top:2px">Mains keepables : 2-5 lands + 1+ jouable T1-T3</div></div>';
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px">';
      [['Lands moyens',mp.avgLands],['Ramp moyen',mp.avgRamp],['Action T1-T3',mp.avgAction],
       ['Mana screw',mp.manaScrewPct+'%'],['Mana flood',mp.manaFloodPct+'%']].forEach(function(t){
        h+='<div style="padding:7px 9px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px">';
        h+='<div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:600">'+_esc(t[0])+'</div>';
        h+='<div style="font-size:.92rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:1px">'+_esc(t[1])+'</div>';
        h+='</div>';
      });
      h+='</div>';
      h+='</div>';
    }
    // ─ Threat density par tour (build 92) ─
    if(report.threats){
      var th=report.threats;
      var thCol=th.dryTurns.length===0?'#9ddf8c':th.dryTurns.length<=2?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">⏰ Threat density par tour 1-7</div>';
      h+='<div style="color:'+thCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(th.verdict)+'</div>';
      // Mini bar chart par tour
      h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">';
      [1,2,3,4,5,6,7].forEach(function(t){
        var c=th.counts[t];
        var total=c.threat+c.engine+c.setup;
        var isDry=th.dryTurns.indexOf(t)>=0;
        var bg=isDry?'rgba(232,132,123,.10)':'rgba(74,160,232,.06)';
        var bd=isDry?'rgba(232,132,123,.42)':'rgba(74,160,232,.30)';
        h+='<div style="padding:9px 6px;background:'+bg+';border:.5px solid '+bd+';border-radius:8px;text-align:center">';
        h+='<div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">T'+t+'</div>';
        h+='<div style="font-size:1rem;font-weight:700;color:'+(isDry?'#e8847b':'#fff')+';font-family:var(--ff-mono,monospace);margin:3px 0">'+total+'</div>';
        h+='<div style="font-size:.6rem;color:var(--tx3);line-height:1.3">';
        if(c.threat)h+='⚔'+c.threat+' ';
        if(c.engine)h+='⚙'+c.engine+' ';
        if(c.setup)h+='🔧'+c.setup;
        h+='</div>';
        h+='</div>';
      });
      h+='</div>';
      h+='<div style="font-size:.66rem;color:var(--tx3);margin-top:6px;font-style:italic">⚔ threat · ⚙ engine · 🔧 setup. Tours rouges = moins de 3 cartes jouables.</div>';
      h+='</div>';
    }
    // ─ Lissage de courbe (build 92) ─
    if(report.curve){
      var cv=report.curve;
      var cvCol=cv.gaps.length===0&&cv.humps.length<=1?'#9ddf8c':'#f0c84a';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">📈 Lissage de courbe (archétype: '+_esc(cv.archetype)+')</div>';
      h+='<div style="color:'+cvCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(cv.verdict)+'</div>';
      // Comparaison actual vs idéal en bars
      h+='<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin-bottom:8px">';
      [0,1,2,3,4,5,6,7].forEach(function(c){
        var ha=cv.actual[c]||0,hi=cv.ideal[c]||0;
        var dif=ha-hi;
        var col=Math.abs(dif)<=2?'#9ddf8c':Math.abs(dif)<=4?'#f0c84a':'#e8847b';
        h+='<div style="text-align:center">';
        h+='<div style="font-size:.62rem;color:var(--tx3);font-weight:700;margin-bottom:2px">'+(c===7?'7+':c)+'</div>';
        h+='<div style="display:flex;flex-direction:column;align-items:center;gap:1px">';
        // Actual
        var hHeight=Math.max(2,ha*4);
        h+='<div style="width:100%;height:'+hHeight+'px;background:'+col+';border-radius:3px 3px 0 0" title="Tu as '+ha+'"></div>';
        h+='<div style="font-size:.66rem;color:#fff;font-family:var(--ff-mono,monospace);font-weight:700">'+ha+'</div>';
        h+='<div style="font-size:.6rem;color:var(--tx3)">/'+hi+'</div>';
        h+='</div>';
        h+='</div>';
      });
      h+='</div>';
      if(cv.gaps.length){
        h+='<div style="font-size:.78rem;color:#e8847b;margin-top:6px">⚠ Gaps détectés : '+cv.gaps.map(function(g){return 'CMC '+g.cmc+' ('+g.have+'/'+g.want+')';}).join(' · ')+'</div>';
      }
      if(cv.humps.length){
        h+='<div style="font-size:.78rem;color:#f0c84a;margin-top:4px">⚠ Surcharges : '+cv.humps.map(function(g){return 'CMC '+g.cmc+' ('+g.have+'/'+g.want+')';}).join(' · ')+'</div>';
      }
      h+='</div>';
    }
    // ─ Land upgrades (build 93) — bilands recommandés avec budget tapped ─
    if(report.landUpgrades&&report.landUpgrades.checked&&report.landUpgrades.suggestions&&report.landUpgrades.suggestions.length){
      var lu=report.landUpgrades;
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🏔 Upgrades de terrains — basics → bilands</div>';
      h+='<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:.74rem;color:var(--tx2);margin-bottom:10px">';
      h+='<span>📊 <b style="color:#fff">'+lu.totalLands+'</b> terrains</span>';
      h+='<span>🌐 <b style="color:#fff">'+lu.existingFixers+'</b> fixers existants</span>';
      var tappedCol=lu.tappedPct<=30?'#9ddf8c':lu.tappedPct<=40?'#f0c84a':'#e8847b';
      h+='<span>⏱ <b style="color:'+tappedCol+'">'+lu.tappedPct+'%</b> ETB tapped (cible ≤30%)</span>';
      h+='<span>💰 budget tapped restant : <b style="color:#7ec0f0">'+lu.tappedBudgetRemaining+'</b> slot(s)</span>';
      h+='</div>';
      h+='<div style="font-size:.78rem;color:var(--tx2);line-height:1.55;margin-bottom:10px">Pour chaque paire de couleurs présente, on suggère les meilleurs bilands NON présents — priorisés par <b>qualité</b> (shock/dual/fetch en tête) et filtrés selon le budget « ETB tapped » (≤30% de la manabase). Chaque suggestion remplace un basic land.</div>';
      lu.suggestions.forEach(function(s){
        var qCol=s.quality>=85?'#9ddf8c':s.quality>=70?'#f0c84a':'#e8847b';
        var tCol=s.etbTapped===false?'#9ddf8c':s.etbTapped==='cond'?'#f0c84a':'#e8847b';
        var tLbl=s.etbTapped===false?'untapped':s.etbTapped==='cond'?'conditionnel':'ETB tapped';
        h+='<div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 12px;background:rgba(74,160,232,.04);border-left:3px solid '+qCol+';border-radius:0 8px 8px 0;margin-bottom:5px">';
        // Pair tag
        h+='<div style="font-size:.66rem;font-weight:700;color:#7ec0f0;background:rgba(74,160,232,.10);padding:3px 8px;border-radius:99px;font-family:var(--ff-mono,monospace);min-width:32px;text-align:center">'+_esc(s.pair)+'</div>';
        // Nom + meta
        h+='<div style="min-width:0">';
        h+='<div style="font-size:.86rem;color:#fff;font-weight:700">'+_esc(s.name)+'</div>';
        h+='<div style="font-size:.72rem;color:var(--tx3);margin-top:2px"><span style="color:'+tCol+';font-weight:600">'+tLbl+'</span> · '+_esc(s.note)+' · remplace 1 '+_esc(s.replaces)+'</div>';
        h+='</div>';
        // Qualité
        h+='<div style="text-align:right">';
        h+='<div style="font-size:.7rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase">qualité</div>';
        h+='<div style="font-size:1rem;font-weight:700;color:'+qCol+';font-family:var(--ff-mono,monospace)">'+s.quality+'</div>';
        h+='</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    // ─ Diff vs analyse précédente (build 95) ─
    if(report.diff)h+=renderDiff(report.diff);
    // ─ Coach narratif (build 94) ─
    if(report.narrative){
      h+='<div class="anapro-card" style="background:linear-gradient(135deg,rgba(126,200,106,.08),rgba(126,200,106,.02));border-color:rgba(126,200,106,.42)">';
      h+='<div class="anapro-cat" style="color:#9ddf8c">📝 Synthèse coach (1 paragraphe)</div>';
      h+='<div style="font-size:.96rem;color:var(--tx);line-height:1.7">'+report.narrative+'</div>';
      h+='</div>';
    }
    // ─ Pro Insights grille (build 94) — 15 axes pro condensés ─
    h+='<div class="anapro-card">';
    h+='<div class="anapro-cat">🎓 Pro Insights — analyse niveau coach</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">';
    var insights=[];
    // Castability
    if(report.castability&&report.castability.checked){
      var probs=report.castability.problems;
      insights.push({title:'🎯 Castability',value:probs.length?probs.length+' problèmes':'OK',
        col:probs.length===0?'#9ddf8c':probs.length<=3?'#f0c84a':'#e8847b',
        sub:probs.length?probs.slice(0,2).map(function(p){return _esc(p.name)+' '+p.prob+'%';}).join(' · '):'Toutes castables'});
    }
    // Card advantage
    if(report.cardAdvantage){
      var ca=report.cardAdvantage;
      insights.push({title:'📚 Card advantage',value:ca.caScore+' pts',
        col:ca.caScore>=30?'#9ddf8c':ca.caScore>=18?'#f0c84a':'#e8847b',
        sub:ca.engines+' engines · '+ca.cantrips+' cantrips · '+ca.twoForOne+' 2-for-1'});
    }
    // Curve out
    if(report.curveOut&&report.curveOut.checked){
      var co=report.curveOut;
      insights.push({title:'📈 Curve-out parfait',value:co.perfectPct+'%',
        col:co.perfectPct>=30?'#9ddf8c':co.perfectPct>=15?'#f0c84a':'#e8847b',
        sub:'Decent : '+co.decentPct+'% · sim 5k mains'});
    }
    // Stack
    if(report.stackInteraction){
      var si=report.stackInteraction;
      insights.push({title:'⚡ Stack interaction',value:si.instantPct+'%',
        col:si.instantPct>=35?'#9ddf8c':si.instantPct>=20?'#f0c84a':'#e8847b',
        sub:si.instantSpeed+' instant · '+si.sorcerySpeed+' sorcery'});
    }
    // Velocity
    if(report.velocity){
      var v=report.velocity;
      insights.push({title:'🚀 Velocity',value:v.velocity+'/tour',
        col:parseFloat(v.velocity)>=2?'#9ddf8c':parseFloat(v.velocity)>=1.4?'#f0c84a':'#e8847b',
        sub:v.cantrips+' cantrips · '+v.scry+' scry · '+v.tutors+' tutors'});
    }
    // Inevitability
    if(report.inevitability){
      insights.push({title:'⏳ Inevitability',value:report.inevitability.count?report.inevitability.count+' cartes':'❌',
        col:report.inevitability.count>=2?'#9ddf8c':report.inevitability.count>=1?'#f0c84a':'#e8847b',
        sub:report.inevitability.cards.slice(0,2).join(' / ')||'aucune'});
    }
    // Recovery
    if(report.recovery){
      insights.push({title:'🔄 Recovery T post-wrath',value:'T'+report.recovery.earliestRebuild,
        col:report.recovery.earliestRebuild<=2?'#9ddf8c':report.recovery.earliestRebuild<=4?'#f0c84a':'#e8847b',
        sub:report.recovery.recurEffects+' effets de recursion'});
    }
    // Tempo loss
    if(report.tempoLoss){
      insights.push({title:'⏱ Tempo loss',value:report.tempoLoss.count+' setup',
        col:report.tempoLoss.count<=3?'#9ddf8c':report.tempoLoss.count<=6?'#f0c84a':'#e8847b',
        sub:report.tempoLoss.cards.slice(0,2).join(' · ')||'aucune'});
    }
    // Must-answer
    if(report.mustAnswerThreats){
      var ma=report.mustAnswerThreats;
      insights.push({title:'⚠ Must-answer threats',value:ma.count,
        col:ma.count>=3?'#9ddf8c':ma.count>=1?'#f0c84a':'#e8847b',
        sub:ma.cards.slice(0,2).join(' · ')||'aucune'});
    }
    // Anti-meta
    if(report.antiMeta){
      insights.push({title:'🛡 Anti-meta coverage',value:report.antiMeta.coverage+'%',
        col:report.antiMeta.coverage>=60?'#9ddf8c':report.antiMeta.coverage>=35?'#f0c84a':'#e8847b',
        sub:report.antiMeta.removalCanHit+' removal universels'});
    }
    // Orphans
    if(report.synergyOrphans){
      insights.push({title:'👻 Synergy orphans',value:report.synergyOrphans.count,
        col:report.synergyOrphans.count===0?'#9ddf8c':report.synergyOrphans.count<=3?'#f0c84a':'#e8847b',
        sub:report.synergyOrphans.orphans.slice(0,2).join(' · ')||'aucune'});
    }
    // Mana production
    if(report.manaProduction){
      var mp=report.manaProduction;
      insights.push({title:'⚡ Mana T4 max',value:mp.productionByTurn[4]+' mana',
        col:mp.productionByTurn[4]>=5?'#9ddf8c':mp.productionByTurn[4]>=4?'#f0c84a':'#e8847b',
        sub:mp.ramp1+' ramp 1-CMC · '+mp.ramp2+' ramp 2-CMC'});
    }
    // Combat (build 101 v2)
    if(report.combatMath){
      var cm=report.combatMath;
      var cmOk=parseFloat(cm.avgLateEvasion)>=cm.blockerLate||cm.evasionPct>=40;
      insights.push({title:'⚔ Combat math',value:cm.evasionPct+'% évasion',
        col:cmOk?'#9ddf8c':cm.evasionPct>=25?'#f0c84a':'#e8847b',
        sub:'early '+cm.avgEarlyEvasion+' (év.) · late '+cm.avgLateEvasion+' (év.) · blockeur '+cm.blockerEarly+'/'+cm.blockerLate});
    }
    // Threats killable scope (build 101 v2 — qualityScore)
    if(report.threatsKillableScope){
      var tk=report.threatsKillableScope;
      insights.push({title:'🎯 Qualité removal',value:tk.qualityScore+' pts',
        col:tk.qualityScore>=60?'#9ddf8c':tk.qualityScore>=30?'#f0c84a':'#e8847b',
        sub:tk.universal+' universal · '+tk.byMana.cheap+' cheap · '+tk.universalPct+'% universal'});
    }
    // Build 101 : Table threat level
    if(report.tableThreatLevel){
      var ttl=report.tableThreatLevel;
      var ttlCol=ttl.fragilityScore>=70||ttl.hateMagnetScore>=50?'#e8847b':ttl.fragilityScore>=40||ttl.hateMagnetScore>=30?'#f0c84a':'#9ddf8c';
      insights.push({title:'🎯 Profil table',value:ttl.criticalCardCount+' cartes clés',
        col:ttlCol,
        sub:ttl.verdict.replace(/^[✓~⚠]\s*/,'')});
    }
    // EDHrec inclusion
    if(report.edhrecInclusion){
      var er=report.edhrecInclusion;
      insights.push({title:'🌐 Densité staples',value:er.density+'%',
        col:er.density<=15?'#9ddf8c':er.density<=25?'#f0c84a':'#e8847b',
        sub:er.stapleCount+'/'+er.uniqueCards+' staples'});
    }
    // Archétype clustering (build 96)
    if(report.archetype&&report.archetype.primary){
      var ar=report.archetype;
      var arCol=ar.confidence>=70?'#9ddf8c':ar.confidence>=50?'#f0c84a':'#e8847b';
      insights.push({title:'🎭 Archétype détecté',value:ar.primary.archetype,
        col:arCol,
        sub:'Confiance '+ar.confidence+'% · top : '+ar.top3.slice(0,3).map(function(t){return t.archetype;}).join(' / ')});
    }
    insights.forEach(function(ins){
      h+='<div style="padding:10px 13px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.22);border-left:3px solid '+ins.col+';border-radius:8px">';
      h+='<div style="font-size:.66rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:4px">'+_esc(ins.title)+'</div>';
      h+='<div style="font-size:1.15rem;font-weight:700;color:'+ins.col+';font-family:var(--ff-mono,monospace);margin-bottom:2px">'+_esc(ins.value)+'</div>';
      h+='<div style="font-size:.7rem;color:var(--tx3);line-height:1.35">'+_esc(ins.sub)+'</div>';
      h+='</div>';
    });
    h+='</div></div>';
    // ─ Removal coverage matrix (build 92) ─
    if(report.removalCoverage){
      var rc=report.removalCoverage;
      var rcCol=rc.blindSpots.length===0?'#9ddf8c':rc.blindSpots.length<=2?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🎯 Couverture removal — angles morts</div>';
      h+='<div style="color:'+rcCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(rc.verdict)+'</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px">';
      var typeLabels={creature:'🐉 Créatures',artifact:'⚙ Artefacts',enchantment:'🌿 Enchant.',planeswalker:'👑 PW',
        land:'🏔 Lands',graveyard:'⚰ Cimetière',counter:'✋ Counters',bounce:'↩ Bounce'};
      var typeTargets={creature:5,artifact:2,enchantment:2,planeswalker:2,land:0,graveyard:1,counter:0,bounce:0};
      Object.keys(rc.coverage).forEach(function(k){
        var v=rc.coverage[k].count;var target=typeTargets[k]||0;
        var isBlind=v<target;
        var col=isBlind?'#e8847b':v>=target+2?'#9ddf8c':'#f0c84a';
        h+='<div style="padding:8px 10px;background:rgba(74,160,232,.04);border:.5px solid '+col+';border-radius:8px;text-align:center">';
        h+='<div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">'+_esc(typeLabels[k]||k)+'</div>';
        h+='<div style="font-size:1.15rem;font-weight:700;color:'+col+';font-family:var(--ff-mono,monospace);margin-top:2px">'+v+'</div>';
        if(target)h+='<div style="font-size:.6rem;color:var(--tx3)">cible '+target+'+</div>';
        h+='</div>';
      });
      h+='</div>';
      h+='</div>';
    }
    // ─ Build 101 : Table Threat Level ─
    if(report.tableThreatLevel){
      var ttl=report.tableThreatLevel;
      var ttlCol=ttl.fragilityScore>=70||ttl.hateMagnetScore>=50?'#e8847b':ttl.fragilityScore>=40||ttl.hateMagnetScore>=30?'#f0c84a':'#9ddf8c';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🎯 Profil table — lisibilité &amp; threat assessment</div>';
      h+='<div style="color:'+ttlCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(ttl.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Comment ta table te perçoit : ton plan A est-il fragile (peu de cartes-clés) ? Ton commandant attire-t-il le wrath ? Est-ce que tu télégraphies ton combo ?</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:11px">';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Cartes critical path</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">'+ttl.criticalCardCount+'</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Score fragilité</div><div style="font-size:1.25rem;font-weight:700;color:'+(ttl.fragilityScore>=70?'#e8847b':ttl.fragilityScore>=40?'#f0c84a':'#9ddf8c')+';font-family:var(--ff-mono,monospace);margin-top:3px">'+ttl.fragilityScore+'</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Hate magnet</div><div style="font-size:1.25rem;font-weight:700;color:'+(ttl.hateMagnetScore>=50?'#e8847b':ttl.hateMagnetScore>=30?'#f0c84a':'#9ddf8c')+';font-family:var(--ff-mono,monospace);margin-top:3px">'+ttl.hateMagnetScore+'</div></div>';
      h+='</div>';
      ttl.messages.forEach(function(m){
        h+='<div style="padding:7px 11px;background:rgba(74,160,232,.04);border-left:3px solid '+ttlCol+';border-radius:0 6px 6px 0;margin-bottom:5px;font-size:.8rem;color:var(--tx2);line-height:1.5">'+_esc(m)+'</div>';
      });
      if(ttl.criticalCards.length){
        h+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:.74rem;color:var(--tx3);font-weight:700">Voir les cartes critical path ('+ttl.criticalCards.length+')</summary>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">';
        ttl.criticalCards.forEach(function(c){
          h+='<span style="padding:2px 9px;background:rgba(240,200,74,.08);border:.5px solid rgba(240,200,74,.30);border-radius:99px;font-size:.72rem;color:#f0c84a">'+_esc(c)+'</span>';
        });
        h+='</div></details>';
      }
      h+='</div>';
    }
    // ─ Build 100 : Turn-to-Kill ─
    if(report.turnToKill&&report.turnToKill.checked){
      var ttk=report.turnToKill;
      var ttkCol=ttk.turnTo40&&ttk.turnTo40<=5?'#9ddf8c':ttk.turnTo40&&ttk.turnTo40<=8?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">⏱ Turn-to-Kill estimé</div>';
      h+='<div style="color:'+ttkCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(ttk.verdict)+'</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:.78rem">';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Kill commander (40)</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">T'+(ttk.turnTo40||'∞')+'</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Kill table (120)</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">T'+(ttk.turnTo120||'∞')+'</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Burn direct</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">'+ttk.burnDirectDmg+'</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Évasion</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">'+ttk.evasionCreatures+'</div></div>';
      h+='</div>';
      h+='<div style="font-size:.7rem;color:var(--tx3);margin-top:9px;line-height:1.5">Modèle : on suppose qu\'un attaquant avec évasion passe 90% du temps, sans 45%. Drain + burn cumulés. Hypothèse 3 adversaires pour le total table.</div>';
      h+='</div>';
    }
    // ─ Build 102 : Simulated Game Metrics ─
    if(report.simulatedGameMetrics&&report.simulatedGameMetrics.checked){
      var sg=report.simulatedGameMetrics;
      var sgCol=sg.avgCmdTurn&&sg.avgCmdTurn<=5?'#9ddf8c':sg.avgCmdTurn&&sg.avgCmdTurn<=7?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card" style="border-color:rgba(180,140,220,.42);background:linear-gradient(135deg,rgba(180,140,220,.04),transparent)">';
      h+='<div class="anapro-cat" style="color:#b48cdc">🎮 Simulation '+sg.sampleSize+' parties — métriques moyennes</div>';
      h+='<div style="color:'+sgCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(sg.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">State-machine simplifiée : mulligan auto (2-5 lands), draw step, land drop, priorité ramp T1-T3 puis draw puis bombs. '+sg.sampleSize+' parties simulées avec PRNG seedé.</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:11px">';
      h+='<div style="padding:8px 11px;background:rgba(180,140,220,.05);border:.5px solid rgba(180,140,220,.25);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Cmd cast</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">T'+(sg.avgCmdTurn||'∞')+'</div><div style="font-size:.6rem;color:var(--tx3);margin-top:2px">'+sg.cmdHitPct+'% des parties</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(180,140,220,.05);border:.5px solid rgba(180,140,220,.25);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Wincon visible</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">T'+(sg.avgFirstWinconTurn||'∞')+'</div><div style="font-size:.6rem;color:var(--tx3);margin-top:2px">'+sg.winconHitPct+'% des parties</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(180,140,220,.05);border:.5px solid rgba(180,140,220,.25);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">1er ramp</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">T'+(sg.avgFirstRampTurn||'∞')+'</div><div style="font-size:.6rem;color:var(--tx3);margin-top:2px">'+sg.rampHitPct+'% des parties</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(180,140,220,.05);border:.5px solid rgba(180,140,220,.25);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Mana T5/T7</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">'+(sg.avgT5Mana||'?')+' / '+(sg.avgT7Mana||'?')+'</div></div>';
      h+='<div style="padding:8px 11px;background:rgba(180,140,220,.05);border:.5px solid rgba(180,140,220,.25);border-radius:7px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">Mulligans</div><div style="font-size:1.25rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace);margin-top:3px">'+sg.avgMulligansTaken+'</div><div style="font-size:.6rem;color:var(--tx3);margin-top:2px">'+sg.keepableMulliganPct+'% gardables T7</div></div>';
      h+='</div>';
      h+='</div>';
    }
    // ─ Build 100 : Enabler/Payoff Pairs ─
    if(report.enablerPayoffPairs){
      var epp=report.enablerPayoffPairs;
      var eppCol=epp.issues.length===0?'#9ddf8c':epp.issues.length<=2?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🔗 Enabler / Payoff — paires manquantes</div>';
      h+='<div style="color:'+eppCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(epp.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Un payoff sans enabler = carte morte. On vérifie ici 30+ paires classiques (tokens/counters/sac/landfall/lifegain…).</div>';
      if(epp.issues.length){
        epp.issues.forEach(function(it){
          h+='<div style="padding:8px 11px;background:rgba(232,132,123,.06);border-left:3px solid #e8847b;border-radius:0 6px 6px 0;margin-bottom:6px;font-size:.82rem">';
          h+='<div style="color:#e8847b;font-weight:700">⚠ '+_esc(it.label)+'</div>';
          h+='<div style="font-size:.74rem;color:var(--tx3);margin-top:3px">Payoff : <b>'+_esc(it.payoff)+'</b> · enablers trouvés : '+it.enablersFound+' / requis : '+it.minRequired+' (gap : -'+it.gap+')</div>';
          h+='</div>';
        });
      }
      if(epp.passed.length){
        h+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:.74rem;color:var(--tx3);font-weight:700">✓ '+epp.passed.length+' payoffs supportés</summary>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">';
        epp.passed.forEach(function(p){
          h+='<span style="padding:2px 9px;background:rgba(126,200,106,.10);border:.5px solid rgba(126,200,106,.30);border-radius:99px;font-size:.72rem;color:#9ddf8c">'+_esc(p.payoff)+'</span>';
        });
        h+='</div></details>';
      }
      h+='</div>';
    }
    // ─ Build 100 : Internal Sabotage ─
    if(report.internalSabotage&&report.internalSabotage.count>0){
      var sb=report.internalSabotage;
      var sbCol=sb.count<=2?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">⚡ Sabotage interne — synergies négatives</div>';
      h+='<div style="color:'+sbCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(sb.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Paires de cartes qui se torpillent l\'une l\'autre — souvent ignoré, c\'est ce qui fait la différence entre un brewer débutant et un pro.</div>';
      sb.conflicts.forEach(function(c){
        h+='<div style="padding:8px 11px;background:rgba(240,200,74,.06);border-left:3px solid #f0c84a;border-radius:0 6px 6px 0;margin-bottom:6px;font-size:.82rem">';
        h+='<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3px"><span style="color:#fff;font-weight:600">'+_esc(c.a)+'</span><span style="color:var(--tx3);font-size:.7rem">⚔</span><span style="color:#fff;font-weight:600">'+_esc(c.b)+'</span></div>';
        h+='<div style="font-size:.74rem;color:var(--tx2);line-height:1.5">'+_esc(c.msg)+'</div>';
        h+='</div>';
      });
      h+='</div>';
    }
    // ─ Build 103 : Hand evaluation ─
    if(report.handEvaluation&&report.handEvaluation.checked){
      var he=report.handEvaluation;
      var heCol=he.avgScore>=65?'#9ddf8c':he.avgScore>=50?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🃏 Hand evaluation — 3 mains représentatives</div>';
      h+='<div style="color:'+heCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(he.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:12px;line-height:1.5">Sur 100 mains simulées : best/median/worst. Score 0-100 selon lands + ramp + interaction + draw + courbe.</div>';
      ['best','median','worst'].forEach(function(key){
        var sample=he[key];if(!sample)return;
        var label={best:'🏆 Best',median:'⚖ Median',worst:'💀 Worst'}[key];
        h+='<div style="padding:9px 12px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-left:3px solid '+sample.verdict.col+';border-radius:7px;margin-bottom:7px">';
        h+='<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:5px">';
        h+='<span style="font-size:.7rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">'+label+'</span>';
        h+='<span style="font-size:1rem;font-weight:700;color:#fff;font-family:var(--ff-mono,monospace)">'+sample.score+'/100</span>';
        h+='<span style="font-size:.78rem;color:'+sample.verdict.col+';font-weight:700;margin-left:auto">'+_esc(sample.verdict.label)+'</span>';
        h+='</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px">';
        sample.cards.forEach(function(c){
          var ic=c.isLand?'🏔':c.isRamp?'⛰':c.isDraw?'📖':c.isInteract?'✋':'·';
          h+='<span style="padding:2px 7px;background:rgba(180,180,200,.06);border:.5px solid rgba(180,180,200,.20);border-radius:4px;font-size:.7rem;color:var(--tx2)">'+ic+' '+_esc(c.name)+' <span style="color:var(--tx3);font-family:var(--ff-mono,monospace)">'+c.cmc+'</span></span>';
        });
        h+='</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:4px">';
        sample.reasons.forEach(function(r){
          h+='<span style="padding:1px 8px;background:rgba(255,255,255,.03);border-radius:99px;font-size:.7rem;color:'+r.col+'">'+_esc(r.txt)+'</span>';
        });
        h+='</div></div>';
      });
      h+='</div>';
    }
    // ─ Build 103 : Politique multijoueur ─
    if(report.politicsMultiplayer&&report.politicsMultiplayer.checked){
      var pm=report.politicsMultiplayer;
      var pmCol=pm.totalPoliticalCards===0?'#e8847b':pm.totalPoliticalCards>=4?'#9ddf8c':'#f0c84a';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🤝 Politique multijoueur — outils sociaux</div>';
      h+='<div style="color:'+pmCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(pm.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Un EDH se joue à 4. Sans dimension politique, tu peins une cible — adversaires se liguent contre la menace n°1.</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">';
      function _pmCat(title,col,arr){
        var h2='<div style="padding:8px 11px;background:rgba(74,160,232,.04);border:.5px solid rgba(74,160,232,.20);border-radius:7px">';
        h2+='<div style="font-size:.66rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:5px">'+title+' ('+arr.length+')</div>';
        if(arr.length){
          arr.forEach(function(n){
            h2+='<div style="font-size:.74rem;color:var(--tx);margin-bottom:2px">'+_esc(n)+'</div>';
          });
        }else{
          h2+='<div style="font-size:.72rem;color:var(--tx3);font-style:italic">aucun</div>';
        }
        h2+='</div>';return h2;
      }
      h+=_pmCat('🛡 Pillow-fort',pmCol,pm.pillowFort);
      h+=_pmCat('🎁 Kingmaker / deals',pmCol,pm.kingmaker);
      h+=_pmCat('🎯 Goad / redirect',pmCol,pm.goadRedirect);
      h+='</div>';
      h+='</div>';
    }
    // ─ Build 104 : Format-aware ─
    if(report.formatAware&&report.formatAware.checked){
      var fa=report.formatAware;
      var faCol=fa.bansFound.length?'#e8847b':fa.sizeWarnings.length?'#f0c84a':'#9ddf8c';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🎲 Format — '+_esc(fa.format)+' ('+fa.lifeTotal+' PV · '+fa.opponents+' adv · '+fa.decksize+' cartes)</div>';
      h+='<div style="color:'+faCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(fa.verdict)+'</div>';
      if(fa.bansFound.length){
        h+='<div style="padding:8px 11px;background:rgba(232,132,123,.06);border-left:3px solid #e8847b;border-radius:0 6px 6px 0;margin-bottom:8px">';
        h+='<div style="font-size:.74rem;color:#e8847b;font-weight:700;margin-bottom:5px">🚫 Cartes bannies détectées</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
        fa.bansFound.forEach(function(b){
          h+='<span style="padding:2px 9px;background:rgba(232,132,123,.10);border:.5px solid rgba(232,132,123,.30);border-radius:99px;font-size:.74rem;color:#e8847b">'+_esc(b)+'</span>';
        });
        h+='</div></div>';
      }
      if(fa.metagame){
        h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:5px">📊 Méta '+_esc(fa.format)+' — top decks attendus</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
        fa.metagame.forEach(function(d){
          h+='<span style="padding:3px 9px;background:rgba(74,160,232,.06);border:.5px solid rgba(74,160,232,.30);border-radius:99px;font-size:.74rem;color:var(--tx)">'+_esc(d.deck)+' <b style="color:#7ec0f0;font-family:var(--ff-mono,monospace);font-size:.66rem">'+_esc(d.share)+'</b></span>';
        });
        h+='</div>';
      }
      h+='</div>';
    }
    // ─ Build 104 : Sequencing plan ─
    if(report.sequencingPlan&&report.sequencingPlan.checked){
      var sq=report.sequencingPlan;
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">📋 Sequencing — plan de play T1-T'+(sq.avgWincon||7)+'</div>';
      h+='<div style="color:#9ddf8c;font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(sq.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Plan de jeu optimal déduit du sim 50 parties. Suis-le tour par tour pour maximiser ton expected value.</div>';
      sq.plan.forEach(function(step){
        var stepCol={land:'#9ddf8c',ramp:'#7ec0f0',interact:'#b48cdc',draw:'#f0c84a',cmd:'#9ddf8c',mid:'#7ec0f0',wincon:'#e8847b'}[step.pri]||'#7ec0f0';
        h+='<div style="display:flex;gap:11px;padding:8px 11px;background:rgba(74,160,232,.04);border-left:3px solid '+stepCol+';border-radius:0 6px 6px 0;margin-bottom:5px;font-size:.82rem">';
        h+='<div style="font-family:var(--ff-mono,monospace);color:'+stepCol+';font-weight:700;min-width:30px">T'+step.turn+'</div>';
        h+='<div style="flex:1"><div style="color:#fff;font-weight:600">'+_esc(step.action)+'</div><div style="font-size:.74rem;color:var(--tx2);line-height:1.5;margin-top:2px">'+_esc(step.details)+'</div></div>';
        h+='</div>';
      });
      if(sq.fixWarn){
        h+='<div style="margin-top:8px;padding:7px 11px;background:rgba(232,132,123,.06);border-left:3px solid #e8847b;border-radius:0 6px 6px 0;font-size:.78rem;color:#e8847b;line-height:1.5">'+_esc(sq.fixWarn)+'</div>';
      }
      h+='</div>';
    }
    // ─ Build 104 : Manabase optimisation ─
    if(report.manabaseOptimisation&&report.manabaseOptimisation.checked){
      var mo=report.manabaseOptimisation;
      var moCol=mo.recommendations.length===0?'#9ddf8c':mo.recommendations.length<=2?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🏞 Manabase optimisée — fetches / shocks / triomes</div>';
      h+='<div style="color:'+moCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(mo.verdict)+'</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px;margin-bottom:11px">';
      function _moBox(label,emoji,obj){
        var col=obj.gap===0?'#9ddf8c':obj.gap<=2?'#f0c84a':'#e8847b';
        return '<div style="padding:8px 10px;background:rgba(74,160,232,.04);border:.5px solid '+col+';border-radius:8px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">'+emoji+' '+label+'</div><div style="font-size:1.15rem;font-weight:700;color:'+col+';font-family:var(--ff-mono,monospace);margin-top:2px">'+obj.count+'/'+obj.ideal+'</div><div style="font-size:.6rem;color:var(--tx3)">gap '+obj.gap+'</div></div>';
      }
      h+=_moBox('Fetches','🔍',mo.fetches);
      h+=_moBox('Shocks','⚡',mo.shocks);
      h+=_moBox('Triomes','🔱',mo.triomes);
      h+='</div>';
      mo.recommendations.forEach(function(r){
        h+='<div style="padding:7px 11px;background:rgba(74,160,232,.04);border-left:3px solid #7ec0f0;border-radius:0 6px 6px 0;margin-bottom:5px;font-size:.78rem;color:var(--tx2);line-height:1.5">'+_esc(r.msg)+'</div>';
      });
      h+='</div>';
    }
    // ─ Build 104 : Individual card scoring ─
    if(report.individualCardScoring&&report.individualCardScoring.checked){
      var ics=report.individualCardScoring;
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🎴 Scoring individuel par carte</div>';
      h+='<div style="color:#7ec0f0;font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(ics.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Chaque carte notée 0-100 sur tier reconnu + popularité EDHrec + CMC cohérent. Top 12 faibles et top 8 fortes.</div>';
      h+='<details open><summary style="cursor:pointer;font-size:.74rem;color:var(--tx3);font-weight:700;margin-bottom:6px">🟥 Cartes les plus faibles ('+ics.weakest.length+')</summary>';
      ics.weakest.forEach(function(c){
        var ccol=c.score>=60?'#9ddf8c':c.score>=40?'#f0c84a':'#e8847b';
        h+='<div style="display:flex;gap:9px;padding:6px 11px;background:rgba(74,160,232,.04);border-left:3px solid '+ccol+';border-radius:0 6px 6px 0;margin-bottom:4px;font-size:.78rem;align-items:center">';
        h+='<span style="color:#fff;font-weight:600;flex:1">'+_esc(c.name)+'</span>';
        h+='<span style="font-size:.7rem;color:var(--tx3);font-family:var(--ff-mono,monospace)">'+c.role+' · cmc '+c.cmc+'</span>';
        h+='<span style="font-size:.74rem;color:var(--tx3);font-style:italic">'+_esc(c.reasons.join(', '))+'</span>';
        h+='<span style="font-size:.9rem;font-weight:700;color:'+ccol+';font-family:var(--ff-mono,monospace);min-width:38px;text-align:right">'+c.score+'</span>';
        h+='</div>';
      });
      h+='</details>';
      h+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:.74rem;color:var(--tx3);font-weight:700">🟩 Top cartes fortes ('+ics.strongest.length+')</summary>';
      ics.strongest.forEach(function(c){
        h+='<div style="display:flex;gap:9px;padding:6px 11px;background:rgba(126,200,106,.04);border-left:3px solid #9ddf8c;border-radius:0 6px 6px 0;margin-bottom:4px;font-size:.78rem;align-items:center">';
        h+='<span style="color:#fff;font-weight:600;flex:1">'+_esc(c.name)+'</span>';
        h+='<span style="font-size:.9rem;font-weight:700;color:#9ddf8c;font-family:var(--ff-mono,monospace);min-width:38px;text-align:right">'+c.score+'</span>';
        h+='</div>';
      });
      h+='</details>';
      h+='</div>';
    }
    // ─ Build 105 : Sideboard analysis ─
    if(report.sideboardAnalysis&&report.sideboardAnalysis.checked){
      var sba=report.sideboardAnalysis;
      var sbCol=sba.blindSpots.length===0?'#9ddf8c':sba.blindSpots.length<=2?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">📚 Sideboard ('+sba.sideCount+'/'+sba.expected+' cartes)</div>';
      h+='<div style="color:'+sbCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(sba.verdict)+'</div>';
      h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px">';
      Object.keys(sba.coverage).forEach(function(k){
        var v=sba.coverage[k];var ok=v>=1;
        h+='<div style="padding:8px 10px;background:rgba(74,160,232,.04);border:.5px solid '+(ok?'#9ddf8c':'#e8847b')+';border-radius:8px;text-align:center"><div style="font-size:.62rem;color:var(--tx3);letter-spacing:.06em;text-transform:uppercase;font-weight:700">'+_esc(k)+' hate</div><div style="font-size:1.15rem;font-weight:700;color:'+(ok?'#9ddf8c':'#e8847b')+';font-family:var(--ff-mono,monospace);margin-top:2px">'+v+'</div></div>';
      });
      h+='</div>';
      h+='</div>';
    }
    // ─ Build 105 : Tournament viability ─
    if(report.tournamentViability&&report.tournamentViability.checked){
      var tv=report.tournamentViability;
      var tvCol=tv.score>=75?'#9ddf8c':tv.score>=55?'#f0c84a':'#e8847b';
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">🏆 Tournament viability — '+_esc(tv.format)+'</div>';
      h+='<div style="color:'+tvCol+';font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(tv.verdict)+'</div>';
      h+='<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:9px"><span style="font-size:1.8rem;font-weight:700;color:'+tvCol+';font-family:var(--ff-mono,monospace)">'+tv.score+'</span><span style="font-size:.84rem;color:var(--tx3)">/100</span></div>';
      if(tv.notes.length){
        h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:5px">Points faibles</div>';
        tv.notes.forEach(function(n){
          h+='<div style="padding:6px 10px;background:rgba(240,200,74,.06);border-left:3px solid #f0c84a;border-radius:0 6px 6px 0;margin-bottom:4px;font-size:.78rem;color:var(--tx2)">'+_esc(n)+'</div>';
        });
      }
      if(tv.topMetaDecks&&tv.topMetaDecks.length){
        h+='<div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin:9px 0 5px 0">Adversaires probables ('+_esc(tv.format)+')</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
        tv.topMetaDecks.forEach(function(d){
          h+='<span style="padding:3px 9px;background:rgba(180,140,220,.06);border:.5px solid rgba(180,140,220,.30);border-radius:99px;font-size:.74rem;color:var(--tx)">'+_esc(d.deck)+' <b style="color:#b48cdc;font-family:var(--ff-mono,monospace);font-size:.66rem">'+_esc(d.share)+'</b></span>';
        });
        h+='</div>';
      }
      h+='</div>';
    }
    // ─ Build 105 : Deck cost optimization ─
    if(report.deckCostOptimization&&report.deckCostOptimization.checked&&report.deckCostOptimization.suggestions.length){
      var co=report.deckCostOptimization;
      h+='<div class="anapro-card">';
      h+='<div class="anapro-cat">💰 Downgrade budget — économies potentielles</div>';
      h+='<div style="color:#9ddf8c;font-weight:700;font-size:.88rem;margin-bottom:9px">'+_esc(co.verdict)+'</div>';
      h+='<div style="font-size:.74rem;color:var(--tx3);margin-bottom:10px;line-height:1.5">Pour chaque carte premium détectée, un remplaçant budget avec rôle équivalent.</div>';
      co.suggestions.forEach(function(s){
        h+='<div style="display:flex;align-items:center;gap:9px;padding:7px 11px;background:rgba(126,200,106,.04);border-left:3px solid #9ddf8c;border-radius:0 6px 6px 0;margin-bottom:5px;font-size:.8rem">';
        h+='<span style="color:#fff;font-weight:600">'+_esc(s.original)+'</span>';
        h+='<span style="font-size:.7rem;color:var(--tx3)">→</span>';
        h+='<span style="color:#9ddf8c;font-weight:600">'+_esc(s.cheap)+'</span>';
        h+='<span style="font-size:.7rem;color:var(--tx3);font-style:italic;margin-left:auto">'+_esc(s.role)+'</span>';
        h+='<span style="font-size:.78rem;font-weight:700;color:#9ddf8c;font-family:var(--ff-mono,monospace)">~$'+s.savings+'</span>';
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  return {
    detectWinCons:detectWinCons,
    manabaseByColor:manabaseByColor,
    bracketEDH:bracketEDH,
    detectCombos:detectCombos,
    antiSynergies:antiSynergies,
    keywordsAlignment:keywordsAlignment,
    robustness:robustness,
    legalityCheck:legalityCheck,
    suggestSwaps:suggestSwaps,
    manaEfficiency:manaEfficiency,
    winconRedundancy:winconRedundancy,
    mulliganProbability:mulliganProbability,
    threatDensityByTurn:threatDensityByTurn,
    curveSmoothness:curveSmoothness,
    removalCoverage:removalCoverage,
    landUpgrades:landUpgrades,
    castabilityByCMC:castabilityByCMC,
    cardAdvantageNet:cardAdvantageNet,
    curveOutProbability:curveOutProbability,
    stackInteraction:stackInteraction,
    velocity:velocity,
    inevitability:inevitability,
    recoveryTimePostWrath:recoveryTimePostWrath,
    tempoLoss:tempoLoss,
    mustAnswerThreats:mustAnswerThreats,
    antiMetaPositioning:antiMetaPositioning,
    synergyOrphans:synergyOrphans,
    manaProductionCurve:manaProductionCurve,
    combatMath:combatMath,
    threatsKillableScope:threatsKillableScope,
    edhrecInclusion:edhrecInclusion,
    coachNarrative:coachNarrative,
    compareReports:compareReports,
    suggestTribalCards:suggestTribalCards,
    TRIBAL_CATALOG:TRIBAL_CATALOG,
    compareTwoDecks:compareTwoDecks,
    renderCompareTwoDecks:renderCompareTwoDecks,
    loadCommanderSpellbookCombos:loadCommanderSpellbookCombos,
    extendCombosFromCSB:extendCombosFromCSB,
    detectArchetype:detectArchetype,
    edhrecCommanderAnalysis:edhrecCommanderAnalysis,
    mulliganProbabilityAsync:mulliganProbabilityAsync,
    enablerPayoffPairs:enablerPayoffPairs,
    turnToKill:turnToKill,
    internalSabotage:internalSabotage,
    tableThreatLevel:tableThreatLevel,
    simulatedGameMetrics:simulatedGameMetrics,
    handEvaluation:handEvaluation,
    politicsMultiplayer:politicsMultiplayer,
    coachSynergyAware:coachSynergyAware,
    formatAware:formatAware,
    sequencingPlan:sequencingPlan,
    manabaseOptimisation:manabaseOptimisation,
    individualCardScoring:individualCardScoring,
    replayAnalysis:replayAnalysis,
    sideboardAnalysis:sideboardAnalysis,
    tournamentViability:tournamentViability,
    deckCostOptimization:deckCostOptimization,
    renderDiff:renderDiff,
    coachTopFixes:coachTopFixes,
    analyzeCached:analyzeCached,
    analyze:analyze,
    render:render,
    COMBOS:COMBOS,
    GAME_CHANGERS:GAME_CHANGERS,
    MLD_CARDS:MLD_CARDS,
    META_VERSION:META_VERSION,
    META_UPDATED:META_UPDATED,
    KEYWORDS_BY_PLAN:KEYWORDS_BY_PLAN,
    CARD_TIERS:CARD_TIERS,
    ROLE_BENCHMARKS:ROLE_BENCHMARKS,
    STAPLE_CMC:STAPLE_CMC
  };
})();
