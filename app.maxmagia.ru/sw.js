/* MaxMagia — помощник кабинета (21.10.2026): показывает уведомления клуба на экране.
   Ничего не кэширует и не мешает работе кабинета. Лежит в корне app.maxmagia.ru/sw.js */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Клуб #MaxMagia', body: e.data ? e.data.text() : '' }; }
  var title = d.title || 'Клуб #MaxMagia';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/apple-touch-icon.png',
      tag: d.tag || 'mm',
      renotify: true,
      data: { url: d.url || '/?open=inbox' }
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      cs.forEach(function (c) { c.postMessage({ mm: 'push' }); });
    })
  ]));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/?open=inbox', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
        c.postMessage({ mm: 'open', url: url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
