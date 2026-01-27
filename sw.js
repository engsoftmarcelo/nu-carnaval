/* ==========================================================================
   sw.js
   Service Worker - Estratégia Híbrida (Relatório Seção 2.1.1)
   1. App Shell -> Cache First (Performance instantânea)
   2. Dados (JSON) -> Stale-While-Revalidate (Frescor de dados)
   ========================================================================== */

const CACHE_SHELL_NAME = 'nu-carnaval-shell-v4';
const CACHE_DATA_NAME = 'nu-carnaval-data-v1';

// 1. APP SHELL (Arquivos estáticos que raramente mudam)
// REMOVIDO 'data/blocos.json' daqui para usar estratégia SWR
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
  './js/ui.js',
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

// --- INSTALAÇÃO: Cachear App Shell ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_SHELL_NAME).then((cache) => {
      console.log('[SW] Instalando App Shell...');
      return cache.addAll(ASSETS_SHELL);
    })
  );
});

// --- ATIVAÇÃO: Limpar caches antigos ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        // Remove caches antigos que não sejam os atuais
        if (key !== CACHE_SHELL_NAME && key !== CACHE_DATA_NAME) {
          console.log('[SW] Removendo cache antigo:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// --- FETCH: Onde a mágica acontece ---
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Apenas requisições GET
  if (event.request.method !== 'GET') return;

  // ESTRATÉGIA 1: Stale-While-Revalidate (Para blocos.json e APIs)
  // Mostra o dado do cache imediatamente, mas vai na rede buscar atualização para a próxima vez.
  if (requestUrl.pathname.includes('blocos.json') || requestUrl.pathname.includes('api.open-meteo')) {
    event.respondWith(
      caches.open(CACHE_DATA_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        // Dispara a atualização na rede em background (sem travar a interface)
        const networkFetch = fetch(event.request).then((networkResponse) => {
          // Se a rede respondeu ok, atualiza o cache
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
            console.log('[SW] Dados atualizados em background:', requestUrl.pathname);
          }
          return networkResponse;
        }).catch(() => {
          // Se falhar a rede, não faz nada (já retornamos o cache ou erro depois)
          console.log('[SW] Falha na rede, mantendo dados offline.');
        });

        // Retorna o cache se existir, senão espera a rede
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // ESTRATÉGIA 2: Cache-First (Para App Shell e Imagens)
  // Se tá no cache, usa. Se não, vai na rede e cacheia.
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Achou no cache
      }
      // Se não achou, busca na rede
      return fetch(event.request).then((networkResponse) => {
          // Opcional: Cachear novas imagens dinâmicas aqui se desejar
          return networkResponse;
      });
    })
  );
});