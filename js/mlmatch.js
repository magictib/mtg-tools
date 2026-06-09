/* ═══════════════════════════════════════════════════════════════════════════
   MLMATCH — Companion match mobile (life counter deck-aware).
   Extrait de index.html au build 68 pour maintenabilité.
   Expose sur window : _matchState, matchStart/Exit/Teardown/Life/UpdateUI/Log/
                       Toss/Roll/Mulligan/Sideboard/OpenMenu/End
   Dépend de globaux : actDeck, decks, dCardMeta, toast, toastError,
                       mlPlaySound, mlVibratePulse, mlVibrateDrop, mlVibrateAchievement,
                       mlCheckAchievementsOnMatch, _quickMatchSave, mlTrack
   Tous attendus disponibles au moment où l'utilisateur clique « 🎮 Match ».
═══════════════════════════════════════════════════════════════════════════ */
var _matchState=null;          // {deckId, lifeMe, lifeOpp, startTs, events:[]}
var _matchWakeLock=null;       // Screen wake lock (s'il existe)
function matchStart(deckId){
  if(!deckId)deckId=actDeck;
  if(!deckId||!decks[deckId]){if(typeof toastError==='function')toastError('Ouvre un deck d\'abord');return;}
  var deck=decks[deckId];
  var fmt=(deck.format||'').toLowerCase();
  // Vie de départ selon format (Commander = 40, sinon 20)
  var startLife=(fmt==='commander'||fmt==='paupercmd'||fmt==='brawl'||fmt==='oathbreaker')?40:20;
  _matchState={
    deckId:deckId,
    deckName:deck.name||'(deck sans nom)',
    lifeMe:startLife,lifeOpp:startLife,
    startLife:startLife,
    startTs:Date.now(),
    events:[],
    sideboardSeen:false
  };
  // UI
  document.body.classList.add('match-active');
  matchUpdateUI();
  document.getElementById('match-title').textContent='🎮 '+(deck.name||'Match');
  document.getElementById('match-p-name-me').textContent='Moi ('+(deck.name||'mon deck').slice(0,28)+')';
  // Wake lock (Chrome/Edge/Safari récents)
  try{
    if('wakeLock' in navigator){
      navigator.wakeLock.request('screen').then(function(wl){_matchWakeLock=wl;}).catch(function(){});
    }
  }catch(e){}
  // Son / vibration
  try{mlPlaySound&&mlPlaySound('whoosh');mlVibratePulse&&mlVibratePulse();}catch(e){}
  // Coup d'envoi auto
  matchLog('start','Vie de départ : '+startLife+' ('+ (fmt||'libre')+')');
}
function matchExit(){
  if(!_matchState)return;
  // Si une partie en cours sans résultat → demande confirmation
  if(_matchState.events.length>0 && !_matchState.result){
    var ok=confirm('Quitter sans enregistrer le résultat ? Le log sera perdu.');
    if(!ok)return;
  }
  matchTeardown();
}
function matchTeardown(){
  document.body.classList.remove('match-active');
  try{if(_matchWakeLock&&_matchWakeLock.release)_matchWakeLock.release();}catch(e){}
  _matchWakeLock=null;_matchState=null;
}
function matchLife(who,delta){
  if(!_matchState)return;
  if(who==='me')_matchState.lifeMe+=delta;
  else _matchState.lifeOpp+=delta;
  matchUpdateUI();
  matchLog('life',(who==='me'?'Moi':'Adversaire')+' '+(delta>0?'+':'')+delta+' → '+(who==='me'?_matchState.lifeMe:_matchState.lifeOpp));
  try{mlPlaySound&&mlPlaySound(delta>0?'pop':'click');mlVibratePulse&&mlVibratePulse();}catch(e){}
  // Alertes utiles
  if(who==='me'&&_matchState.lifeMe<=0){matchLog('danger','💀 Tu es à 0 vie !');}
  if(who==='opp'&&_matchState.lifeOpp<=0){matchLog('danger','🏆 Adversaire à 0 vie !');}
}
function matchUpdateUI(){
  if(!_matchState)return;
  var me=document.getElementById('match-life-me');if(me)me.textContent=_matchState.lifeMe;
  var op=document.getElementById('match-life-opp');if(op)op.textContent=_matchState.lifeOpp;
}
function matchLog(type,msg){
  if(!_matchState)return;
  _matchState.events.push({t:Date.now()-_matchState.startTs,type:type,msg:msg});
}
function matchToss(){
  var r=Math.random()<0.5?'Pile':'Face';
  if(typeof toast==='function')toast('🪙 '+r);
  matchLog('toss','Pile/face : '+r);
  try{mlPlaySound&&mlPlaySound('whoosh');mlVibratePulse&&mlVibratePulse();}catch(e){}
}
function matchRoll(){
  var r=1+Math.floor(Math.random()*20);
  if(typeof toast==='function')toast('🎲 D20 : '+r);
  matchLog('roll','D20 : '+r);
  try{mlPlaySound&&mlPlaySound(r===20?'cha-ching':(r===1?'error':'pop'));mlVibratePulse&&mlVibratePulse();}catch(e){}
}
function matchMulligan(){
  if(!_matchState)return;
  // Heuristique simple : recommande ≥2 lands et au moins 1 carte CMC ≤ 3 pour Commander
  var deck=decks[_matchState.deckId];if(!deck){if(typeof toast==='function')toast('Pas de deck actif');return;}
  var fmt=(deck.format||'').toLowerCase();
  var isCmd=fmt==='commander'||fmt==='paupercmd'||fmt==='brawl'||fmt==='oathbreaker';
  var handSize=isCmd?7:7;
  // Compte lands et CMC dans le deck
  var landRatio=0,lowCmcRatio=0,totC=0;
  (deck.cards||[]).forEach(function(c){
    var meta=(typeof dCardMeta!=='undefined')?dCardMeta[c.nl]:null;
    if(!meta)return;
    var qty=c.qty||1;totC+=qty;
    var tl=(meta.typeLine||'').toLowerCase();
    if(tl.indexOf('land')>=0)landRatio+=qty;
    if((meta.cmc||0)<=3 && tl.indexOf('land')<0)lowCmcRatio+=qty;
  });
  if(!totC){if(typeof toast==='function')toast('Données du deck pas encore chargées');return;}
  var pLand=landRatio/totC, pLow=lowCmcRatio/totC;
  // Espérance dans une main de 7
  var expLand=Math.round(pLand*handSize*10)/10;
  var expLow=Math.round(pLow*handSize*10)/10;
  var advice='';
  if(pLand<0.30||pLand>0.50)advice='⚠ Ratio terrains atypique ('+(pLand*100).toFixed(0)+'%) — vise 33-42% en Commander.';
  else advice='✓ Ratio terrains OK ('+(pLand*100).toFixed(0)+'%).';
  var msg='Pour ton deck : tu peux espérer en main de '+handSize+' ~ '+expLand+' terrains et ~ '+expLow+' cartes ≤3 CMC.\n\n'
    +'Règle simple :\n• Garde si ≥ 2 terrains ET ≥ 1 carte ≤ 3 CMC\n• Mulligan si 0-1 terrain OU 7 cartes chères\n\n'+advice;
  alert('🃏 Mulligan helper\n\n'+msg);
  matchLog('mulligan','Mulligan helper consulté (lands '+(pLand*100).toFixed(0)+'%, lowCMC '+(pLow*100).toFixed(0)+'%)');
}
function matchSideboard(){
  if(!_matchState)return;
  var deck=decks[_matchState.deckId];if(!deck){if(typeof toast==='function')toast('Pas de deck');return;}
  // Section sideboard du deck
  var sb=(deck.cards||[]).filter(function(c){return /side/i.test(c.sec||'')||/sideboard/i.test(c.sec||'');});
  if(!sb.length){
    alert('🎯 Sideboard\n\nCe deck n\'a pas de sideboard renseigné.\n\nAjoute des cartes avec la section "Sideboard" dans l\'Atelier pour les voir ici pendant la partie.');
    matchLog('sideboard','Pas de sideboard');
    return;
  }
  var lines=sb.map(function(c){return '• '+(c.qty||1)+'× '+c.name;}).join('\n');
  alert('🎯 Sideboard ('+sb.length+' carte'+(sb.length>1?'s':'')+')\n\n'+lines+'\n\nChoisis tes swaps pour le jeu 2.');
  _matchState.sideboardSeen=true;
  matchLog('sideboard','Sideboard consulté ('+sb.length+' cartes)');
}
function matchOpenMenu(){
  if(!_matchState)return;
  var dur=Math.round((Date.now()-_matchState.startTs)/1000);
  var mins=Math.floor(dur/60),secs=dur%60;
  var lines=[
    '⏱ Durée : '+mins+'m '+secs+'s',
    '❤ Toi : '+_matchState.lifeMe+' / '+_matchState.startLife,
    '🩸 Adv : '+_matchState.lifeOpp+' / '+_matchState.startLife,
    '📋 Événements logués : '+_matchState.events.length,
    '',
    'Tape OK pour réinitialiser les vies au niveau de départ.',
    'Annule pour ignorer.'
  ];
  if(confirm(lines.join('\n'))){
    _matchState.lifeMe=_matchState.startLife;_matchState.lifeOpp=_matchState.startLife;
    matchUpdateUI();
    matchLog('reset','Reset des vies');
  }
}
function matchEnd(result){
  if(!_matchState)return;
  _matchState.result=result;
  matchLog('end','Résultat : '+result);
  if(typeof mlTrack==='function')mlTrack('Match Ended',{result:result});
  // Sauvegarde via _quickMatchSave si dispo, sinon fallback localStorage
  var payload={
    deckId:_matchState.deckId,
    deckName:_matchState.deckName,
    result:result,
    lifeMe:_matchState.lifeMe,
    lifeOpp:_matchState.lifeOpp,
    durationSec:Math.round((Date.now()-_matchState.startTs)/1000),
    events:_matchState.events,
    ts:Date.now()
  };
  try{
    if(typeof _quickMatchSave==='function'){
      _quickMatchSave(payload);
    }else{
      var k='mtg_match_log';
      var arr=[];try{arr=JSON.parse(localStorage.getItem(k)||'[]');}catch(e){}
      arr.unshift(payload);arr=arr.slice(0,200);
      try{localStorage.setItem(k,JSON.stringify(arr));}catch(e){}
    }
  }catch(e){}
  try{
    mlPlaySound&&mlPlaySound(result==='win'?'cha-ching':'error');
    mlVibrateAchievement&&result==='win'&&mlVibrateAchievement();
    mlCheckAchievementsOnMatch&&mlCheckAchievementsOnMatch(result);
  }catch(e){}
  if(typeof toast==='function')toast(result==='win'?'🏆 Victoire enregistrée':'💀 Défaite enregistrée');
  matchTeardown();
}
// Esc pour quitter (avec confirmation si log)
(function(){
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&_matchState){e.preventDefault();matchExit();}
    // Raccourcis vies (uniquement quand pas d'input focusé)
    if(!_matchState)return;
    if(/^(INPUT|TEXTAREA)$/.test(e.target.tagName))return;
    if(e.key==='ArrowUp'){e.preventDefault();matchLife('me',1);}
    else if(e.key==='ArrowDown'){e.preventDefault();matchLife('me',-1);}
    else if(e.key==='+'||e.key==='='){e.preventDefault();matchLife('me',1);}
    else if(e.key==='-'){e.preventDefault();matchLife('me',-1);}
  });
})();
