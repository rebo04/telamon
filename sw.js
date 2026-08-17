// v6 — el HTML pasa a network-first y la navegación sin red ya no muere.
//
// Antes todo era cache-first, y eso traía dos problemas:
//
//   1. El index.html quedaba congelado. Cada release dependía de que alguien se
//      acordara de subir este número a mano; olvidarlo no daba ningún síntoma,
//      simplemente los iPads seguían con la versión vieja para siempre.
//   2. La app instalada en un celular abre ".../telamon/", no ".../index.html".
//      Son dos claves distintas en el caché, así que `caches.match` fallaba y
//      sin red la respuesta era un Response.error(): pantalla en blanco con la
//      app "instalada".
//
// Ahora el HTML va por red primero (el caché es sólo el respaldo de emergencia)
// y la navegación sin red cae a index.html sin importar con qué URL se abrió.
// Subir esta versión sigue siendo buena práctica, pero ya no es lo que decide
// si la gente recibe el código nuevo.
const CACHE = 'telamon-qc-v6';

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

// Hosts cuyas respuestas se pueden guardar al vuelo.
const CACHEABLES = [
  self.location.origin,
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
  'https://www.gstatic.com'
];

// Tráfico que no pasa por el service worker en absoluto.
//
// Firestore es la base de datos en vivo, no un recurso estático: su canal es
// una conexión de larga duración y cachearlo serviría registros congelados.
// Los dos de identidad son la sesión anónima y la renovación del token —
// guardar un token vencido sería peor que no guardar nada.
const SIN_SW = [
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com'
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

function origenDe(req) {
  try { return new URL(req.url).origin; }
  catch (e) { return null; }
}

function esCacheable(req) {
  return CACHEABLES.indexOf(origenDe(req)) !== -1;
}

// ¿Es el documento de la app? Cubre tanto la navegación (abrir la app, recargar,
// lanzarla desde el ícono del celular) como una petición directa a index.html.
function esDocumento(req) {
  if (req.mode === 'navigate') return true;
  return origenDe(req) === self.location.origin && /\.html($|\?)/.test(req.url);
}

// Red primero, caché como respaldo. Para el HTML: importa más traer la versión
// de hoy que ahorrarse una petición.
async function redPrimero(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    // Sin red. Se prueba la URL exacta y, si no está, el index.html guardado:
    // ese segundo intento es el que salva al PWA abierto desde el ícono, que
    // pide ".../telamon/" y nunca coincidiría con la clave "./index.html".
    return (await cache.match(req))
        || (await cache.match('./index.html'))
        || Response.error();
  }
}

// Caché primero. Para librerías y fuentes: sus URLs llevan versión, así que lo
// guardado no envejece y ahorrarse la red es puro beneficio.
async function cachePrimero(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    // Se guarda lo que sirva para la próxima vez sin red. Así, si un CDN falló
    // durante la instalación, se repara solo en el primer uso con red en vez de
    // quedarse sin esa librería para siempre.
    if (res && res.ok && esCacheable(req)) {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;

  // Lo que no es GET (las escrituras a Firestore, por ejemplo) va directo a la
  // red. No se responde nada: el navegador lo maneja mejor que nosotros.
  if (req.method !== 'GET') return;
  if (SIN_SW.indexOf(origenDe(req)) !== -1) return;

  if (esDocumento(req)) {
    e.respondWith(redPrimero(req));
    return;
  }
  e.respondWith(cachePrimero(req));
});
