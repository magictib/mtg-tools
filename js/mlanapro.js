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
    {n:'Test of Endurance',cards:['test of endurance'],result:'alt-win (50+ PV)',mana:4,turn:5,types:['alt-win']}
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
  function antiSynergies(rows,deck){
    var issues=[];
    if(!deck||!deck.commander||!deck.commander.name)return {issues:[]};
    var cmd=deck.commander.name.toLowerCase();
    var set=_cardSet(rows);
    // Quelques règles ciblées de cohérence
    // Atraxa, Praetors' Voice → besoin de proliferate + +1+1
    if(/atraxa.*praetors/.test(cmd)){
      var prolifCount=0,countersGen=0;
      rows.forEach(function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        if(/proliferate/.test(ot))prolifCount++;
        if(/\+1\/\+1 counter/.test(ot))countersGen++;
      });
      if(prolifCount<5)issues.push({sev:'high',msg:'Atraxa → seulement '+prolifCount+' sources de proliferate (idéal 10+)'});
      if(countersGen<8)issues.push({sev:'med',msg:'Atraxa → seulement '+countersGen+' sources de +1/+1 counters (idéal 15+)'});
    }
    // Yuriko → besoin de créatures évasives
    if(/yuriko, the tiger/.test(cmd)){
      var evasive=0,bigTop=0;
      rows.forEach(function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
        var cmc=r.meta&&r.meta.cmc||0;
        if(/creature/.test(tl)&&/flying|menace|unblockable|shadow|horsemanship|skulk/.test(ot))evasive++;
        if(/creature/.test(tl)&&cmc>=5)bigTop++;
      });
      if(evasive<8)issues.push({sev:'high',msg:'Yuriko → seulement '+evasive+' créatures évasives (idéal 15+ pour déclencher le ninjutsu)'});
      if(bigTop<10)issues.push({sev:'med',msg:'Yuriko → seulement '+bigTop+' « gros » en top (idéal 15+ pour dmg burst)'});
    }
    // Edric → besoin de petites créatures unblockable
    if(/edric, spymaster/.test(cmd)){
      var unblock=0;
      rows.forEach(function(r){
        var ot=(r.meta&&r.meta.oracleText||'').toLowerCase();
        var cmc=r.meta&&r.meta.cmc||0;
        if(cmc<=2&&/can't be blocked|unblockable|shadow|skulk/.test(ot))unblock++;
      });
      if(unblock<12)issues.push({sev:'high',msg:'Edric → seulement '+unblock+' créatures unblockable ≤2 mana (idéal 20+)'});
    }
    // Krenko → besoin de créatures Goblin
    if(/krenko/.test(cmd)){
      var goblins=0;
      rows.forEach(function(r){
        var tl=(r.meta&&r.meta.typeLine||'').toLowerCase();
        if(/goblin/.test(tl))goblins++;
      });
      if(goblins<20)issues.push({sev:'high',msg:'Krenko → seulement '+goblins+' Goblins (idéal 30+)'});
    }
    return {issues:issues};
  }

  // ─── 6. RAPPORT GLOBAL ─────────────────────────────────────────────────
  function analyze(deck,rows){
    if(!deck||!Array.isArray(rows))return null;
    var winCons=detectWinCons(rows,deck);
    var mana=manabaseByColor(rows,deck);
    var bracket=bracketEDH(rows,deck);
    var combos=detectCombos(rows,deck,winCons);
    var anti=antiSynergies(rows,deck);
    return {
      winCons:winCons,
      manabase:mana,
      bracket:bracket,
      combos:combos,
      antiSynergies:anti,
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
    h+='</div>';
    return h;
  }

  return {
    detectWinCons:detectWinCons,
    manabaseByColor:manabaseByColor,
    bracketEDH:bracketEDH,
    detectCombos:detectCombos,
    antiSynergies:antiSynergies,
    analyze:analyze,
    render:render,
    COMBOS:COMBOS,
    GAME_CHANGERS:GAME_CHANGERS,
    MLD_CARDS:MLD_CARDS
  };
})();
