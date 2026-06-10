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
  function _powerOfCard(nl,role){
    if(!CARD_TIERS[role])return TIER_BASE;
    return CARD_TIERS[role][nl]||TIER_BASE;
  }
  function suggestSwaps(rows,deck){
    if(!deck)return {byRole:{}};
    // Identifie pour chaque rôle :
    // 1. Les cartes du deck classées par tier (du plus faible au plus fort)
    // 2. Les suggestions S/A non-présentes
    var inDeck={};rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);if(nl)inDeck[nl]=true;
    });
    var byRole={};
    Object.keys(CARD_TIERS).forEach(function(role){
      var deckCards=[];
      rows.forEach(function(r){
        var nl=_nlOf(r.card&&r.card.name||r.name);
        var detRole=_detectCardRole(r.meta);
        // On compte la carte si son rôle détecté match OU si elle est dans le tier
        if(detRole===role||CARD_TIERS[role][nl]){
          deckCards.push({name:r.card&&r.card.name||r.name,nl:nl,power:_powerOfCard(nl,role),qty:r.qty||1});
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
        topInDeck:deckCards.slice(-3).reverse()
      };
    });
    return {byRole:byRole};
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
    // Indice par rôle des cartes du deck
    var byRole={};
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var role=_detectCardRole(r.meta);
      if(!role)return;
      var cmc=(r.meta&&typeof r.meta.cmc==='number')?r.meta.cmc:null;
      // Power = tier connu, sinon base
      var power=_powerOfCard(nl,role);
      var impact=cmc!=null?_impactScore(power,cmc):power;
      byRole[role]=byRole[role]||{cards:[]};
      byRole[role].cards.push({name:r.card&&r.card.name||r.name,nl:nl,cmc:cmc,power:power,impact:impact});
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
    return {byRole:byRole};
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

  // ─── 17. RAPPORT GLOBAL ────────────────────────────────────────────────
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
      timestamp:Date.now()
    };
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
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
    h+='<span style="font-size:.62rem;color:#7ec0f0;letter-spacing:.14em;text-transform:uppercase;font-weight:700">🔬 Analyse Pro · 15 axes</span>';
    h+='<span style="flex:1"></span>';
    h+='<button onclick="if(typeof anaProExportPdf===\'function\')anaProExportPdf()" style="font-size:.72rem;padding:4px 10px;background:rgba(74,160,232,.14);border:.5px solid rgba(74,160,232,.4);border-radius:6px;color:#7ec0f0;cursor:pointer;font-family:inherit" title="Exporter le rapport en PDF">📄 PDF</button>';
    h+='</div>';
    h+='<div style="font-size:.84rem;color:var(--tx2);line-height:1.5">Diagnostic complet déterministe : plan A + Plan B / manabase / bracket / combos / anti-synergies / mulligan probability / threat density / lissage courbe / removal coverage. Aucun LLM, résultats reproductibles, cache localStorage.</div>';
    h+='</div>';
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
    // ─ 9b. Efficience mana (build 91) ─ avant les suggestions par tier
    if(report.efficiency&&report.efficiency.byRole){
      var eff=report.efficiency.byRole;
      var hasOvercost=Object.keys(eff).some(function(r){return eff[r].overcost&&eff[r].overcost.length;});
      if(hasOvercost){
        var roleEffLbl={ramp:'⛰ Ramp',draw:'📜 Pioche',removal:'🗡 Removal',interaction:'🛡 Interaction',
          wipe:'💥 Wraths',tutor:'🔮 Tutors',counter:'✋ Contresorts',landFix:'🌐 Fixers'};
        h+='<div class="anapro-card" style="border-color:rgba(240,200,74,.42)">';
        h+='<div class="anapro-cat" style="color:#f0c84a">⚡ Efficience mana — coût / effet</div>';
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
    coachTopFixes:coachTopFixes,
    analyzeCached:analyzeCached,
    analyze:analyze,
    render:render,
    COMBOS:COMBOS,
    GAME_CHANGERS:GAME_CHANGERS,
    MLD_CARDS:MLD_CARDS,
    KEYWORDS_BY_PLAN:KEYWORDS_BY_PLAN,
    CARD_TIERS:CARD_TIERS,
    ROLE_BENCHMARKS:ROLE_BENCHMARKS,
    STAPLE_CMC:STAPLE_CMC
  };
})();
