/**
 * sw.js — Service Worker do +PROMO
 * Cache-first para app shell · Network-only para Firebase · Offline fallback
 * Refatorado para Cloudflare Pages com Clean URLs
 */

const CACHE_NAME    = 'promo-v8';
const RUNTIME_CACHE = 'promo-runtime-v8';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/promo-elite.css',
  '/css/legal.css',
  '/js/utils.js',
  '/js/promo-elite.js',
  '/js/firebase-config.js',
  '/js/auth/login.js',
  '/js/auth/cadastro.js',
  '/js/dashboard/main.js',
  '/js/pages/planos.js',
  '/dashboard/',
  '/login/',
  '/cadastro/',
  '/parceiros/',
  '/planos/',
  '/simulador/',
  '/legal/termos/',
  '/legal/privacidade/',
  '/legal/cancelamento/',
  '/manifest.json',
  '/og-image.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  if (url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('firestore.googleapis.com')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      // MIME safety: never serve HTML from cache when browser expects a script
      if (cached && request.destination === 'script') {
        const contentType = cached.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          // Cache has wrong content type — skip cache, fetch from network
          return fetch(request).catch(() => cached);
        }
      }

      if (cached) {
        fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then(response => {
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '+Promo', {
      body:    data.body || 'Você tem uma novidade!',
      icon:    '/og-image.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
