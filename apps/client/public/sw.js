const CACHE_NAME = 'manul-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-128x128.png',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing version', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Skip waiting');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating version', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/socket.io/') || 
      url.pathname.startsWith('/collab/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.mjs') || 
      url.pathname.endsWith('.css') ||
      url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            console.log('Service Worker: Serving fresh content for', url.pathname);
            return response;
          }
          return caches.match(event.request);
        })
        .catch(() => {
          console.log('Service Worker: Network failed, trying cache for', url.pathname);
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('Service Worker: Serving from cache', url.pathname);
          return response;
        }
        
        console.log('Service Worker: Fetching from network', url.pathname);
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
      })
  );
}); 