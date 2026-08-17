/**
 * Estado de la nube: el banner y la guarda del listener.
 *
 * Estas pruebas existen por una caída real. Las reglas de Firestore empezaron a
 * rechazar el acceso, `onSnapshot` falló, y lo único que hizo la app fue un
 * `console.warn`. En pantalla quedó un historial vacío: un teléfono nuevo, sin
 * respaldo local que lo disimulara, mostraba "0 registros" como si la planta no
 * hubiera inspeccionado nada.
 *
 * Lo que se fija aquí es que un fallo de lectura NUNCA se vea como un cero
 * legítimo, y que el listener pueda volver a levantarse después de caerse.
 *
 * Igual que el resto de la suite, se replica la lógica de index.html en vez de
 * importarla del HTML.
 */
import { describe, it, expect, vi } from 'vitest';

// ── Espejo de index.html ─────────────────────────────────────────────────

function registrosSinConfirmar(locales) {
  return (locales || []).filter(r => r && !r._firebaseId && (r.uid || r.id));
}

function nuevoDom() {
  return {
    banner: { className: 'conn-banner' },
    msg: { textContent: '' },
  };
}

function pintarConexion(dom, estado, detalle, records) {
  if (!dom || !dom.banner) return;

  let sinSubir = 0;
  try { sinSubir = registrosSinConfirmar(records).length; } catch (e) {}

  if (estado === 'error') {
    dom.banner.className = 'conn-banner show';
    dom.msg.textContent = (detalle ? detalle + ' ' : '')
      + 'Estás viendo la copia guardada en este dispositivo'
      + (sinSubir ? ' · ' + sinSubir + ' sin subir' : '')
      + '. Puede estar incompleta.';
    return;
  }

  if (sinSubir > 0) {
    dom.banner.className = 'conn-banner show warn';
    dom.msg.textContent = sinSubir === 1
      ? '1 registro todavía no sube a la nube.'
      : sinSubir + ' registros todavía no suben a la nube.';
    return;
  }

  dom.banner.className = 'conn-banner';
}

// ── El banner ────────────────────────────────────────────────────────────

describe('banner de estado de la nube', () => {
  it('se queda invisible cuando todo está bien y no hay nada pendiente', () => {
    const dom = nuevoDom();
    pintarConexion(dom, 'ok', '', [{ uid: 'a', _firebaseId: 'a' }]);
    expect(dom.banner.className).toBe('conn-banner');
  });

  it('AVISA cuando no hay acceso, aunque el historial local se vea completo', () => {
    // El caso exacto de la caída: la copia local tiene datos, así que la
    // pantalla se ve normal. Sin el banner nadie sabría que está desactualizada.
    const dom = nuevoDom();
    pintarConexion(dom, 'error', 'La base de datos rechazó el acceso.',
      [{ uid: 'a', _firebaseId: 'a' }, { uid: 'b', _firebaseId: 'b' }]);
    expect(dom.banner.className).toContain('show');
    expect(dom.msg.textContent).toContain('La base de datos rechazó el acceso.');
    expect(dom.msg.textContent).toContain('copia guardada en este dispositivo');
  });

  it('AVISA cuando no hay acceso y encima el dispositivo está vacío', () => {
    // El teléfono nuevo: cero registros locales y cero desde la nube. Es el
    // caso que se veía idéntico a "no hay nada que inspeccionar".
    const dom = nuevoDom();
    pintarConexion(dom, 'error', 'La base de datos rechazó el acceso.', []);
    expect(dom.banner.className).toContain('show');
    expect(dom.msg.textContent).toContain('Puede estar incompleta');
  });

  it('distingue el fallo de permisos de una caída de red cualquiera', () => {
    // No es lo mismo: cambiarse de WiFi no arregla un permiso denegado, y el
    // inspector no debería perder el turno intentándolo.
    const conPermisos = nuevoDom();
    pintarConexion(conPermisos, 'error', 'La base de datos rechazó el acceso.', []);
    const sinRed = nuevoDom();
    pintarConexion(sinRed, 'error', 'Sin conexión con la nube.', []);
    expect(conPermisos.msg.textContent).not.toBe(sinRed.msg.textContent);
  });

  it('avisa en ámbar de lo que falta subir aunque la conexión esté bien', () => {
    const dom = nuevoDom();
    pintarConexion(dom, 'ok', '', [
      { uid: 'a', _firebaseId: 'a' },
      { uid: 'b' },
      { uid: 'c' },
    ]);
    expect(dom.banner.className).toContain('warn');
    expect(dom.msg.textContent).toBe('2 registros todavía no suben a la nube.');
  });

  it('conjuga el singular', () => {
    const dom = nuevoDom();
    pintarConexion(dom, 'ok', '', [{ uid: 'b' }]);
    expect(dom.msg.textContent).toBe('1 registro todavía no sube a la nube.');
  });

  it('el error manda sobre el pendiente: incluye ambos datos', () => {
    const dom = nuevoDom();
    pintarConexion(dom, 'error', 'Sin conexión con la nube.', [{ uid: 'b' }, { uid: 'c' }]);
    expect(dom.banner.className).not.toContain('warn');
    expect(dom.msg.textContent).toContain('2 sin subir');
  });

  it('no truena si `records` todavía no existe', () => {
    // El banner puede pintarse desde el callback de la sesión anónima, que
    // llega antes de que el script principal termine de inicializarse.
    const dom = nuevoDom();
    expect(() => pintarConexion(dom, 'error', 'x', undefined)).not.toThrow();
    expect(dom.banner.className).toContain('show');
  });

  it('no truena si el banner todavía no está en el DOM', () => {
    expect(() => pintarConexion(null, 'error', 'x', [])).not.toThrow();
  });
});

// ── La guarda del listener ───────────────────────────────────────────────

function hacerSync(win, onSnapshotImpl) {
  return function startFirebaseSync() {
    if (!win._firebaseReady) return;
    if (win._syncActivo) return;
    win._syncActivo = true;
    onSnapshotImpl();
  };
}

describe('arranque del listener de Firestore', () => {
  it('no arranca sin sesión: escribir sin permisos se daría por subido', () => {
    const win = { _firebaseReady: false };
    const onSnapshot = vi.fn();
    hacerSync(win, onSnapshot)();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('un solo listener aunque lo llamen la sesión y el evento load', () => {
    // Los dos disparadores llegan en cualquier orden. Dos listeners escribirían
    // los dos sobre `records`.
    const win = { _firebaseReady: true };
    const onSnapshot = vi.fn();
    const start = hacerSync(win, onSnapshot);
    start();
    start();
    start();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('se puede volver a levantar después de un error', () => {
    // onSnapshot no se reintenta solo. Si el error no libera la bandera, la app
    // se queda con el respaldo local para siempre y sólo la salva una recarga.
    const win = { _firebaseReady: true };
    const onSnapshot = vi.fn();
    const start = hacerSync(win, onSnapshot);
    start();
    win._syncActivo = false;   // lo que hace el handler de error
    start();
    expect(onSnapshot).toHaveBeenCalledTimes(2);
  });
});
