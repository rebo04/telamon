/**
 * Sincronización con Firestore.
 *
 * El caso que estas pruebas protegen es concreto: el iPad captura sin red, iOS
 * mata la PWA antes de que la escritura salga, y al reconectar llega el primer
 * snapshot. Si el listener reemplaza la lista a ciegas, esos registros se
 * borran del historial y del Excel sin que nadie se entere.
 *
 * La otra mitad del problema es el reverso: un registro que sí llegó al
 * servidor y alguien borró desde otro dispositivo NO debe reaparecer.
 *
 * index.html lleva su propia copia de estas funciones porque es un PWA de un
 * solo archivo. La batería corre contra las dos para que no puedan divergir.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as src from '../../src/logic.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = readFileSync(join(REPO, 'index.html'), 'utf8');
const BLOQUE = /\/\/ <<< SYNC-MERGE[\s\S]*?\/\/ >>> SYNC-MERGE FIN/;

describe('copia inline en index.html', () => {
  it('existe el bloque SYNC-MERGE', () => {
    expect(BLOQUE.test(HTML)).toBe(true);
  });
});

const inline = new Function(
  HTML.match(BLOQUE)[0] +
  '\nreturn { nuevoUid, syncKey, registrosSinConfirmar, mergeRegistrosRemotos,' +
  ' idDocumentoABorrar, debeAplicarSnapshot };'
)();

const IMPLS = [['src/logic.js', src], ['index.html (inline)', inline]];

IMPLS.forEach(([nombre, api]) => {
  describe(`sincronización — ${nombre}`, () => {

    // ── syncKey ──────────────────────────────────────────────────────────

    it('syncKey prefiere uid sobre id', () => {
      expect(api.syncKey({ uid: 'u-1', id: 999 })).toBe('uid:u-1');
    });

    it('syncKey cae a id para registros anteriores a uid', () => {
      expect(api.syncKey({ id: 1755000000000 })).toBe('id:1755000000000');
    });

    it('syncKey devuelve null cuando no hay con qué identificar', () => {
      expect(api.syncKey({})).toBeNull();
      expect(api.syncKey(null)).toBeNull();
      expect(api.syncKey({ id: null })).toBeNull();
    });

    // ── registrosSinConfirmar ────────────────────────────────────────────

    it('sin confirmar = los que no tienen _firebaseId', () => {
      const pend = api.registrosSinConfirmar([
        { uid: 'a' },
        { uid: 'b', _firebaseId: 'fb-b' },
        { uid: 'c' },
      ]);
      expect(pend.map(r => r.uid)).toEqual(['a', 'c']);
    });

    it('sin confirmar ignora registros sin identidad', () => {
      expect(api.registrosSinConfirmar([{ cell: '215' }])).toEqual([]);
    });

    it('sin confirmar tolera null y undefined', () => {
      expect(api.registrosSinConfirmar(null)).toEqual([]);
      expect(api.registrosSinConfirmar([null, undefined])).toEqual([]);
    });

    // ── mergeRegistrosRemotos: el bug original ───────────────────────────

    it('conserva un registro capturado sin red que el snapshot no trae', () => {
      const remotos = [{ uid: 'srv', ts: '2026-07-20T10:00:00Z', _firebaseId: 'fb-1' }];
      const locales = [
        { uid: 'srv', ts: '2026-07-20T10:00:00Z', _firebaseId: 'fb-1' },
        { uid: 'offline', ts: '2026-07-20T11:00:00Z' },   // nunca subió
      ];
      const out = api.mergeRegistrosRemotos(remotos, locales);
      expect(out.map(r => r.uid)).toContain('offline');
      expect(out).toHaveLength(2);
    });

    it('NO resucita un registro borrado desde otro dispositivo', () => {
      // Tiene _firebaseId: el servidor lo aceptó alguna vez. Que ya no esté en
      // el snapshot significa que lo borraron a propósito.
      const remotos = [];
      const locales = [{ uid: 'borrado', _firebaseId: 'fb-9' }];
      expect(api.mergeRegistrosRemotos(remotos, locales)).toEqual([]);
    });

    it('no duplica cuando el pendiente ya apareció en el snapshot', () => {
      const remotos = [{ uid: 'x', ts: '2026-07-20T10:00:00Z', _firebaseId: 'fb-x' }];
      const locales = [{ uid: 'x', ts: '2026-07-20T10:00:00Z' }]; // aún sin confirmar local
      const out = api.mergeRegistrosRemotos(remotos, locales);
      expect(out).toHaveLength(1);
      expect(out[0]._firebaseId).toBe('fb-x');
    });

    it('reconoce por id los registros anteriores a uid', () => {
      const remotos = [{ id: 100, ts: '2026-07-20T10:00:00Z', _firebaseId: 'fb-100' }];
      const locales = [{ id: 100, ts: '2026-07-20T10:00:00Z' }];
      expect(api.mergeRegistrosRemotos(remotos, locales)).toHaveLength(1);
    });

    it('ordena el resultado por ts descendente', () => {
      const remotos = [
        { uid: 'a', ts: '2026-07-20T12:00:00Z', _firebaseId: 'fb-a' },
        { uid: 'b', ts: '2026-07-20T08:00:00Z', _firebaseId: 'fb-b' },
      ];
      const locales = [{ uid: 'mid', ts: '2026-07-20T10:00:00Z' }];
      const out = api.mergeRegistrosRemotos(remotos, locales);
      expect(out.map(r => r.uid)).toEqual(['a', 'mid', 'b']);
    });

    it('devuelve el snapshot intacto cuando no hay nada pendiente', () => {
      const remotos = [{ uid: 'a', _firebaseId: 'fb-a' }];
      expect(api.mergeRegistrosRemotos(remotos, [])).toBe(remotos);
    });

    it('tolera argumentos nulos', () => {
      expect(api.mergeRegistrosRemotos(null, null)).toEqual([]);
      expect(api.mergeRegistrosRemotos(null, [{ uid: 'a' }]).map(r => r.uid)).toEqual(['a']);
    });

    // ── idDocumentoABorrar ───────────────────────────────────────────────

    it('borra por _firebaseId cuando el registro ya está confirmado', () => {
      expect(api.idDocumentoABorrar({ uid: 'u-1', _firebaseId: 'fb-1' })).toBe('fb-1');
    });

    it('borra por uid un registro capturado sin red', () => {
      // Su escritura está encolada bajo el uid. Si no se borra ESE documento,
      // la escritura pendiente sale al reconectar y el registro reaparece.
      expect(api.idDocumentoABorrar({ uid: 'u-pendiente' })).toBe('u-pendiente');
    });

    it('no inventa un documento cuando no hay ninguno que borrar', () => {
      expect(api.idDocumentoABorrar({ id: 123 })).toBeNull();
      expect(api.idDocumentoABorrar(null)).toBeNull();
    });

    // ── nuevoUid ─────────────────────────────────────────────────────────

    it('nuevoUid no repite valores', () => {
      const s = new Set();
      for (let i = 0; i < 500; i++) s.add(api.nuevoUid());
      expect(s.size).toBe(500);
    });

    it('nuevoUid sirve como ID de documento de Firestore', () => {
      const uid = api.nuevoUid();
      // Firestore rechaza IDs vacíos, con '/', o de la forma __x__.
      expect(uid.length).toBeGreaterThan(0);
      expect(uid).not.toContain('/');
      expect(uid).not.toMatch(/^__.*__$/);
    });

    // ── debeAplicarSnapshot ──────────────────────────────────────────────
    //
    // La regresión que dejó los teléfonos en blanco. Con caché persistente el
    // primer snapshot sale de IndexedDB, y en un dispositivo recién actualizado
    // ese IndexedDB está vacío.

    const CACHE = { fromCache: true };
    const SERVIDOR = { fromCache: false };
    const HISTORIAL = [
      { uid: 's1', ts: '2026-08-11T07:00:00Z', _firebaseId: 'fb-s1' },
      { uid: 's2', ts: '2026-08-11T07:30:00Z', _firebaseId: 'fb-s2' },
    ];

    it('ignora el snapshot vacío de caché fría cuando hay historial local', () => {
      expect(api.debeAplicarSnapshot(CACHE, [], HISTORIAL)).toBe(false);
    });

    it('aplica el vacío que confirma el servidor', () => {
      // Aquí el cero es real: alguien borró todo desde otro dispositivo.
      expect(api.debeAplicarSnapshot(SERVIDOR, [], HISTORIAL)).toBe(true);
    });

    it('aplica cualquier snapshot que traiga documentos, venga de donde venga', () => {
      expect(api.debeAplicarSnapshot(CACHE, HISTORIAL, [])).toBe(true);
      expect(api.debeAplicarSnapshot(CACHE, HISTORIAL, HISTORIAL)).toBe(true);
      expect(api.debeAplicarSnapshot(SERVIDOR, HISTORIAL, HISTORIAL)).toBe(true);
    });

    it('un dispositivo sin nada local no tiene qué proteger', () => {
      expect(api.debeAplicarSnapshot(CACHE, [], [])).toBe(true);
    });

    it('sin metadata conserva el comportamiento anterior: aplicar', () => {
      expect(api.debeAplicarSnapshot(undefined, [], HISTORIAL)).toBe(true);
      expect(api.debeAplicarSnapshot(null, [], HISTORIAL)).toBe(true);
      expect(api.debeAplicarSnapshot({}, [], HISTORIAL)).toBe(true);
    });

    it('tolera remotos/locales ausentes', () => {
      expect(api.debeAplicarSnapshot(CACHE, null, HISTORIAL)).toBe(false);
      expect(api.debeAplicarSnapshot(CACHE, null, null)).toBe(true);
    });
  });
});

// ── Escenario de la regresión ──────────────────────────────────────────────

describe('escenario: el teléfono acaba de instalar la versión nueva', () => {
  // Reproduce la secuencia exacta que vació los teléfonos: la caché de
  // IndexedDB es nueva, el primer snapshot llega vacío desde ahí, y sólo
  // después contesta el servidor.
  const HISTORIAL = [
    { uid: 's1', ts: '2026-08-11T07:00:00Z', _firebaseId: 'fb-s1' },
    { uid: 's2', ts: '2026-08-11T07:30:00Z', _firebaseId: 'fb-s2' },
  ];

  it('el historial sobrevive al snapshot de caché fría', () => {
    let records = [...HISTORIAL];

    // Snapshot 1: IndexedDB recién creado, cero documentos.
    if (src.debeAplicarSnapshot({ fromCache: true }, [], records)) {
      records = src.mergeRegistrosRemotos([], records);
    }
    expect(records).toHaveLength(2);   // antes del fix: 0

    // Snapshot 2: contesta el servidor con todo.
    if (src.debeAplicarSnapshot({ fromCache: false }, HISTORIAL, records)) {
      records = src.mergeRegistrosRemotos(HISTORIAL, records);
    }
    expect(records).toHaveLength(2);
  });

  it('lo capturado sin red tampoco se pierde en esa secuencia', () => {
    let records = [...HISTORIAL, { uid: 'o1', ts: '2026-08-11T09:00:00Z' }];

    if (src.debeAplicarSnapshot({ fromCache: true }, [], records)) {
      records = src.mergeRegistrosRemotos([], records);
    }
    expect(records).toHaveLength(3);

    if (src.debeAplicarSnapshot({ fromCache: false }, HISTORIAL, records)) {
      records = src.mergeRegistrosRemotos(HISTORIAL, records);
    }
    // Los 2 del servidor + el pendiente que todavía no sube.
    expect(records).toHaveLength(3);
    expect(records.filter(r => !r._firebaseId)).toHaveLength(1);
  });
});

// ── Escenario completo ─────────────────────────────────────────────────────

describe('escenario: turno completo sin red', () => {
  it('los registros del turno sobreviven al primer snapshot al reconectar', () => {
    // El iPad ya traía 2 registros del servidor y el inspector capturó 3 sin red.
    const delServidor = [
      { uid: 's1', ts: '2026-07-20T07:00:00Z', _firebaseId: 'fb-s1' },
      { uid: 's2', ts: '2026-07-20T07:30:00Z', _firebaseId: 'fb-s2' },
    ];
    const enElIpad = [
      ...delServidor,
      { uid: 'o1', ts: '2026-07-20T09:00:00Z' },
      { uid: 'o2', ts: '2026-07-20T09:30:00Z' },
      { uid: 'o3', ts: '2026-07-20T10:00:00Z' },
    ];

    // Vuelve la red. El snapshot sólo conoce lo que alcanzó a subir: nada.
    const out = src.mergeRegistrosRemotos(delServidor, enElIpad);

    expect(out).toHaveLength(5);
    expect(out.filter(r => !r._firebaseId)).toHaveLength(3);
  });

  it('una vez subidos, el siguiente snapshot no los duplica', () => {
    const enElIpad = [
      { uid: 'o1', ts: '2026-07-20T09:00:00Z', _firebaseId: 'o1' },
      { uid: 'o2', ts: '2026-07-20T09:30:00Z', _firebaseId: 'o2' },
    ];
    // Firestore los devuelve con el uid como ID de documento.
    const snapshot = [
      { uid: 'o1', ts: '2026-07-20T09:00:00Z', _firebaseId: 'o1' },
      { uid: 'o2', ts: '2026-07-20T09:30:00Z', _firebaseId: 'o2' },
    ];
    expect(src.mergeRegistrosRemotos(snapshot, enElIpad)).toHaveLength(2);
  });
});
