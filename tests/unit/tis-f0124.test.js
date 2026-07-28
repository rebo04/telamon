/**
 * Codificación de defectos TIS-F0124.
 *
 * Estas pruebas fijan reglas de CALIDAD, no detalles de implementación:
 * si una cambia sin querer, cambia cómo se clasifica un defecto en piso.
 */
import { describe, it, expect } from 'vitest';
import {
  ELEMENTOS, TIPOS, SEVERIDADES, ANCLAJES_DOC,
  TIS_F0124_SELLO, SIN_CLASIFICAR,
  getElemento, getTipo, esCodigoValido,
  formatCodigo, describirCodigo, parseCodigo,
  resolverSeveridad, severidadDe, esDisposicion,
  crearDefecto, crearSinClasificar, esSinClasificar,
  severidadMaxima, defectosAString, contarDefectos,
  migrarFallaLegado, migrarCadenaFallas, migrarRegistro, migrarRegistros,
  buscarElementos, buscarTipos,
  FALLAS_LEGADO,
} from '../../src/logic.js';

// ── INTEGRIDAD DEL CATÁLOGO ──────────────────────────────────────────────

describe('catálogo TIS-F0124', () => {
  it('trae los 71 elementos del documento', () => {
    expect(ELEMENTOS).toHaveLength(71);
  });

  it('trae los 72 tipos de defecto del documento', () => {
    expect(TIPOS).toHaveLength(72);
  });

  it('numera los tipos de 1 a 72 sin huecos', () => {
    expect(TIPOS.map(t => t.num)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1)
    );
  });

  it('no repite códigos de elemento', () => {
    const codes = ELEMENTOS.map(e => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('clasifica todos los elementos y todos los tipos', () => {
    expect(ELEMENTOS.every(e => e.clase)).toBe(true);
    expect(TIPOS.every(t => t.clase)).toBe(true);
  });

  it('expone los tres niveles de severidad del documento', () => {
    expect(Object.keys(SEVERIDADES).sort()).toEqual(['A', 'B', 'C']);
  });

  it('lleva el sello de revisión del documento controlado', () => {
    expect(TIS_F0124_SELLO).toBe('TIS-F0124 Rev.9 (2024-09-17)');
  });

  it('conserva ejemplos concretos del documento', () => {
    expect(getElemento('TE').nombre).toBe('Terminal');
    expect(getElemento('PIG').nombre).toBe('Pigtail');
    expect(getTipo(36).nombre).toBe('Roto');
    expect(getTipo(72).nombre).toBe('Curva');
  });
});

// ── FORMATO ──────────────────────────────────────────────────────────────

describe('formato de código', () => {
  it('usa elemento-guión-número', () => {
    expect(formatCodigo('TE', 36)).toBe('TE-36');
  });

  it('describe el código en lenguaje de piso', () => {
    expect(describirCodigo('TE', 36)).toBe('TE-36 · Terminal / Roto');
  });

  it('parsea de vuelta un código válido', () => {
    expect(parseCodigo('TE-36')).toEqual({ el: 'TE', tipo: 36 });
  });

  it('acepta minúsculas y espacios al importar', () => {
    expect(parseCodigo('  te - 36 ')).toEqual({ el: 'TE', tipo: 36 });
  });

  it('rechaza códigos que no existen en el catálogo', () => {
    expect(parseCodigo('ZZ-36')).toBeNull();
    expect(parseCodigo('TE-99')).toBeNull();
    expect(parseCodigo('basura')).toBeNull();
    expect(esCodigoValido('ZZ', 1)).toBe(false);
  });
});

// ── SEVERIDAD: PRECEDENCIA ───────────────────────────────────────────────

describe('resolución de severidad', () => {
  it('el criterio del documento gana sobre la matriz', () => {
    // El tipo 1 (Abierto) es funcional, así que la matriz mandaría CM-1 a
    // "A". Pero Sheet1 lista "candados abiertos" bajo el criterio B.
    // El documento es la autoridad.
    const r = resolverSeveridad('CM', 1);
    expect(r.sev).toBe('B');
    expect(r.fuente).toBe('doc');
    expect(r.cita).toMatch(/candados abiertos/i);
  });

  it('ancla en A las fallas de prensado que el documento nombra', () => {
    expect(severidadDe('PC', 14)).toBe('A');
    expect(severidadDe('PA', 50)).toBe('A');
    expect(severidadDe('HI', 11)).toBe('A');
  });

  it('ancla en A terminal no asentada, jalada, desalineada y doblada', () => {
    [32, 28, 15, 57].forEach(t => {
      expect(resolverSeveridad('TE', t)).toMatchObject({ sev: 'A', fuente: 'doc' });
    });
  });

  it('ancla en A los problemas de identificación por barcode', () => {
    [25, 22, 26].forEach(t => {
      expect(resolverSeveridad('CB', t)).toMatchObject({ sev: 'A', fuente: 'doc' });
    });
  });

  it('ancla en C encintado en bandera y exceso de cinta', () => {
    expect(resolverSeveridad('EN', 6)).toMatchObject({ sev: 'C', fuente: 'doc' });
    expect(resolverSeveridad('EN', 18)).toMatchObject({ sev: 'C', fuente: 'doc' });
    expect(resolverSeveridad('SC', 18)).toMatchObject({ sev: 'C', fuente: 'doc' });
  });

  it('ancla en C tubos mal cortados', () => {
    ['TP', 'TC', 'TR'].forEach(e => {
      expect(severidadDe(e, 11)).toBe('C');
      expect(severidadDe(e, 16)).toBe('C');
    });
  });

  it('cae a la matriz cuando el documento no cubre el par', () => {
    // Conector roto: el documento no lo lista, pero pierde retención de
    // terminal → falla funcional. Elemento eléctrico × tipo funcional = A.
    const r = resolverSeveridad('CP', 36);
    expect(r.sev).toBe('A');
    expect(r.fuente).toBe('matriz');
  });

  it('manda a C los defectos cosméticos sobre elementos de protección', () => {
    expect(severidadDe('TT', 71)).toBe('C');
  });

  it('siempre reporta de dónde salió la severidad', () => {
    ELEMENTOS.forEach(e => {
      TIPOS.forEach(t => {
        const r = resolverSeveridad(e.code, t.num);
        expect(['doc', 'matriz', 'default', 'disposicion']).toContain(r.fuente);
        expect(r.cita).toBeTruthy();
      });
    });
  });

  it('nunca deja un defecto real sin severidad', () => {
    ELEMENTOS.forEach(e => {
      TIPOS.filter(t => t.clase !== 'DISP').forEach(t => {
        expect(['A', 'B', 'C']).toContain(severidadDe(e.code, t.num));
      });
    });
  });

  it('rechaza un par que no existe', () => {
    expect(resolverSeveridad('ZZ', 1).fuente).toBe('invalido');
  });

  it('los anclajes documentales no se contradicen entre sí', () => {
    Object.entries(ANCLAJES_DOC).forEach(([k, v]) => {
      expect(['A', 'B', 'C']).toContain(v.sev);
      expect(parseCodigo(k)).not.toBeNull();
    });
  });
});

// ── DISPOSICIONES: NO SON DEFECTOS ───────────────────────────────────────

describe('disposiciones de material', () => {
  const DISP = [20, 43, 44, 45, 51, 52, 53, 54];

  it('marca como disposición los tipos que no son no-conformidades', () => {
    DISP.forEach(t => expect(esDisposicion(t)).toBe(true));
  });

  it('no les asigna severidad', () => {
    DISP.forEach(t => {
      const r = resolverSeveridad('AR', t);
      expect(r.sev).toBeNull();
      expect(r.fuente).toBe('disposicion');
    });
  });

  it('un defecto real sí es defecto', () => {
    expect(esDisposicion(36)).toBe(false);
  });

  it('las excluye del conteo de defectos y las reporta aparte', () => {
    const c = contarDefectos([
      crearDefecto('TE', 36),
      crearDefecto('AR', 43),   // Desperdiciado por Mantenimiento
      crearDefecto('AR', 53),   // Muestras de Set Up
    ]);
    expect(c.totalDefectos).toBe(1);
    expect(Object.keys(c.disposiciones)).toHaveLength(2);
    expect(c.porSeveridad.A).toBe(1);
  });
});

// ── CONSTRUCCIÓN Y AJUSTE MANUAL ─────────────────────────────────────────

describe('crearDefecto', () => {
  it('guarda el código, la severidad y su justificación', () => {
    const d = crearDefecto('TE', 32);
    expect(d).toMatchObject({
      el: 'TE', tipo: 32, codigo: 'TE-32',
      sev: 'A', sevAuto: 'A', sevFuente: 'doc',
    });
  });

  it('no marca ajuste manual si el inspector confirma la sugerida', () => {
    const d = crearDefecto('TE', 32, 'A');
    expect(d.sevManual).toBeUndefined();
  });

  it('conserva la sugerida cuando el inspector la sobrescribe', () => {
    const d = crearDefecto('TE', 32, 'C');
    expect(d.sev).toBe('C');
    expect(d.sevManual).toBe('C');
    expect(d.sevAuto).toBe('A');
  });

  it('ignora una severidad inventada', () => {
    const d = crearDefecto('TE', 32, 'Z');
    expect(d.sev).toBe('A');
    expect(d.sevManual).toBeUndefined();
  });

  it('devuelve null para un par fuera del catálogo', () => {
    expect(crearDefecto('ZZ', 1)).toBeNull();
    expect(crearDefecto('TE', 999)).toBeNull();
  });
});

// ── AGREGACIÓN ───────────────────────────────────────────────────────────

describe('severidadMaxima', () => {
  it('devuelve la peor severidad presente', () => {
    expect(severidadMaxima([crearDefecto('EN', 6), crearDefecto('TE', 32)])).toBe('A');
    expect(severidadMaxima([crearDefecto('EN', 6), crearDefecto('CM', 1)])).toBe('B');
  });

  it('devuelve null sin defectos con severidad', () => {
    expect(severidadMaxima([])).toBeNull();
    expect(severidadMaxima([crearDefecto('AR', 43)])).toBeNull();
    expect(severidadMaxima(null)).toBeNull();
  });
});

describe('defectosAString', () => {
  it('devuelve N/A sin defectos', () => {
    expect(defectosAString([], '')).toBe('N/A');
  });

  it('separa los defectos con " | "', () => {
    const s = defectosAString([crearDefecto('TE', 36), crearDefecto('EN', 6)]);
    expect(s).toBe('TE-36 · Terminal / Roto | EN-6 · Encintado / Cinta / Bandera');
  });

  it('agrega el texto libre al final', () => {
    expect(defectosAString([crearDefecto('TE', 36)], 'algo raro'))
      .toBe('TE-36 · Terminal / Roto | Otro: algo raro');
  });

  it('preserva el texto original de lo sin clasificar', () => {
    const d = crearSinClasificar('Conector dañado / Roto', 'ambiguo');
    expect(defectosAString([d])).toBe('SIN-CLASIFICAR: Conector dañado / Roto');
  });
});

// ── MIGRACIÓN: NO INVENTAR DATOS ─────────────────────────────────────────

describe('migración del catálogo legado', () => {
  it('auto-mapea sólo lo que determina elemento Y tipo', () => {
    expect(migrarFallaLegado('Terminal no insertada (Push-back)')).toMatchObject({ codigo: 'TE-32', sev: 'A' });
    expect(migrarFallaLegado('Cables invertidos (Miswire)')).toMatchObject({ codigo: 'CA-27' });
    expect(migrarFallaLegado('Circuito abierto / Sin continuidad')).toMatchObject({ codigo: 'CN-1' });
    expect(migrarFallaLegado('Cortocircuito')).toMatchObject({ codigo: 'CN-12' });
    expect(migrarFallaLegado('Terminal dañada / Deformada')).toMatchObject({ codigo: 'TE-56' });
  });

  it('NO inventa un código cuando la etiqueta es ambigua', () => {
    [
      'Falta de componente (Clip, Sello, TPA)',
      'Daño en aislamiento / Cobre expuesto',
      'Conector dañado / Roto',
      'Ruteo incorrecto / Longitud',
      'Encintado defectuoso / Faltante',
    ].forEach(f => {
      const d = migrarFallaLegado(f);
      expect(esSinClasificar(d)).toBe(true);
      expect(d.sev).toBeNull();
      expect(d.textoOriginal).toBe(f);   // el dato original nunca se pierde
      expect(d.sevCita).toBeTruthy();    // y queda dicho por qué
    });
  });

  it('cubre las 10 etiquetas del catálogo legado', () => {
    FALLAS_LEGADO.forEach(f => expect(migrarFallaLegado(f)).not.toBeNull());
  });

  it('manda a sin-clasificar cualquier texto desconocido', () => {
    const d = migrarFallaLegado('lo que sea');
    expect(esSinClasificar(d)).toBe(true);
    expect(d.textoOriginal).toBe('lo que sea');
  });

  it('parte la cadena por " | " y por ", "', () => {
    const l = migrarCadenaFallas('Cortocircuito, Terminal dañada / Deformada');
    expect(l.map(d => d.codigo)).toEqual(['CN-12', 'TE-56']);
  });

  it('no confunde "Otro: …" con una lista separada por comas', () => {
    const l = migrarCadenaFallas('Cortocircuito | Otro: se cayó, se rompió');
    expect(l).toHaveLength(2);
    expect(l[1].textoOriginal).toBe('Otro: se cayó, se rompió');
  });

  it('devuelve vacío para N/A', () => {
    expect(migrarCadenaFallas('N/A')).toEqual([]);
    expect(migrarCadenaFallas('')).toEqual([]);
    expect(migrarCadenaFallas(null)).toEqual([]);
  });
});

describe('migrarRegistro', () => {
  it('codifica un registro viejo y lo marca como legado', () => {
    const r = migrarRegistro({ id: 1, partnum: 'PN-1', fail: 'Cortocircuito' });
    expect(r.defectCodes.map(d => d.codigo)).toEqual(['CN-12']);
    expect(r.severidad).toBe('A');
    expect(r.catalogo).toBe('legado');
    expect(r.requiereReclasificacion).toBe(false);
  });

  it('marca para reclasificar lo que no se pudo codificar', () => {
    const r = migrarRegistro({ id: 2, partnum: 'PN-2', fail: 'Conector dañado / Roto' });
    expect(r.requiereReclasificacion).toBe(true);
    expect(r.severidad).toBeNull();
  });

  it('nunca reescribe el texto original de la falla', () => {
    const original = 'Conector dañado / Roto';
    expect(migrarRegistro({ id: 3, fail: original }).fail).toBe(original);
  });

  it('migra cada parte por separado', () => {
    const r = migrarRegistro({
      id: 4,
      parts: [
        { partnum: 'A', fail: 'Cortocircuito' },
        { partnum: 'B', fail: 'N/A' },
      ],
    });
    expect(r.parts[0].defectCodes).toHaveLength(1);
    expect(r.parts[1].defectCodes).toHaveLength(0);
  });

  it('es idempotente: no degrada un registro ya codificado', () => {
    const r = migrarRegistro({ id: 5, fail: 'Cortocircuito' });
    expect(migrarRegistro(r)).toBe(r);
  });

  it('no toca un registro capturado bajo el catálogo vigente', () => {
    const nuevo = { id: 6, defectCodes: [crearDefecto('TE', 36)], catalogo: TIS_F0124_SELLO };
    expect(migrarRegistro(nuevo).catalogo).toBe(TIS_F0124_SELLO);
  });

  it('migra colecciones completas', () => {
    expect(migrarRegistros([{ id: 1, fail: 'Cortocircuito' }])[0].defectCodes).toHaveLength(1);
    expect(migrarRegistros([])).toEqual([]);
  });
});

// ── BÚSQUEDA ─────────────────────────────────────────────────────────────

describe('búsqueda del selector', () => {
  it('encuentra por nombre', () => {
    expect(buscarElementos('terminal').map(e => e.code)).toContain('TE');
  });

  it('encuentra por código', () => {
    expect(buscarElementos('pig').map(e => e.code)).toContain('PIG');
  });

  it('ignora acentos', () => {
    expect(buscarElementos('arnes').map(e => e.code)).toContain('AR');
    expect(buscarElementos('árnes').map(e => e.code)).toContain('AR');
  });

  it('encuentra tipos por nombre y por número', () => {
    expect(buscarTipos('roto').map(t => t.num)).toContain(36);
    expect(buscarTipos('36').map(t => t.num)).toContain(36);
  });

  it('devuelve todo con búsqueda vacía', () => {
    expect(buscarElementos('')).toHaveLength(71);
    expect(buscarTipos('  ')).toHaveLength(72);
  });

  it('devuelve vacío sin coincidencias', () => {
    expect(buscarElementos('xyzzy')).toEqual([]);
  });
});

// ── SIN CLASIFICAR ───────────────────────────────────────────────────────

describe('marcador SIN-CLASIFICAR', () => {
  it('no se confunde con un código del catálogo', () => {
    expect(ELEMENTOS.map(e => e.code)).not.toContain(SIN_CLASIFICAR);
    expect(esSinClasificar(crearDefecto('TE', 36))).toBe(false);
  });

  it('se cuenta en su propio cubo, fuera del Pareto', () => {
    const c = contarDefectos([crearDefecto('TE', 36), crearSinClasificar('algo', 'ambiguo')]);
    expect(c.sinClasificar).toBe(1);
    expect(c.totalDefectos).toBe(1);
  });
});
