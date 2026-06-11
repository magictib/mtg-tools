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
  function suggestSwaps(rows,deck){
    if(!deck)return {byRole:{}};
    // Build 97 : détection tribale pour protéger les créatures du tribe
    var dominantTribe=_detectDominantTribe(rows);
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
          // Build 97 : protection tribale — créatures du tribe dominant ne sont
          // PAS considérées comme « faibles à swap » même si elles ont un tier
          // bas. Elles sont des payoffs tribaux non-interchangeables.
          var isTribal=dominantTribe&&_isInTribe(r.meta,dominantTribe.tribe);
          var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
          var isCreature=/creature/.test(tl);
          if(isTribal&&isCreature){tribeProtected++;return;}
          deckCards.push({name:r.card&&r.card.name||r.name,nl:nl,power:_powerOfCard(nl,role,r.meta),qty:r.qty||1});
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
    // Build 97 : détection tribale — protection des créatures du tribe
    var dominantTribe=_detectDominantTribe(rows);
    var tribeProtectedCount=0;
    // Indice par rôle des cartes du deck
    var byRole={};
    rows.forEach(function(r){
      var nl=_nlOf(r.card&&r.card.name||r.name);
      var role=_detectCardRole(r.meta);
      if(!role)return;
      // Protection : si la carte est une créature du tribe dominant, on l'exclut
      // des suggestions d'overcost. Les tribal payoffs ne sont pas interchangeables.
      var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
      var isCreature=/creature/.test(tl);
      if(dominantTribe&&isCreature&&_isInTribe(r.meta,dominantTribe.tribe)){
        tribeProtectedCount++;
        return;
      }
      var cmc=(r.meta&&typeof r.meta.cmc==='number')?r.meta.cmc:null;
      // Power = tier connu, sinon base
      var power=_powerOfCard(nl,role,r.meta);
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
  var INEVITABILITY_CARDS = [
    'aetherflux reservoir','approach of the second sun','mortal combat','helix pinnacle',
    'mayael\'s aria','maze\'s end','felidar sovereign','test of endurance',
    'triskaidekaphobia','near-death experience','simic ascendancy','revel in riches',
    'coalition victory','barren glory','epic struggle','azor\'s elocutors',
    'hellkite tyrant','mechtitan core','laboratory maniac','jace, wielder of mysteries',
    'thassa\'s oracle','blightsteel colossus','marit lage','vraska\'s contempt',
    'dragon\'s approach','jaya\'s greeting'
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
  var TEMPO_LOSS_CARDS = [
    'necropotence','sylvan library','phyrexian arena','bolas\'s citadel',
    'aetherflux reservoir','rhystic study','mystic remora','smothering tithe',
    'guardian project','beast whisperer','underworld breach','dramatic reversal'
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
  var MUST_ANSWER = [
    'yawgmoth, thran physician','smothering tithe','underworld breach','rhystic study',
    'mystic remora','esper sentinel','sythis, harvest\'s hand','tergrid, god of fright',
    'krenko, mob boss','yuriko, the tiger\'s shadow','najeela, the blade-blossom',
    'kinnan, bonder prodigy','urza, lord high artificer','god-eternal kefnet',
    'consecrated sphinx','aetherflux reservoir','bolas\'s citadel','necropotence',
    'sheoldred, the apocalypse','blood moon','back to basics','winter orb','static orb',
    'thalia, guardian of thraben','collector ouphe','null rod','stony silence',
    'rest in peace','leyline of the void','grafdigger\'s cage'
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

  // ─── 29. COMBAT MATH (créatures vs blockeurs typiques) ────────────────
  function combatMath(rows,deck){
    var atkPow=0,atkN=0,defPow=0,defN=0;
    var fmt=(deck&&deck.format||'').toLowerCase();
    var avgBlocker=fmt==='commander'||fmt==='paupercmd'||fmt==='oathbreaker'?3:fmt==='modern'?3:fmt==='pauper'?2:3;
    rows.forEach(function(r){
      var m=r.meta||{};var tl=(m.typeLine||'').toLowerCase();
      if(!/creature/.test(tl))return;
      var p=parseInt(m.power||'0',10)||0;
      var t=parseInt(m.toughness||'0',10)||0;
      var qty=r.qty||1;
      atkPow+=p*qty;atkN+=qty;defPow+=t*qty;defN+=qty;
    });
    var avgAtk=atkN?(atkPow/atkN).toFixed(1):0;
    var avgDef=defN?(defPow/defN).toFixed(1):0;
    return {
      avgAttackerPower:avgAtk,avgDefenderToughness:avgDef,
      typicalBlocker:avgBlocker,
      verdict:avgAtk>=avgBlocker?'✓ Tes attaquants passent (avg '+avgAtk+' vs blockeur '+avgBlocker+')':'⚠ Tes attaquants trop faibles (avg '+avgAtk+' vs blockeur '+avgBlocker+')'
    };
  }

  // ─── 30. THREATS KILLABLE SCOPE (universal vs conditional) ─────────────
  function threatsKillableScope(rows){
    var universal=0,creatureOnly=0,nonlandOnly=0,conditional=0;
    rows.forEach(function(r){
      var m=r.meta||{};var ot=(m.oracleText||'').toLowerCase();var qty=r.qty||1;
      // Universal (destroy/exile target nonland permanent or target permanent)
      if(/destroy target nonland permanent|exile target nonland permanent|destroy target permanent|beast within|generous gift/.test(ot)){
        universal+=qty;return;
      }
      // Non-land specific (artifact OR enchant OR creature OR PW)
      if(/destroy target (artifact|enchantment|creature|planeswalker)|exile target/.test(ot)){
        if(/creature.*only/.test(ot)||/destroy target creature(\s|$|\.|,)/.test(ot))creatureOnly+=qty;
        else nonlandOnly+=qty;
        return;
      }
      // Conditional (e.g. "if it's red", "with toughness 3 or less")
      if(/if it's|with .* or less|with .* or greater/.test(ot)){
        conditional+=qty;return;
      }
    });
    return {
      universal:universal,creatureOnly:creatureOnly,nonlandOnly:nonlandOnly,conditional:conditional,
      universalPct:universal+creatureOnly+nonlandOnly?Math.round(universal/(universal+creatureOnly+nonlandOnly)*100):0,
      verdict:universal>=3?'✓ Removal flexible et universel':universal>=1?'~ Quelques removals universels':'⚠ Removal trop conditionnel'
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
      try{
        var cardlists=(data.container&&data.container.json_dict&&data.container.json_dict.cardlists)||[];
        cardlists.forEach(function(list){
          (list.cardviews||[]).forEach(function(cv){
            if(cv.name&&!cv.cmc_only)topRecs.push({name:cv.name,inclusion:cv.inclusion||0,synergy:cv.synergy||0,category:list.header||'?'});
          });
        });
      }catch(_){}
      // Croisement avec le deck
      var deckSet={};rows.forEach(function(r){var nl=_nlOf(r.card&&r.card.name||r.name);if(nl)deckSet[nl]=true;});
      var missing=topRecs.filter(function(c){return !deckSet[_nlOf(c.name)];}).slice(0,12);
      var rare=[];
      // Cartes présentes dans deck mais low-inclusion sur EDHrec
      var inclusionMap={};
      topRecs.forEach(function(c){inclusionMap[_nlOf(c.name)]=c.inclusion;});
      rows.forEach(function(r){
        var nl=_nlOf(r.card&&r.card.name||r.name);
        var meta=r.meta||{};var tl=(meta.typeLine||'').toLowerCase();
        if(/land/.test(tl))return;
        // Carte « rare » : présente dans EDHrec data mais inclusion < 5%
        if(inclusionMap[nl]!=null&&inclusionMap[nl]<5)rare.push({name:r.card&&r.card.name||r.name,inclusion:inclusionMap[nl]});
      });
      callback&&callback({
        checked:true,
        commander:cmdName,
        topRecommendations:missing,
        spicyCards:rare.slice(0,8),
        totalAnalyzed:topRecs.length,
        verdict:missing.length===0?'✓ Tu as déjà tous les staples EDHrec':'Top '+missing.length+' staples EDHrec absents'
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

  // ─── 34. RAPPORT GLOBAL ────────────────────────────────────────────────
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
      timestamp:Date.now()
    };
    // Build 94 : narrative est calculée APRÈS car elle synthétise tout
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
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
    h+='<span style="font-size:.62rem;color:#7ec0f0;letter-spacing:.14em;text-transform:uppercase;font-weight:700">🔬 Analyse Pro · 15 axes</span>';
    h+='<span style="flex:1"></span>';
    h+='<button onclick="if(typeof anaProCompareDecks===\'function\')anaProCompareDecks()" style="font-size:.72rem;padding:4px 10px;background:rgba(180,140,220,.14);border:.5px solid rgba(180,140,220,.4);border-radius:6px;color:#b48cdc;cursor:pointer;font-family:inherit;margin-right:6px" title="Comparer ce deck avec un autre side-by-side">🆚 Compare</button>';
    h+='<button onclick="if(typeof anaProRunEdhrec===\'function\')anaProRunEdhrec()" style="font-size:.72rem;padding:4px 10px;background:rgba(126,200,106,.14);border:.5px solid rgba(126,200,106,.4);border-radius:6px;color:#9ddf8c;cursor:pointer;font-family:inherit;margin-right:6px" title="Analyse contextuelle EDHrec par commandant">🌐 EDHrec</button>';
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
    // ─ 9b. Efficience mana (build 91) ─ avant les suggestions par tier
    if(report.efficiency&&report.efficiency.byRole){
      var eff=report.efficiency.byRole;
      var hasOvercost=Object.keys(eff).some(function(r){return eff[r].overcost&&eff[r].overcost.length;});
      if(hasOvercost){
        var roleEffLbl={ramp:'⛰ Ramp',draw:'📜 Pioche',removal:'🗡 Removal',interaction:'🛡 Interaction',
          wipe:'💥 Wraths',tutor:'🔮 Tutors',counter:'✋ Contresorts',landFix:'🌐 Fixers'};
        h+='<div class="anapro-card" style="border-color:rgba(240,200,74,.42)">';
        h+='<div class="anapro-cat" style="color:#f0c84a">⚡ Efficience mana — coût / effet</div>';
        // Build 97 : avis de protection tribale
        if(report.efficiency.dominantTribe){
          var dt=report.efficiency.dominantTribe;
          h+='<div style="padding:8px 12px;background:rgba(180,140,220,.06);border:.5px solid rgba(180,140,220,.30);border-radius:7px;margin-bottom:10px;font-size:.78rem;color:var(--tx2);line-height:1.5">🛡 <b style="color:#b48cdc">Thème tribal détecté : '+_esc(dt.tribe)+'</b> ('+dt.count+' cartes). Les créatures '+_esc(dt.tribe)+' sont <b>protégées des suggestions de swap</b> — elles sont des payoffs tribaux, pas des cartes interchangeables. '+report.efficiency.tribeProtectedCount+' créature(s) exclue(s) du diagnostic.</div>';
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
    // Combat
    if(report.combatMath&&report.combatMath.avgAttackerPower){
      var cm=report.combatMath;
      insights.push({title:'⚔ Combat math',value:cm.avgAttackerPower+' avg',
        col:parseFloat(cm.avgAttackerPower)>=cm.typicalBlocker?'#9ddf8c':'#f0c84a',
        sub:'vs blockeur '+cm.typicalBlocker+' (format '+(report.bracket?'Cmd':'?')+')'});
    }
    // Threats killable scope
    if(report.threatsKillableScope){
      var tk=report.threatsKillableScope;
      insights.push({title:'🎯 Removal universel',value:tk.universalPct+'%',
        col:tk.universalPct>=30?'#9ddf8c':tk.universalPct>=15?'#f0c84a':'#e8847b',
        sub:tk.universal+' universal · '+tk.creatureOnly+' creature-only'});
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
    compareTwoDecks:compareTwoDecks,
    renderCompareTwoDecks:renderCompareTwoDecks,
    loadCommanderSpellbookCombos:loadCommanderSpellbookCombos,
    extendCombosFromCSB:extendCombosFromCSB,
    detectArchetype:detectArchetype,
    edhrecCommanderAnalysis:edhrecCommanderAnalysis,
    mulliganProbabilityAsync:mulliganProbabilityAsync,
    renderDiff:renderDiff,
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
