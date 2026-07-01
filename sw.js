const CACHE_NAME = 'diamond-cloud-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/cloud-core.js',
    '/js/cloud-auth.js',
    '/js/cloud-ui.js',
    '/js/cloud-files.js',
    '/js/cloud-share.js',
    '/assets/favicon.ico',
    '/assets/logo-192.png',
    '/assets/logo-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
