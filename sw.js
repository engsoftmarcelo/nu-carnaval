/* ==========================================================================
   sw.js
   Service Worker - Estratégia Híbrida
   ========================================================================== */

// --- ATENÇÃO: MUDEI PARA v7 PARA FORÇAR A ATUALIZAÇÃO DO UI.JS ---
const CACHE_SHELL_NAME = 'nu-carnaval-shell-v7'; 
const CACHE_DATA_NAME = 'nu-carnaval-data-v1';

// 1. APP SHELL (Arquivos estáticos que raramente mudam)
const ASSETS_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/reset.css',
  './css/variables.css',
  './css/styles.css',
  './css/map.css',
  './css/timeline.css',
  './js/app.js',
  './js/data.js',
  './js/ui.js', // <--- Importante: esse arquivo será atualizado
  './js/map.js',
  './js/storage.js',
  './js/notifications.js',
  './js/firebase.js',
  './js/weather.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/images/Logo Hero.png',
  './assets/images/Símbolo.png',
  './assets/images/Versão Stencil.png'
];

// --- INSTALAÇÃO ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_SHELL_NAME).then((cache) => {
      console.log('[SW] Instalando App Shell v7...');
      return cache.addAll(ASSETS_SHELL);
    })
  );
});

// --- ATIVAÇÃO ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_SHELL_NAME && key !== CACHE_DATA_NAME) {
          console.log('[SW] Removendo cache antigo:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// --- FETCH ---
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Estratégia Stale-While-Revalidate para dados e imagens
  if (requestUrl.pathname.includes('blocos.json') || 
      requestUrl.pathname.includes('api.open-meteo') ||
      requestUrl.pathname.includes('assets/artists')) {
      
    event.respondWith(
      caches.open(CACHE_DATA_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const networkFetch = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {});

        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // Estratégia Cache-First para App Shell
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', function(event) {
  let data = { title: 'Nu! Carnaval', body: 'Nova atualização!', url: './index.html' };
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }
  const options = {
    body: data.body,
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || './index.html' },
    tag: data.tag || 'geral',
    renotify: true,
    actions: [ { action: 'explore', title: 'Ver Agora' }, { action: 'close', title: 'Fechar' } ]
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url);
    })
  );
});