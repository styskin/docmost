const CACHE_NAME = 'manul-cache-v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // For non-GET requests, just pass through to the network
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // TODO: decide what to cache. + Clone the response before caching
            // const responseToCache = response.clone();
            // caches.open(CACHE_NAME)
            //   .then((cache) => {
            //     cache.put(event.request, responseToCache);
            //   });
            return response;
          });
      })
  );
}); 