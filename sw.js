/* The cache is restricted to this app's URL scope, including GitHub project paths. */
'use strict';
const VERSION = '2026-10-28-4';
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'pulso-hiit:' + encodeURIComponent(SCOPE.pathname) + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const FILES = ['./', 'index.html', 'styles.css', 'engine.js', 'app.js', 'voices.js', 'display.js', 'pwa.js', 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const APP_URLS = FILES.map(file => new URL(file, SCOPE).href);
const APP_URL_SET = new Set(APP_URLS);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_URLS);
    // Activate only after the complete shell exists. Already loaded JS/CSS keeps
    // running; no client is navigated or reloaded during an active workout.
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin) return;
  url.search = '';
  url.hash = '';
  if (!APP_URL_SET.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.href);
    if (cached) return cached;
    return fetch(request);
  })());
});

