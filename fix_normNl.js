const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// The _normNl line has U+2019 U+2019 (’’) instead of ASCII '' for the empty string
// Replace the corrupted _normNl line with a clean ASCII-only version
const badNormNl = /function _normNl\(s\)\{return stripDFC\(s\|\|[\s\S]{1,4}\)\.toLowerCase\(\);\}/;
const goodNormNl = "function _normNl(s){return stripDFC(s||'').toLowerCase();}";

if (!badNormNl.test(content)) { console.error('Pattern _normNl non trouve'); process.exit(1); }
content = content.replace(badNormNl, goodNormNl);
fs.writeFileSync('index.html', content, 'utf8');
console.log('_normNl corrige');

// Verify
const verify = content.match(/function _normNl[^\n]*/)[0];
let hasNonAscii = false;
for (let i = 0; i < verify.length; i++) {
  if (verify.charCodeAt(i) > 127) {
    console.error('Caractere non-ASCII restant a pos ' + i + ': U+' + verify.charCodeAt(i).toString(16).toUpperCase());
    hasNonAscii = true;
  }
}
if (!hasNonAscii) console.log('_normNl: 100% ASCII OK');
console.log('Contenu: ' + verify);

// Check all scripts for syntax errors
const scripts = [];
let m;
const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
while ((m = re.exec(content)) !== null) { scripts.push(m[1]); }
let errs = 0;
scripts.forEach(function(s, i) {
  try { new Function(s); } catch(e) { console.log('Script #'+i+' ERREUR: '+e.message); errs++; }
});
if (!errs) console.log('Tous les scripts OK (' + scripts.length + ' blocs)');
