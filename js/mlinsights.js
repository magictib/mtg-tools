/* ═══════════════════════════════════════════════════════════════════════════
   MLINSIGHTS — générateur d'insights automatiques + rendu carte d'insights.
   Extrait de index.html au build 66 pour maintenabilité.
   Expose window.mlGenerateInsights + window._renderInsightsCard
   Dépend de : decks, _deckBelongsTo, getProfCards, esc, escJs (globaux)
═══════════════════════════════════════════════════════════════════════════ */
function mlGenerateInsights(){
  var now=Date.now();
  var w7=7*86400000, w30=30*86400000;
  var insights=[];
  // ── Data sources ──
  var matches=[];
  try{matches=JSON.parse(localStorage.getItem('mtg_match_log')||'[]');}catch(e){}
  var prog={};try{prog=JSON.parse(localStorage.getItem('mtg_progression')||'{}');}catch(e){}
  var achievs={};try{achievs=JSON.parse(localStorage.getItem('mtg_achievements')||'{}');}catch(e){}
  var myDeckIds=[];try{myDeckIds=Object.keys(decks||{}).filter(function(id){return typeof _deckBelongsTo==='function'?_deckBelongsTo(decks[id],0):true;});}catch(e){}

  // ── INSIGHT 1 : Streak en cours ──
  var streak=0;
  for(var i=0;i<matches.length;i++){if(matches[i].result==='win')streak++;else break;}
  if(streak>=3){
    insights.push({id:'streak',type:'achievement',priority:90,ico:'🔥',
      title:streak+' victoires d\'affilée !',
      body:'Tu es en feu. Continue sur cette lancée — ton dernier deck joué porte chance.',
      color:'#e88a4a'});
  }
  // ── INSIGHT 2 : Win rate progression / régression sur 30j ──
  var m30=matches.filter(function(m){return m.ts&&(now-m.ts)<w30&&(m.result==='win'||m.result==='loss');});
  var m30Prev=matches.filter(function(m){return m.ts&&(now-m.ts)>=w30&&(now-m.ts)<w30*2&&(m.result==='win'||m.result==='loss');});
  if(m30.length>=3&&m30Prev.length>=3){
    var wr30=m30.filter(function(m){return m.result==='win';}).length/m30.length*100;
    var wr30P=m30Prev.filter(function(m){return m.result==='win';}).length/m30Prev.length*100;
    var diff=wr30-wr30P;
    if(diff>=10){
      insights.push({id:'wr-up',type:'positive',priority:85,ico:'📈',
        title:'Ton win rate explose : +'+Math.round(diff)+' pts',
        body:'Sur 30 jours, tu passes de '+Math.round(wr30P)+'% à <b>'+Math.round(wr30)+'%</b>. Quelque chose fonctionne — examine tes derniers swaps.',
        color:'#7ec86a',cta:{label:'Voir le détail →',action:'_homeKpiDrillWinrate()'}});
    } else if(diff<=-10){
      insights.push({id:'wr-down',type:'warning',priority:80,ico:'⚠',
        title:'Win rate en baisse : '+Math.round(diff)+' pts sur 30j',
        body:'Tu chutes de '+Math.round(wr30P)+'% à '+Math.round(wr30)+'%. Le méta a peut-être changé — pense au sideboard.',
        color:'#e88a4a',cta:{label:'Analyser les decks →',action:'_homeKpiDrillWinrate()'}});
    }
  }
  // ── INSIGHT 3 : Deck inactif (pas joué depuis 60j) avec score >= 75 ──
  var inactive=[];
  myDeckIds.forEach(function(id){
    var dk=decks[id];if(!dk||!dk.pw||dk.pw.score<75)return;
    var lastUsed=dk.updatedAt||0;
    var hasMatch=matches.some(function(m){return m.deckId===id&&m.ts&&(now-m.ts)<60*86400000;});
    if(!hasMatch&&(now-lastUsed)>60*86400000)inactive.push({id:id,name:dk.name,score:dk.pw.score});
  });
  if(inactive.length>0){
    var top=inactive.sort(function(a,b){return b.score-a.score;})[0];
    insights.push({id:'inactive-deck',type:'tip',priority:60,ico:'💎',
      title:'Tu négliges « '+top.name+' »',
      body:'Score '+Math.round(top.score)+'/100, mais jamais joué depuis 2 mois. Ce deck est solide — relance-le.',
      color:'#b48cdc',cta:{label:'Ouvrir →',action:'loadDeck(\''+escJs(top.id)+'\');goTab(\'build\')'}});
  }
  // ── INSIGHT 4 : Achievement proche du déblocage ──
  var nMatchT=matches.filter(function(m){return m.result==='win'||m.result==='loss';}).length;
  if(!achievs.ten_decks&&myDeckIds.length>=7){
    insights.push({id:'ach-near',type:'milestone',priority:55,ico:'🏆',
      title:'Plus que '+(10-myDeckIds.length)+' deck'+((10-myDeckIds.length)>1?'s':'')+' pour « Constructeur en série »',
      body:'Tu as <b>'+myDeckIds.length+'/10</b> decks créés. Encore '+(10-myDeckIds.length)+' et tu débloques le palier.',
      color:'#f3d76e'});
  }
  // ── INSIGHT 5 : Première semaine d'activité (nouveau user) ──
  var totalActions=Math.max(matches.length,myDeckIds.length);
  if(totalActions<5){
    insights.push({id:'welcome',type:'tip',priority:30,ico:'✨',
      title:'Bienvenue dans ManaLAB',
      body:'Commence par importer ta collection (CSV) ou colle ta première decklist. L\'analyse t\'attend.',
      color:'var(--gold2)',cta:{label:'Démarrer →',action:'mlPerfectDeckOpen()'}});
  }
  // ── INSIGHT 6 : Pic d'activité hier/cette semaine ──
  var matchesYesterday=matches.filter(function(m){
    if(!m.ts)return false;
    var d=new Date(m.ts);var y=new Date();y.setDate(y.getDate()-1);
    return d.toDateString()===y.toDateString();
  });
  if(matchesYesterday.length>=4){
    var wY=matchesYesterday.filter(function(m){return m.result==='win';}).length;
    insights.push({id:'peak-yesterday',type:'positive',priority:50,ico:'⚡',
      title:'Hier : '+matchesYesterday.length+' matchs joués · '+wY+' victoires',
      body:'Belle session ! Tu as gagné '+Math.round(wY/matchesYesterday.length*100)+'% des parties. À reconduire.',
      color:'#7ec86a'});
  }
  // ── INSIGHT 7 : Collection valeur seuil franchi ──
  try{
    var coll=getProfCards(0)||[];
    var val=coll.reduce(function(s,c){return s+(c.qty||1)*(c.price||0);},0);
    if(val>=1000&&val<2000)insights.push({id:'coll-1k',type:'milestone',priority:45,ico:'💰',
      title:'Collection : 1 000 € franchi',
      body:'Ta valeur Cardmarket dépasse les 1 000 €. Pense à un coffre ou une assurance.',color:'#4aa0e8'});
  }catch(e){}
  // Tri par priority desc
  insights.sort(function(a,b){return b.priority-a.priority;});
  return insights.slice(0,4); // max 4 affichés
}
function _renderInsightsCard(insights){
  if(!insights||!insights.length)return '';
  var h='<div style="background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.18));border:1px solid var(--bd2);border-radius:11px;padding:12px 14px;margin-bottom:14px">';
  h+='<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px"><span style="font-size:.7rem;color:var(--tx3);letter-spacing:.08em;text-transform:uppercase;font-weight:600">💡 Insights pour toi</span><span style="flex:1"></span><span style="font-size:.66rem;color:var(--tx3);font-style:italic">'+insights.length+' personnalisé'+(insights.length>1?'s':'')+'</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">';
  insights.forEach(function(ins){
    var hasCta=!!ins.cta;
    h+='<div class="ml-insight-card ml-reveal" '+(hasCta?'onclick="'+ins.cta.action+'" style="cursor:pointer;"':'style=""')+' style="padding:11px 13px;background:linear-gradient(135deg,'+ins.color+'1a,'+ins.color+'05);border:1px solid '+ins.color+';border-radius:9px;transition:all .15s;position:relative" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 18px rgba(0,0,0,.35)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">';
    h+='<div style="display:flex;align-items:flex-start;gap:9px">';
    h+='<div style="font-size:1.4rem;line-height:1;flex-shrink:0">'+ins.ico+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-size:.84rem;color:'+ins.color+';font-weight:700;line-height:1.2;margin-bottom:4px">'+ins.title+'</div>';
    h+='<div style="font-size:.74rem;color:var(--tx2);line-height:1.45">'+ins.body+'</div>';
    if(hasCta)h+='<div style="font-size:.7rem;color:'+ins.color+';margin-top:6px;font-weight:600">'+esc(ins.cta.label)+'</div>';
    h+='</div></div></div>';
  });
  h+='</div></div>';
  return h;
}
