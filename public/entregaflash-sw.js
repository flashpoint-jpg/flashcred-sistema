// Service Worker do Entrega Flash — instalação como app + notificações
const CACHE_NOME = 'entrega-flash-v1';
const ARQUIVOS_APP = [
  './entregaflash.html',
  './entregaflash-manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_APP)).catch(() => {})
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_NOME).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

// Serve do cache quando offline (fallback), mas prioriza a rede para dados atualizados
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(evento.request))
  );
});

// Notificações locais disparadas pela própria página (via showNotification)
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./entregaflash.html');
    })
  );
});

// Pronto para push real do servidor (Web Push), quando houver backend configurado
self.addEventListener('push', (evento) => {
  let dados = { title: 'Entrega Flash', body: 'Tens uma atualização.' };
  try { if (evento.data) dados = evento.data.json(); } catch (e) {}
  evento.waitUntil(
    self.registration.showNotification(dados.title || 'Entrega Flash', {
      body: dados.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [120, 60, 120]
    })
  );
});
