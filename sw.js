/* sw.js - Versão Cache First (Rápida e Offline) */

const CACHE_NAME = 'carnaval-bh-v3-local'; // Subi a versão para limpar caches antigos

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/reset.css',
  './css/variables.css',
  './css/styles.css',
  './css/map.css',
  './js/app.js',
  './js/data.js',
  './js/ui.js',
  './js/map.js',
  './js/storage.js',
  './data/blocos.json', // VOLTOU: Arquivo local é cacheado na instalação
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// 1. Instalação: Baixa tudo
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando app shell e dados...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 2. Ativação: Limpa velharias
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Estratégia Cache First (Máxima velocidade)
self.addEventListener('fetch', (event) => {
  // Apenas requisições GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se achou no cache, retorna na hora
        if (cachedResponse) {
          return cachedResponse;
        }
        // Se não, busca na rede
        return fetch(event.request);
      })
  );
});