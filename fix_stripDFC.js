const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// Remplacer la ligne stripDFC corrompue (regex sans backslashes) par une version propre
// avec escapes unicode au lieu de caracteres literaux
const correct = "function stripDFC(name){return (name||'').replace(/\\s*\\/{1,2}\\s*.+$/,'').replace(/[\\u2018\\u2019\\u02BC\\u02BB\\uFF07]/g,\"'\").replace(/\\u00C6/g,'Ae').replace(/\\u00E6/g,'ae').trim();}";

// Trouver et remplacer — le pattern doit matcher la version corrompue OU l'ancienne
const bad = /function stripDFC\(name\)\{return[^\n]+\}/;
if (!bad.test(content)) { console.error('Pattern non trouve'); process.exit(1); }

content = content.replace(bad, correct);
fs.writeFileSync('index.html', content, 'utf8');
console.log('stripDFC corrige');

// Verifier syntaxe du script principal
const scripts = [];
let m;
const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
while ((m = re.exec(content)) !== null) { scripts.push(m[1]); }
let errs = 0;
scripts.forEach(function(s, i) {
  try { new Function(s); } catch(e) { console.log('Script #'+i+' ERREUR: '+e.message); errs++; }
});
if (!errs) console.log('Tous les scripts OK ('+scripts.length+' blocs)');
