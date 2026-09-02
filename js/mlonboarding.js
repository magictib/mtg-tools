/* ═══════════════════════════════════════════════════════════════════════════
   MLONBOARDING — tutoriel 3 étapes au 1er visit.
   Extrait de index.html au build 67 pour maintenabilité.
   Expose : mlOnboardingShouldShow / Open / Render / Next / Dismiss / Complete
   Dépend de : decks, _deckBelongsTo, getProfCards, toast, esc (globaux),
              goTab, collBulkAddOpen, mlPerfectDeckOpen, newDeck, anaTempDeckOpen
              (tous attendus disponibles au moment de l'interaction utilisateur)
═══════════════════════════════════════════════════════════════════════════ */
// ═════════════════════════════════════════════════════════════════════════════
// ONBOARDING — tutoriel 3 étapes au 1er visit pour les nouveaux utilisateurs.
// Apparaît uniquement si : collection vide ET aucun deck créé ET pas déjà vu.
// Skippable, mais montre la voie : importer → créer → analyser.
// ═════════════════════════════════════════════════════════════════════════════
function mlOnboardingShouldShow(){
  try{
    if(localStorage.getItem('manalab.onboarding_done')==='1')return false;
    // Nb decks de l'utilisateur (profil 0)
    var nDecks=0;try{nDecks=Object.keys(decks||{}).filter(function(id){return _deckBelongsTo?_deckBelongsTo(decks[id],0):true;}).length;}catch(e){}
    // Nb cartes en collection
    var nCards=0;try{var coll=getProfCards(0)||[];nCards=coll.reduce(function(s,c){return s+(c.qty||1);},0);}catch(e){}
    return nDecks===0 && nCards===0;
  }catch(e){return false;}
}
function mlOnboardingOpen(forceStep){
  var step=forceStep||1;
  var ov=document.getElementById('ml-onboarding-ov');
  if(!ov){
    ov=document.createElement('div');ov.id='ml-onboarding-ov';ov.className='ml-modal-ov center';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov&&confirm('Quitter le tutoriel ? Tu pourras le revoir dans le menu.'))mlOnboardingDismiss();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){var o=document.getElementById('ml-onboarding-ov');if(o&&o.classList.contains('show'))mlOnboardingDismiss();}});
  }
  mlOnboardingRender(step);
  ov.classList.add('show');
}
function mlOnboardingRender(step){
  var ov=document.getElementById('ml-onboarding-ov');if(!ov)return;
  var steps=[
    {
      n:1,ico:'🃏',title:'Importe ta collection',
      desc:'Pour analyser tes decks avec précision, ManaLAB a besoin de connaître les cartes que tu possèdes.',
      actions:[
        {label:'📋 Coller une liste (rapide)',action:'mlOnboardingDismiss();goTab(\'coll\');setTimeout(function(){if(typeof collBulkAddOpen===\'function\')collBulkAddOpen();},300)',primary:true},
        {label:'⬆ Importer un CSV Moxfield/Archidekt',action:'mlOnboardingDismiss();goTab(\'coll\');setTimeout(function(){var i=document.getElementById(\'coll-import-fin\');if(i)i.click();},300)'},
        {label:'⏭ Plus tard',action:'mlOnboardingNext()',ghost:true}
      ],
      tip:'💡 Tu peux exporter ta collection depuis Moxfield/Archidekt en CSV et la coller ici en 10 secondes.'
    },
    {
      n:2,ico:'⚗',title:'Crée ton premier deck',
      desc:'Construis un deck à partir d\'une liste, d\'un lien Moxfield, ou laisse l\'IA te suggérer un deck complet selon ta collection.',
      actions:[
        {label:'⚗ Deck Parfait (IA + collection)',action:'mlOnboardingDismiss();if(typeof mlPerfectDeckOpen===\'function\')mlPerfectDeckOpen()',primary:true},
        {label:'📋 Coller une decklist',action:'mlOnboardingDismiss();goTab(\'build\');setTimeout(function(){if(typeof newDeck===\'function\')newDeck();},300)'},
        {label:'⏭ Plus tard',action:'mlOnboardingNext()',ghost:true}
      ],
      tip:'💡 Tu peux aussi commencer par coller un lien Moxfield d\'un deck que tu admires pour l\'analyser.'
    },
    {
      n:3,ico:'📊',title:'Lance l\'analyse',
      desc:'Le moteur ManaLAB note ton deck sur 100, détecte ses thèmes, propose des swaps pour l\'améliorer et le compare au méta EDHRec.',
      actions:[
        {label:'📊 Analyser un deck',action:'mlOnboardingDismiss();goTab(\'analyse\')',primary:true},
        {label:'🔬 Analyser un deck temporaire (URL/liste)',action:'mlOnboardingDismiss();if(typeof anaTempDeckOpen===\'function\')anaTempDeckOpen()'},
        {label:'✓ J\'ai compris, fermer',action:'mlOnboardingComplete()',ghost:true}
      ],
      tip:'💡 Score 80+ = excellent · Score 60-80 = solide · Score < 60 = améliorable. Les swaps sont triés du plus impactant au moins.'
    }
  ];
  var s=steps[step-1]||steps[0];
  var h='<div class="ml-modal" style="max-width:580px;width:96vw">'
    +'<div class="ml-modal-hdr" style="border-bottom:1px solid #4aa0e8">'
    +'<div style="display:flex;align-items:center;gap:12px;flex:1">'
    +'<div style="font-size:1.8rem;line-height:1">'+s.ico+'</div>'
    +'<div>'
    +'<div style="font-size:.62rem;color:#7eb3d9;letter-spacing:.14em;text-transform:uppercase;font-weight:700">Étape '+s.n+'/3 · Bienvenue dans ManaLAB</div>'
    +'<div class="ml-modal-title" style="color:#fff;font-size:1.3rem">'+esc(s.title)+'</div>'
    +'</div></div>'
    +'<button class="ml-modal-close" onclick="mlOnboardingDismiss()" title="Passer le tutoriel">✕</button>'
    +'</div>'
    +'<div style="padding:18px 22px">'
    // Progress bar
    +'<div style="display:flex;gap:6px;margin-bottom:18px">'
    +'<div style="flex:1;height:4px;border-radius:2px;background:'+(s.n>=1?'#4aa0e8':'rgba(255,255,255,.1)')+';transition:background .3s"></div>'
    +'<div style="flex:1;height:4px;border-radius:2px;background:'+(s.n>=2?'#4aa0e8':'rgba(255,255,255,.1)')+';transition:background .3s"></div>'
    +'<div style="flex:1;height:4px;border-radius:2px;background:'+(s.n>=3?'#4aa0e8':'rgba(255,255,255,.1)')+';transition:background .3s"></div>'
    +'</div>'
    +'<div style="font-size:.92rem;color:var(--tx);line-height:1.6;margin-bottom:18px">'+esc(s.desc)+'</div>'
    // Actions
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +s.actions.map(function(a){
      var col=a.primary?'#4aa0e8':(a.ghost?'transparent':'rgba(255,255,255,.04)');
      var border=a.primary?'#4aa0e8':(a.ghost?'transparent':'var(--bd2)');
      var fg=a.primary?'#fff':(a.ghost?'var(--tx3)':'var(--tx)');
      var weight=a.primary?'700':'500';
      return '<button onclick="'+a.action+'" style="padding:'+(a.primary?'12px 18px':'10px 16px')+';background:'+col+';border:1px solid '+border+';border-radius:8px;color:'+fg+';font-family:inherit;font-size:.88rem;font-weight:'+weight+';cursor:pointer;text-align:left;transition:all .15s" onmouseover="if(\''+(a.primary?'1':'0')+'\'===\'1\'){this.style.background=\'#3068a0\'}else if(\''+(a.ghost?'1':'0')+'\'===\'0\'){this.style.background=\'rgba(255,255,255,.08)\'}" onmouseout="this.style.background=\''+col+'\'">'+esc(a.label)+'</button>';
    }).join('')
    +'</div>'
    +'<div style="margin-top:14px;padding:10px 12px;background:rgba(74,160,232,.06);border-left:3px solid #4aa0e8;border-radius:6px;font-size:.76rem;color:var(--tx2);line-height:1.5">'+s.tip+'</div>'
    +'</div>'
    +'<div class="ml-modal-foot" style="padding:10px 18px;border-top:.5px solid var(--bd);display:flex;justify-content:space-between;align-items:center;gap:10px">'
    +(s.n>1?'<button class="btn btnsm" onclick="mlOnboardingOpen('+(s.n-1)+')" style="padding:6px 12px">← Précédent</button>':'<span></span>')
    +'<div style="display:flex;gap:8px">'
    +(s.n<3?'<button class="btn btnsm" onclick="mlOnboardingNext()" style="padding:6px 12px">Suivant →</button>':'')
    +'<button class="btn btnsm" onclick="mlOnboardingDismiss()" style="padding:6px 12px;color:var(--tx3)">Passer</button>'
    +'</div></div></div>';
  ov.innerHTML=h;
}
function mlOnboardingNext(){
  var ov=document.getElementById('ml-onboarding-ov');
  // Détecte l'étape courante via le badge
  var badge=ov&&ov.querySelector('[style*="letter-spacing:.14em"]');
  var match=badge&&badge.textContent.match(/Étape (\d+)/);
  var cur=match?parseInt(match[1],10):1;
  if(cur>=3){mlOnboardingComplete();return;}
  mlOnboardingOpen(cur+1);
}
function mlOnboardingDismiss(){
  var ov=document.getElementById('ml-onboarding-ov');if(ov)ov.classList.remove('show');
  // Ne pas marquer comme « done » → si l'utilisateur skip, le tuto réapparaîtra
  // au prochain load tant qu'il n'aura pas créé un deck ou importé une collection.
}
function mlOnboardingComplete(){
  try{localStorage.setItem('manalab.onboarding_done','1');}catch(e){}
  var ov=document.getElementById('ml-onboarding-ov');if(ov)ov.classList.remove('show');
  if(typeof toast==='function')toast('✓ Bienvenue ! Tu peux relancer le tutoriel depuis la home.');
  if(typeof mlTrack==='function')mlTrack('Onboarding Completed');
}
// Auto-trigger : uniquement pour un utilisateur RÉELLEMENT connecté et une fois
// les données chargées. Sans ces deux gardes, l'overlay s'ouvrait 1,5 s après le
// load par-dessus l'écran de connexion (collection et decks vides = conditions
// remplies) et bloquait tous les clics : impossible de se connecter.
(function(){
  var tries=0;
  function loggedIn(){
    if(typeof userId==='undefined'||!userId)return false;
    var wrap=document.getElementById('wrap-main');
    return !!wrap&&getComputedStyle(wrap).display!=='none';
  }
  function dataReady(){
    return window._mlDecksLoaded===true&&window._mlProfsLoaded===true;
  }
  function maybeStart(){
    if(maybeStart.__done)return;
    if(!loggedIn()||!dataReady()){
      if(++tries>60)return; // ~30 s puis on abandonne silencieusement
      setTimeout(maybeStart,500);
      return;
    }
    maybeStart.__done=true;
    try{if(mlOnboardingShouldShow())mlOnboardingOpen(1);}catch(e){}
  }
  if(document.readyState==='complete')setTimeout(maybeStart,1500);
  else window.addEventListener('load',function(){setTimeout(maybeStart,1500);});
})();
