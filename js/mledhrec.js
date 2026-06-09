/* ═══════════════════════════════════════════════════════════════════════════
   MLEDHREC — intégration API publique json.edhrec.com (sans clé).
   Extrait de index.html au build 68 pour maintenabilité.
   Cache localStorage 24h pour ne pas marteler l'API.
   Expose : mlEdhrecSlug / Fetch / Render + helpers internes.
   Dépend de globaux : decks, esc, escJs, stripDFC, _atelierRecoAddDirect,
                       _addCardSmart, mlChart.PAL (déjà extrait)
═══════════════════════════════════════════════════════════════════════════ */
// ═════════════════════════════════════════════════════════════════════════════
// EDHREC INVERSE — tendances communauté pour le commandant du deck.
// API publique JSON ouverte (pas de clé) : https://json.edhrec.com/pages/commanders/{slug}.json
// Données : top cartes (% inclusion), high-synergy, gamechangers, new cards, similar commanders.
// Cache localStorage 24h pour ne pas marteler l'API.
// ═════════════════════════════════════════════════════════════════════════════
function mlEdhrecSlug(name){
  if(!name)return '';
  return String(name).toLowerCase()
    .replace(/['"`]/g,'')
    .replace(/[,.()]/g,'')
    .replace(/[\s/—–-]+/g,'-')
    .replace(/[^a-z0-9-]/g,'')
    .replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function mlEdhrecCacheKey(slug){return 'mtg_edhrec_'+slug;}
function mlEdhrecFetch(commanderName){
  var slug=mlEdhrecSlug(commanderName);
  if(!slug)return Promise.resolve(null);
  // Cache 24h
  try{
    var c=JSON.parse(localStorage.getItem(mlEdhrecCacheKey(slug))||'null');
    if(c&&c.t&&Date.now()-c.t<86400000)return Promise.resolve(c.d);
  }catch(e){}
  var url='https://json.edhrec.com/pages/commanders/'+slug+'.json';
  return fetch(url).then(function(r){
    if(!r.ok)return null;
    return r.json();
  }).then(function(d){
    if(d){try{localStorage.setItem(mlEdhrecCacheKey(slug),JSON.stringify({t:Date.now(),d:d}));}catch(e){}}
    return d;
  }).catch(function(){return null;});
}
function _mlEdhrecNorm(n){return (n||'').toLowerCase().trim().replace(/[''`]/g,"'").replace(/\s+/g,' ');}
function mlEdhrecExtractCategory(data,tag){
  if(!data||!data.container||!data.container.json_dict)return null;
  // Nouvelle structure : cardlists au niveau container.json_dict
  var lists=(data.container.json_dict.cardlists)||[];
  for(var i=0;i<lists.length;i++){
    if(lists[i].tag===tag)return lists[i];
  }
  return null;
}
function mlEdhrecExtractCategoryFlex(data){
  // Helper qui retourne toutes les catégories disponibles à la racine
  if(!data)return [];
  var lists=(data.cardlists)||(data.container&&data.container.json_dict&&data.container.json_dict.cardlists)||[];
  return lists;
}
function mlEdhrecCardName(c){return c.name||c.cardname||(c.card&&c.card.name)||'';}
function mlEdhrecCardSyn(c){return c.synergy!=null?c.synergy:(c.synergy_score!=null?c.synergy_score:0);}
function mlEdhrecCardIncl(c){
  // Inclusion : soit % direct, soit num_decks / potential_decks
  if(c.inclusion!=null&&c.inclusion<=1.01)return Math.round(c.inclusion*100);
  if(c.num_decks&&c.potential_decks)return Math.round(100*c.num_decks/c.potential_decks);
  if(c.inclusion!=null)return Math.round(c.inclusion);
  return 0;
}
// Rend le panneau EDHRec dans un container donné
function mlEdhrecRender(deckId){
  var mount=document.getElementById('ana-edhrec-panel');
  if(!mount){
    // Crée le mount juste après le bandeau de score si possible, sinon en tête de #ana-results
    mount=document.createElement('div');
    mount.id='ana-edhrec-panel';
    mount.style.cssText='margin:14px 0;padding:0;border-radius:10px;background:linear-gradient(180deg,rgba(140,90,180,.06),rgba(140,90,180,.01));border:1px solid rgba(180,140,220,.32);overflow:hidden';
    var res=document.getElementById('ana-results');
    if(res){
      // Insère en première position
      if(res.firstChild)res.insertBefore(mount,res.firstChild);
      else res.appendChild(mount);
    }
  }
  var deck=decks[deckId];
  if(!deck||!deck.commander||!deck.commander.name){
    mount.style.display='none';return;
  }
  mount.style.display='block';
  var cmdName=deck.commander.name;
  // Loader pendant fetch
  mount.innerHTML='<div style="padding:12px 14px;display:flex;align-items:center;gap:10px">'
    +'<div class="ml-spinner-gold" style="width:18px;height:18px;border:2px solid rgba(180,140,220,.3);border-top-color:#b48cdc;border-radius:50%;animation:ml-spin 1s linear infinite"></div>'
    +'<span style="font-size:.82rem;color:var(--tx2)">📊 Chargement des tendances EDHRec pour <b>'+esc(cmdName)+'</b>…</span></div>';
  mlEdhrecFetch(cmdName).then(function(data){
    if(!data){
      mount.innerHTML='<div style="padding:10px 14px;font-size:.78rem;color:var(--tx3)">📊 EDHRec : pas de données pour <b>'+esc(cmdName)+'</b> (commandant trop récent ou peu joué). <span style="font-size:.7rem">Slug essayé : '+esc(mlEdhrecSlug(cmdName))+'</span></div>';
      return;
    }
    _mlEdhrecRenderData(mount,data,deck,cmdName);
  });
}
// État local pour le tab actif EDHRec
var _mlEdhrecActiveTab='topcards';
function _mlEdhrecRenderData(mount,data,deck,cmdName){
  var lists=mlEdhrecExtractCategoryFlex(data);
  var owned={};
  (deck.cards||[]).forEach(function(c){owned[_mlEdhrecNorm(c.name)]=1;});
  function findByTag(tag){return lists.filter(function(l){return l.tag===tag;})[0];}
  var topcards=findByTag('topcards')||findByTag('top-cards');
  var synergy=findByTag('highsynergycards')||findByTag('high-synergy-cards');
  var newcards=findByTag('newcards')||findByTag('new-cards');
  var gamechangers=findByTag('gamechangers')||findByTag('game-changers');
  var numDecks=(data.container&&data.container.json_dict&&data.container.json_dict.num_decks_avg)||data.num_decks_avg||0;
  var similar=(data.container&&data.container.json_dict&&data.container.json_dict.similar)||data.similar||[];

  // Construction des tabs avec compteurs
  var tabs=[
    {id:'topcards',label:'🎯 Top',list:topcards,info:'taux d\'inclusion'},
    {id:'highsynergycards',label:'💎 Synergie',list:synergy,info:'rares ailleurs'},
    {id:'newcards',label:'🆕 Nouveautés',list:newcards,info:'qui montent'},
    {id:'gamechangers',label:'⚡ Game changers',list:gamechangers,info:'cartes-pivots'}
  ].filter(function(t){return t.list&&t.list.cardviews&&t.list.cardviews.length;});
  if(!tabs.length){
    mount.innerHTML='<div style="padding:14px;color:var(--tx3);font-style:italic">Pas de catégories EDHRec disponibles pour ce commandant.</div>';
    return;
  }
  // S'assure que le tab actif existe encore
  if(!tabs.find(function(t){return t.id===_mlEdhrecActiveTab;}))_mlEdhrecActiveTab=tabs[0].id;

  // ── HEADER ──
  var h='<div style="padding:13px 16px 0 16px">';
  h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
  h+='<span style="font-size:1.25rem">📊</span>';
  h+='<div style="display:flex;flex-direction:column;min-width:0">';
  h+='<span style="font-family:\'Goudy Mediaeval\',serif;color:#d4b8ec;letter-spacing:.06em;font-size:.92rem">TENDANCES COMMUNAUTÉ · EDHRec</span>';
  if(numDecks)h+='<span style="font-size:.7rem;color:var(--tx3)">'+numDecks.toLocaleString('fr-FR')+' decks analysés pour <b>'+esc(cmdName)+'</b></span>';
  h+='</div>';
  h+='<span style="flex:1"></span>';
  h+='<a href="https://edhrec.com/commanders/'+esc(mlEdhrecSlug(cmdName))+'" target="_blank" rel="noopener" style="font-size:.72rem;color:#b48cdc;text-decoration:none;border:.5px solid rgba(180,140,220,.4);border-radius:6px;padding:4px 10px">Ouvrir sur EDHRec ↗</a>';
  h+='</div>';
  // ── TABS ──
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;border-bottom:.5px solid rgba(180,140,220,.2);padding-bottom:0;margin-bottom:0">';
  tabs.forEach(function(t){
    var active=t.id===_mlEdhrecActiveTab;
    var n=t.list.cardviews.length;
    h+='<button onclick="_mlEdhrecSetTab(\''+t.id+'\')" style="padding:7px 12px;background:'+(active?'linear-gradient(180deg,rgba(180,140,220,.18),rgba(180,140,220,.06))':'transparent')+';border:none;border-bottom:2px solid '+(active?'#b48cdc':'transparent')+';color:'+(active?'#d4b8ec':'var(--tx2)')+';font-family:inherit;font-size:.78rem;cursor:pointer;font-weight:'+(active?'700':'400')+';transition:all .15s" onmouseover="this.style.color=\'#d4b8ec\'" onmouseout="if(!'+active+')this.style.color=\'var(--tx2)\'">'+t.label+' <span style="opacity:.6;font-size:.66rem">'+n+'</span></button>';
  });
  h+='</div>';
  h+='</div>';
  // ── CARDS GRID ──
  h+='<div style="padding:14px 16px 12px 16px">';
  h+='<div id="ml-edhrec-tabbody">';
  var activeTab=tabs.find(function(t){return t.id===_mlEdhrecActiveTab;})||tabs[0];
  h+=_mlEdhrecRenderCardsGrid(activeTab,owned,cmdName);
  h+='</div>';
  // ── COMMANDANTS SIMILAIRES ──
  if(similar&&similar.length){
    h+='<div style="margin-top:14px;padding-top:10px;border-top:.5px dashed rgba(180,140,220,.25)">';
    h+='<div style="font-size:.7rem;color:var(--tx3);letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:6px">🔄 Commandants similaires</div>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
    similar.slice(0,10).forEach(function(s){
      var nm=s.name||s.cardname||(typeof s==='string'?s:'');
      if(!nm)return;
      h+='<a href="https://edhrec.com/commanders/'+esc(mlEdhrecSlug(nm))+'" target="_blank" rel="noopener" style="padding:5px 10px;background:rgba(180,140,220,.08);border:.5px solid rgba(180,140,220,.3);border-radius:11px;font-size:.72rem;color:#d4b8ec;text-decoration:none;transition:all .12s" onmouseover="this.style.background=\'rgba(180,140,220,.18)\';this.style.borderColor=\'#b48cdc\'" onmouseout="this.style.background=\'rgba(180,140,220,.08)\';this.style.borderColor=\'rgba(180,140,220,.3)\'">'+esc(nm)+'</a>';
    });
    h+='</div></div>';
  }
  h+='</div>';
  mount.innerHTML=h;
  // Stocker données pour switch de tab
  mount._edhData={data:data,deck:deck,cmdName:cmdName,tabs:tabs,owned:owned};
}
function _mlEdhrecSetTab(tabId){
  var mount=document.getElementById('ana-edhrec-panel');if(!mount||!mount._edhData)return;
  _mlEdhrecActiveTab=tabId;
  // Re-render header + body
  _mlEdhrecRenderData(mount,mount._edhData.data,mount._edhData.deck,mount._edhData.cmdName);
}
// Nouveau render en grille : cards avec image Scryfall + métrique + bouton.
// Layout responsive auto-fill, beaucoup plus visuel que la liste plate précédente.
function _mlEdhrecRenderCardsGrid(tab,owned,cmdName){
  var cards=tab.list.cardviews.slice(0,18);
  var isSynergy=tab.id==='highsynergycards'||tab.id==='gamechangers';
  var h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';
  cards.forEach(function(c,i){
    var name=mlEdhrecCardName(c);if(!name)return;
    var incl=mlEdhrecCardIncl(c);
    var syn=mlEdhrecCardSyn(c);
    var has=owned[_mlEdhrecNorm(name)];
    var rank=i+1;
    var img='https://api.scryfall.com/cards/named?fuzzy='+encodeURIComponent(name)+'&format=image&version=normal';
    var metricVal=isSynergy?((syn>0?'+':'')+(typeof syn==='number'?syn.toFixed(2):syn)):(incl+'%');
    var metricCol=isSynergy?'#b48cdc':'var(--gold2)';
    h+='<div class="edh-card" style="position:relative;background:'+(has?'linear-gradient(180deg,rgba(126,200,106,.06),rgba(126,200,106,.02))':'rgba(255,255,255,.02)')+';border:1px solid '+(has?'#7ec86a':'var(--bd2)')+';border-radius:9px;overflow:hidden;transition:all .15s;cursor:default" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.borderColor=\''+(has?'#7ec86a':'#b48cdc')+'\'" onmouseout="this.style.transform=\'\';this.style.borderColor=\''+(has?'#7ec86a':'var(--bd2)')+'\'">';
    // Image card top
    h+='<div style="position:relative;width:100%;aspect-ratio:5/7;background:linear-gradient(180deg,#1a1410,#0a0805);overflow:hidden">';
    h+='<img src="'+esc(img)+'" alt="'+esc(name)+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top" onerror="this.style.display=\'none\'">';
    // Badge rank top-left
    h+='<div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,.75);color:var(--tx2);font-size:.62rem;font-weight:700;padding:2px 6px;border-radius:4px;backdrop-filter:blur(4px)">#'+rank+'</div>';
    // Badge metric top-right
    h+='<div style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,.85);color:'+metricCol+';font-size:.74rem;font-weight:700;padding:3px 7px;border-radius:5px;backdrop-filter:blur(4px);border:.5px solid '+metricCol+'">'+metricVal+'</div>';
    // Owned badge bottom
    if(has)h+='<div style="position:absolute;bottom:5px;right:5px;background:rgba(126,200,106,.92);color:#0a0805;font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:5px">✓ DANS TON DECK</div>';
    h+='</div>';
    // Footer
    h+='<div style="padding:7px 9px">';
    h+='<div style="font-size:.74rem;color:'+(has?'#a8d97e':'var(--tx)')+';font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(name)+'">'+esc(name)+'</div>';
    if(!has){
      h+='<button onclick="_addCardSmart(\''+escJs(name)+'\')" style="margin-top:5px;width:100%;padding:4px 8px;background:rgba(180,140,220,.12);border:.5px solid rgba(180,140,220,.4);border-radius:6px;color:#d4b8ec;font-family:inherit;font-size:.7rem;cursor:pointer;font-weight:600;transition:all .12s" onmouseover="this.style.background=\'rgba(180,140,220,.25)\'" onmouseout="this.style.background=\'rgba(180,140,220,.12)\'">+ Ajouter</button>';
    }else{
      h+='<div style="margin-top:5px;font-size:.66rem;color:var(--tx3);text-align:center;font-style:italic">Déjà optimal</div>';
    }
    h+='</div>';
    h+='</div>';
  });
  h+='</div>';
  return h;
}
function _mlEdhrecRenderSection(title,tag,list,owned,limit){
  // Conservé pour rétro-compat — non utilisé après refonte
  if(!list||!list.cardviews||!list.cardviews.length)return '';
  return '';
  return h;
}
