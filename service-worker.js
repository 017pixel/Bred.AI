const CACHE_NAME = 'bredai-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'globals.js',
  'functions.js',
  'knowledge.js',
  'icon.png',
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
  'https://unpkg.com/intro.js/minified/introjs.min.css',
  'https://unpkg.com/intro.js/minified/intro.min.js'
];

// Event: Installation des Service Workers
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('PWA ServiceWorker: Cache geöffnet und App-Shell wird zwischengespeichert.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event: Aktivierung des Service Workers (Aufräumen alter Caches)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('PWA ServiceWorker: Alter Cache wird gelöscht:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Event: Abfangen von Netzwerk-Anfragen (Fetch)
self.addEventListener('fetch', event => {
  // Wir wenden die Caching-Strategie nur auf GET-Anfragen an.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-Treffer: Die angeforderte Ressource ist im Cache.
        if (response) {
          return response;
        }

        // Kein Cache-Treffer: Die Ressource muss vom Netzwerk geholt werden.
        return fetch(event.request).then(
          networkResponse => {
            // WICHTIG: Wir speichern hier keine neuen Antworten im Cache.
            // Die App-Shell wird bei der Installation gecached. Dynamische Anfragen (APIs)
            // sollen immer das Netzwerk nutzen und nicht zwischengespeichert werden.
            return networkResponse;
          }
        ).catch(error => {
          console.error('PWA ServiceWorker: Fetch fehlgeschlagen.', error);
          // Hier könnte man optional eine Offline-Fallback-Seite zurückgeben.
        });
      })
  );
});