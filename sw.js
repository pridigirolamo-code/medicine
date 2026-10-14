// Tiene una copia dell'app sul telefono, così si apre anche senza internet.
// Cambiare VERSIONE a ogni aggiornamento dei file.
var VERSIONE = 'medicine-22';
var FILE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIONE).then(function (c) { return c.addAll(FILE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomi) {
    return Promise.all(nomi.filter(function (n) { return n !== VERSIONE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata se manca la connessione.
// cache: 'no-cache' chiede sempre al sito se il file è cambiato: senza, il telefono può usare per 10 minuti
// la copia del browser e l'aggiornamento non si vede.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' }).then(function (r) {
    var copia = r.clone();
    caches.open(VERSIONE).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
});

// Toccando l'avviso della medicina si torna all'app.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (aperte) {
    return aperte.length ? aperte[0].focus() : self.clients.openWindow('./');
  }));
});
