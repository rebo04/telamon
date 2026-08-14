// Subir esta versión en CADA release que toque index.html.
// La estrategia es cache-first: si el nombre no cambia, los iPads que ya
// instalaron la app seguirían sirviendo la versión vieja para siempre.
// v5 — el snapshot vacío de caché fría ya no borra el historial (v4 lo hacía)
const CACHE = 'telamon-qc-v5';

// Sin estos dos no hay app. Si no se pueden guardar, la instalación debe
// fallar en vez de dejar un PWA a medias que nadie sabe que quedó roto.
const CORE = [
  './index.html',
  './manifest.json'
];

// Librerías externas. Se guardan una por una para que el fallo de un CDN no
// tumbe la instalación completa: sin ellas la app sigue capturando, sólo
// degrada (el Excel sale sin gráficas, el dashboard no dibuja).
const EXTRAS = [
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap',
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
];

// Hosts cuyas respuestas se pueden guardar al vuelo. Firestore NO está aquí:
// su tráfico es la base de datos en vivo, no un recurso estático, y cachearlo
// serviría registros congelados.
const CACHEABLES = [
  self.location.origin,
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
  'https://www.gstatic.com'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    const res = await Promise.allSettled(EXTRAS.map(u => c.add(u)));
    res.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[SW] no se pudo cachear', EXTRAS[i], r.reason);
      }
    });
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function esCacheable(req) {
  if (req.method !== 'GET') return false;
  try { return CACHEABLES.indexOf(new URL(req.url).origin) !== -1; }
  catch (e) { return false; }
}

self.addEventListener('fetch', e => {
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      // Se guarda lo que sirva para la próxima vez sin red. Así, si un CDN
      // falló durante la instalación, se repara solo en el primer uso con red
      // en vez de quedarse sin esa librería para siempre.
      if (res && res.ok && esCacheable(e.request)) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
      }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
