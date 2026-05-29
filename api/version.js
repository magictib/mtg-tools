// Renvoie le commit Git réellement déployé sur Vercel (variables système auto-exposées).
// Permet à l'admin de comparer « version chargée » (window.APP_BUILD) vs « version live ».
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  var sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  res.status(200).json({
    sha: sha ? sha.slice(0, 7) : 'dev',
    fullSha: sha,
    ref: process.env.VERCEL_GIT_COMMIT_REF || '',
    msg: (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').split('\n')[0].slice(0, 120),
    env: process.env.VERCEL_ENV || 'dev'
  });
};
