const CACHE = 'manalab-v256';
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
      return caches.open(CACHE); // re-crée le cache courant vide
    }).then(function(){
      return self.clients.claim();
    }).then(function(){
      // Prévient les pages ouvertes qu'une nouvelle version est active → rechargement auto
      return self.clients.matchAll({ type: 'window' });
    }).then(function(cs){
      cs.forEach(function(c){ try { c.postMessage({ type: 'sw-activated' }); } catch(_){} });
    }).catch(function(){})
  );
});

// === Push notifications ===
self.addEventListener('push', function(e) {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { title: 'ManaLAB', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'ManaLAB';
  const opts = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url || '/' },
    tag: data.tag || 'manalab-notif',
    requireInteraction: false
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (const c of list) {
        if (c.url.includes(self.registration.scope) && 'focus' in c) {
          c.navigate(targetUrl); return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
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
