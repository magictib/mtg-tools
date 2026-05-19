const CACHE = 'manalab-v99';
const STATIC = [
  './manifest.json',
  './icon.svg'
];

// Domaines qui ne doivent jamais être mis en cache (toujours réseau)
const NETWORK_ONLY = [
  'firebaseio.com',
  'googleapis.com',
  'gstatic.com',
  'firebaseapp.com',
  'scryfall.com',
  'cdnfonts.com',
  'fonts.googleapis.com',
  'jsdelivr.net'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(STATIC).catch(function(){}); // tolère échec d'asset
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    // Purge agressive : supprime TOUS les caches d'anciennes versions ET les HTML en cache
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function(){
      // Re-crée le cache courant vide (sera repeuplé au prochain fetch)
      return caches.open(CACHE);
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url;
  try { url = new URL(e.request.url); } catch(err) { return; }

  // Jamais de cache pour les APIs distantes
  if (NETWORK_ONLY.some(function(d) { return url.hostname.includes(d); })) {
    return;
  }

  // POST / non-GET → réseau direct
  if (e.request.method !== 'GET') return;

  // HTML / index : TOUJOURS RÉSEAU UNIQUEMENT (jamais de cache)
  // Garantit que les modifications du code sont vues immédiatement
  var isHtml = url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname === '';
  if (isHtml) {
    e.respondWith(
      fetch(e.request, {cache: 'no-store'}).catch(function() {
        // Offline : on tente le cache (vieille version) plutôt que rien
        return caches.match(e.request) || caches.match('./index.html') || new Response('<h1>Hors ligne</h1>', {headers:{'Content-Type':'text/html'}});
      })
    );
    return;
  }

  // Cache-first pour les autres assets statiques (images, fonts, manifest)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      });
      return cached || networkFetch;
    }).catch(function() {
      return new Response('', {status: 504});
    })
  );
});
