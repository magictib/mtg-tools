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

  // ─── 8. RAPPORT GLOBAL ─────────────────────────────────────────────────
  function analyze(deck,rows){
    if(!deck||!Array.isArray(rows))return null;
    var winCons=detectWinCons(rows,deck);
    var mana=manabaseByColor(rows,deck);
    var bracket=bracketEDH(rows,deck);
    var combos=detectCombos(rows,deck,winCons);
    var anti=antiSynergies(rows,deck);
    var keywords=keywordsAlignment(rows,winCons);
    var robust=robustness(rows,deck);
    return {
      winCons:winCons,
      manabase:mana,
      bracket:bracket,
      combos:combos,
      antiSynergies:anti,
      keywords:keywords,
      robustness:robust,
      timestamp:Date.now()
    };
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
    h+='<span style="font-size:.62rem;color:#7ec0f0;letter-spacing:.14em;text-transform:uppercase;font-weight:700">🔬 Analyse Pro · Diagnostic complet</span>';
    h+='</div>';
    h+='<div style="font-size:.84rem;color:var(--tx2);line-height:1.5">Détection déterministe : win conditions, manabase WUBRG, bracket EDH, combos infinis, anti-synergies. Aucun LLM, résultats reproductibles.</div>';
    h+='</div>';
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
    analyze:analyze,
    render:render,
    COMBOS:COMBOS,
    GAME_CHANGERS:GAME_CHANGERS,
    MLD_CARDS:MLD_CARDS,
    KEYWORDS_BY_PLAN:KEYWORDS_BY_PLAN
  };
})();
