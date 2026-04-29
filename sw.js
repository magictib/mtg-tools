const CACHE = 'manalab-v1';
const STATIC = [
  './',
  './index.html',
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
      return c.addAll(STATIC);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
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

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      });
      // Cache-first pour les assets statiques connus, network-first sinon
      return cached || networkFetch;
    }).catch(function() {
      return caches.match('./index.html');
    })
  );
});
