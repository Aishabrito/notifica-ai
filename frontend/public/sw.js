// Service worker do Notifica.ai: recebe as notificações no celular/computador.
// Não guarda páginas em cache (o site sempre busca a versão mais nova).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch { dados = { titulo: evento.data && evento.data.text() }; }
  const titulo = dados.titulo || 'Notifica.ai';
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.corpo || '',
    icon: '/icone-192.png',
    badge: '/badge-96.png',
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag),
    requireInteraction: Boolean(dados.urgente),
    vibrate: dados.urgente ? [200, 100, 200, 100, 400] : [150],
    data: { url: dados.url || '/dashboard' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data && evento.notification.data.url || '/dashboard', self.location.origin).href;
  evento.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Link de outro site (ex.: página do edital): abre direto
    if (!destino.startsWith(self.location.origin)) return self.clients.openWindow(destino);
    for (const c of abertas) {
      if (c.url.startsWith(self.location.origin) && 'focus' in c) { await c.navigate(destino).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(destino);
  })());
});
