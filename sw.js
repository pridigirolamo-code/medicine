// Tiene una copia dell'app sul telefono, così si apre anche senza internet.
// Cambiare VERSIONE a ogni aggiornamento dei file.
var VERSIONE = 'medicine-50';
// Qui l'app lascia il codice del telefono, così le notifiche lo dicono al server: non si cancella agli aggiornamenti.
var DATI = 'medicine-dati';
var FILE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIONE).then(function (c) { return c.addAll(FILE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomi) {
    return Promise.all(nomi.filter(function (n) { return n !== VERSIONE && n !== DATI; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// Prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata se manca la connessione.
// cache: 'no-cache' chiede sempre al sito se il file è cambiato: senza, il telefono può usare per 10 minuti
// la copia del browser e l'aggiornamento non si vede.
self.addEventListener('fetch', function (e) {
  // Le richieste al server online (altro indirizzo) passano dirette, senza copia.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' }).then(function (r) {
    var copia = r.clone();
    caches.open(VERSIONE).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
});

// Il server sveglia il telefono all'ora della medicina, anche con l'app chiusa: chiedo il testo e mostro la notifica.
// Pubblicata su GitHub, l'app usa il server online; servita dal suo server (in casa) usa quello.
var SERVIZIO = /\.github\.io$/.test(self.location.hostname) ? 'https://medicine-server-production.up.railway.app/' : './';
// Su Android la notifica ha anche i tasti «L'ho presa» e «Saltata» (l'iPhone non li mostra: lì si tocca la notifica e si apre l'app).
function codiceTelefono() {
  return caches.open(DATI).then(function (c) { return c.match('dispositivo'); }).then(function (r) { return r ? r.text() : ''; }).catch(function () { return ''; });
}
self.addEventListener('push', function (e) {
  var endpoint = '', dispositivo = '';
  e.waitUntil(Promise.all([self.registration.pushManager.getSubscription(), codiceTelefono()]).then(function (v) {
    endpoint = v[0] ? v[0].endpoint : ''; dispositivo = v[1];
    return fetch(SERVIZIO + 'api/notifica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: endpoint, dispositivo: dispositivo }) });
  }).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (j) {
    // Se il server non risponde, un testo che va bene per qualsiasi avviso (medicine o richieste di accesso).
    var testo = j && j.testi && j.testi.length ? j.testi.join(' ') : 'C\'è un nuovo avviso: apri l\'app.';
    var dosi = j && Array.isArray(j.dosi) ? j.dosi : [];
    var opzioni = { body: testo, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'medicina', renotify: true, vibrate: [300, 150, 300], data: { dosi: dosi, endpoint: endpoint, dispositivo: dispositivo } };
    if (dosi.length) opzioni.actions = [{ action: 'presa', title: dosi.length > 1 ? 'Le ho prese' : 'L\'ho presa' }, { action: 'saltata', title: 'Saltata' }];
    return self.registration.showNotification('Le mie medicine', opzioni);
  }));
});

// Un tasto della notifica segna la dose sul server (l'app la riceve alla prossima apertura);
// toccando la notifica, invece, si torna all'app.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var d = e.notification.data || {};
  if ((e.action === 'presa' || e.action === 'saltata') && d.dosi && d.dosi.length) {
    e.waitUntil(fetch(SERVIZIO + 'api/segna', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: d.endpoint, dispositivo: d.dispositivo, dosi: d.dosi, esito: e.action }) })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (aperte) { aperte.forEach(function (c) { c.postMessage('aggiorna'); }); })
      .catch(function () { return self.registration.showNotification('Le mie medicine', { body: 'Non sono riuscito a segnarla: apri l\'app e segnala lì.', icon: 'icon-192.png', tag: 'medicina' }); }));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (aperte) {
    return aperte.length ? aperte[0].focus() : self.clients.openWindow('./');
  }));
});
