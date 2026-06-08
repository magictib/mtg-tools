/* ═══════════════════════════════════════════════════════════════════════════
   MLHELPERS — utilitaires techniques globaux (build 67+).
   Extrait de index.html pour maintenabilité.
   Expose sur window :
     - mlLog(level, msg, ...)    : logger conditionnel (warn/error forcés)
     - mlGet/mlSet                : localStorage avec préfixe manalab.
     - mlGetJSON/mlSetJSON        : idem + JSON.parse/stringify
     - mlDelta(current, previous) : variation +/-
     - mlInTimeRange(items, ...)  : filtre par timestamp
═══════════════════════════════════════════════════════════════════════════ */
// Logger conditionnel : warn/error toujours forwardés ; log/info muets en prod.
// Active le debug verbose via localStorage.setItem('manalab.debug','1')
window.mlLog=function(level,msg){
  try{
    var debug=false;
    try{debug=localStorage.getItem('manalab.debug')==='1';}catch(_){}
    if(level==='warn'||level==='error'){console[level].apply(console,arguments);return;}
    if(debug)(console[level]||console.log).apply(console,arguments);
  }catch(_){}
};
// Helpers localStorage avec préfixe « manalab. » pour les NOUVELLES clés.
// Les anciennes clés (mtg_*) sont conservées telles quelles.
window.mlGet=function(key,fallback){
  try{var v=localStorage.getItem('manalab.'+key);return v==null?fallback:v;}catch(_){return fallback;}
};
window.mlSet=function(key,value){
  try{localStorage.setItem('manalab.'+key,String(value));}catch(_){}
};
window.mlGetJSON=function(key,fallback){
  try{var v=localStorage.getItem('manalab.'+key);return v?JSON.parse(v):(fallback||null);}catch(_){return fallback||null;}
};
window.mlSetJSON=function(key,value){
  try{localStorage.setItem('manalab.'+key,JSON.stringify(value));}catch(_){}
};
// Calcule la variation entre 2 valeurs avec direction, % et couleur.
// Utilisé par les dashboards pour afficher « ▲ +12% vs semaine dernière ».
window.mlDelta=function(current,previous){
  if(previous==null||previous===0)return {delta:null,pct:null,dir:'flat',col:'var(--tx3)'};
  var d=current-previous;
  var pct=d/previous*100;
  return {delta:d,pct:pct,dir:d>0?'up':d<0?'down':'flat',col:d>0?'#7ec86a':d<0?'#d9645a':'var(--tx3)',ico:d>0?'▲':d<0?'▼':'—'};
};
// Filtre des éléments ayant un timestamp dans [from, to)
window.mlInTimeRange=function(items,getTs,from,to){
  return items.filter(function(x){var t=getTs(x);return t>=from&&t<to;});
};
