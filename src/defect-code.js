/**
 * Motor de codificación de defectos TIS-F0124.
 *
 * Lógica pura: sin DOM, sin Firebase, sin efectos secundarios.
 * El catálogo (elementos, tipos, anclajes) se genera del documento
 * controlado — ver src/tis-f0124.js y tools/gen-catalog.py.
 */

import {
  ELEMENTOS,
  TIPOS,
  SEVERIDADES,
  ANCLAJES_DOC,
  MATRIZ_SEVERIDAD,
  SEVERIDAD_DEFAULT,
  LEGADO_DETERMINISTA,
  LEGADO_AMBIGUO,
  TIS_F0124_SELLO,
} from './tis-f0124.js';

export {
  ELEMENTOS,
  TIPOS,
  SEVERIDADES,
  ANCLAJES_DOC,
  MATRIZ_SEVERIDAD,
  LEGADO_DETERMINISTA,
  LEGADO_AMBIGUO,
  TIS_F0124_SELLO,
};

// Código reservado para registros migrados cuya etiqueta original no
// determina una única entrada del catálogo. NO es un código del documento.
export const SIN_CLASIFICAR = 'SIN-CLASIFICAR';

const ELEM_POR_CODE = new Map(ELEMENTOS.map(e => [e.code, e]));
const TIPO_POR_NUM = new Map(TIPOS.map(t => [t.num, t]));

/** Orden de gravedad, de mayor a menor. */
export const ORDEN_SEVERIDAD = ['A', 'B', 'C'];

// ── LOOKUP ────────────────────────────────────────────────────────────────

export function getElemento(code) {
  return ELEM_POR_CODE.get(code) || null;
}

export function getTipo(num) {
  return TIPO_POR_NUM.get(Number(num)) || null;
}

/**
 * ¿El par existe en el catálogo? Un código inventado nunca debe persistirse.
 */
export function esCodigoValido(el, tipo) {
  return ELEM_POR_CODE.has(el) && TIPO_POR_NUM.has(Number(tipo));
}

// ── FORMATO ───────────────────────────────────────────────────────────────

/**
 * Código corto, el que se lee en piso y se filtra en Excel. Ej. 'TE-36'.
 */
export function formatCodigo(el, tipo) {
  return `${el}-${tipo}`;
}

/**
 * Descripción legible. Ej. 'TE-36 · Terminal / Roto'.
 */
export function describirCodigo(el, tipo) {
  const e = getElemento(el);
  const t = getTipo(tipo);
  if (!e || !t) return formatCodigo(el, tipo);
  return `${formatCodigo(el, tipo)} · ${e.nombre} / ${t.nombre}`;
}

/**
 * Parsea 'TE-36' → { el:'TE', tipo:36 }. Devuelve null si no es válido.
 * Tolera minúsculas y espacios porque también se usa al importar JSON.
 */
export function parseCodigo(str) {
  const m = /^\s*([A-Za-z]{2,3})\s*-\s*(\d{1,2})\s*$/.exec(String(str || ''));
  if (!m) return null;
  const el = m[1].toUpperCase();
  const tipo = Number(m[2]);
  return esCodigoValido(el, tipo) ? { el, tipo } : null;
}

// ── SEVERIDAD ─────────────────────────────────────────────────────────────

/**
 * Resuelve la severidad de un par elemento/tipo y —esto es lo importante
 * para auditoría— DE DÓNDE salió.
 *
 * Precedencia:
 *   1. 'doc'     anclaje textual de la hoja SEVERIDAD del documento
 *   2. 'matriz'  clase de elemento × clase de tipo
 *   3. 'default' red de seguridad, nunca debería alcanzarse
 *
 * Los tipos de clase DISP (disposición de material, error de prueba) no
 * son no-conformidades del producto: no llevan severidad.
 *
 * @returns {{sev: string|null, fuente: string, cita: string}}
 */
export function resolverSeveridad(el, tipo) {
  const e = getElemento(el);
  const t = getTipo(tipo);

  if (!e || !t) {
    return { sev: null, fuente: 'invalido', cita: 'Código fuera de catálogo' };
  }

  if (t.clase === 'DISP') {
    return {
      sev: null,
      fuente: 'disposicion',
      cita: 'Razón de disposición de material o error de prueba — no es una '
          + 'no-conformidad del producto',
    };
  }

  const anclaje = ANCLAJES_DOC[formatCodigo(el, tipo)];
  if (anclaje) {
    return { sev: anclaje.sev, fuente: 'doc', cita: anclaje.cita };
  }

  const fila = MATRIZ_SEVERIDAD[e.clase];
  const sev = fila && fila[t.clase];
  if (sev) {
    return {
      sev,
      fuente: 'matriz',
      cita: `Elemento ${e.clase} × tipo ${t.clase}`,
    };
  }

  return {
    sev: SEVERIDAD_DEFAULT,
    fuente: 'default',
    cita: 'Sin regla aplicable — se asume el caso conservador',
  };
}

/** Atajo cuando sólo interesa la letra. */
export function severidadDe(el, tipo) {
  return resolverSeveridad(el, tipo).sev;
}

/**
 * ¿Es una disposición de material en vez de un defecto del producto?
 * Se usa para excluirla de los KPI y del Pareto de defectos.
 */
export function esDisposicion(tipo) {
  const t = getTipo(tipo);
  return !!t && t.clase === 'DISP';
}

// ── CONSTRUCCIÓN DE DEFECTOS ──────────────────────────────────────────────

/**
 * Construye el objeto que se persiste por cada defecto capturado.
 *
 * `sevManual` sólo se guarda cuando el inspector cambió la severidad
 * sugerida: así el registro conserva tanto lo que el sistema propuso como
 * la decisión humana que lo sobrescribió.
 */
export function crearDefecto(el, tipo, sevManual = null) {
  if (!esCodigoValido(el, tipo)) return null;
  const n = Number(tipo);
  const r = resolverSeveridad(el, n);
  const d = {
    el,
    tipo: n,
    codigo: formatCodigo(el, n),
    sevAuto: r.sev,
    sevFuente: r.fuente,
    sevCita: r.cita,
    sev: r.sev,
  };
  if (sevManual && sevManual !== r.sev && ORDEN_SEVERIDAD.includes(sevManual)) {
    d.sev = sevManual;
    d.sevManual = sevManual;
  }
  return d;
}

/**
 * Marcador para registros migrados que no se pudieron codificar sin inventar
 * datos. Conserva el texto original íntegro.
 */
export function crearSinClasificar(textoOriginal, motivo) {
  return {
    el: SIN_CLASIFICAR,
    tipo: null,
    codigo: SIN_CLASIFICAR,
    sev: null,
    sevAuto: null,
    sevFuente: 'sin-clasificar',
    sevCita: motivo || 'Requiere reclasificación por el inspector',
    textoOriginal: textoOriginal || '',
  };
}

export function esSinClasificar(d) {
  return !!d && d.el === SIN_CLASIFICAR;
}

// ── AGREGACIÓN ────────────────────────────────────────────────────────────

/**
 * Severidad de un conjunto de defectos = la peor presente.
 * Devuelve null si no hay ninguna severidad asignable.
 */
export function severidadMaxima(defectos) {
  let peor = null;
  (defectos || []).forEach(d => {
    if (!d || !d.sev) return;
    if (peor === null || ORDEN_SEVERIDAD.indexOf(d.sev) < ORDEN_SEVERIDAD.indexOf(peor)) {
      peor = d.sev;
    }
  });
  return peor;
}

/**
 * Cadena legible de todos los defectos de un bloque, la que alimenta el
 * campo `fail` que ya consumen el historial, el estatus y el Excel.
 */
export function defectosAString(defectos, otro = '') {
  const partes = (defectos || []).map(d => {
    if (esSinClasificar(d)) {
      return d.textoOriginal
        ? `${SIN_CLASIFICAR}: ${d.textoOriginal}`
        : SIN_CLASIFICAR;
    }
    return describirCodigo(d.el, d.tipo);
  });
  const ov = String(otro || '').trim();
  if (ov) partes.push(`Otro: ${ov}`);
  return partes.length ? partes.join(' | ') : 'N/A';
}

/**
 * Conteo para Pareto. Separa lo que NO debe contaminar el KPI de defectos:
 * disposiciones de material y registros sin clasificar van en su propio cubo.
 *
 * @returns {{defectos: object, disposiciones: object, sinClasificar: number,
 *            porSeveridad: object, totalDefectos: number}}
 */
export function contarDefectos(listas) {
  const defectos = {};
  const disposiciones = {};
  const porSeveridad = { A: 0, B: 0, C: 0 };
  let sinClasificar = 0;
  let totalDefectos = 0;

  (listas || []).forEach(d => {
    if (!d) return;
    if (esSinClasificar(d)) { sinClasificar++; return; }
    const etiqueta = describirCodigo(d.el, d.tipo);
    if (esDisposicion(d.tipo)) {
      disposiciones[etiqueta] = (disposiciones[etiqueta] || 0) + 1;
      return;
    }
    defectos[etiqueta] = (defectos[etiqueta] || 0) + 1;
    totalDefectos++;
    if (d.sev && porSeveridad[d.sev] !== undefined) porSeveridad[d.sev]++;
  });

  return { defectos, disposiciones, sinClasificar, porSeveridad, totalDefectos };
}

// ── MIGRACIÓN DEL CATÁLOGO LEGADO ─────────────────────────────────────────

/**
 * Traduce una etiqueta de falla del catálogo viejo.
 *
 * Sólo auto-mapea cuando la etiqueta determina elemento Y tipo a una única
 * entrada. Todo lo demás devuelve un marcador SIN-CLASIFICAR con el texto
 * original: una migración no inventa datos que el registro nunca contuvo.
 */
export function migrarFallaLegado(etiqueta) {
  const clave = String(etiqueta || '').trim();
  if (!clave) return null;

  const det = LEGADO_DETERMINISTA[clave];
  if (det) return crearDefecto(det.el, det.tipo);

  const motivo = LEGADO_AMBIGUO[clave];
  if (motivo) return crearSinClasificar(clave, motivo);

  // Texto libre ("Otro: …") o etiqueta desconocida.
  return crearSinClasificar(clave, 'Etiqueta fuera del catálogo legado');
}

/**
 * Migra la cadena `fail` completa de un registro histórico.
 * Acepta los separadores que usó la app: ' | ' entre partes y ', ' dentro.
 */
export function migrarCadenaFallas(fail) {
  const s = String(fail || '').trim();
  if (!s || s.toLowerCase() === 'n/a') return [];
  return s
    .split(/\s*\|\s*/)
    .flatMap(seg => (/^Otro:/i.test(seg) ? [seg] : seg.split(/\s*,\s*/)))
    .map(x => x.trim())
    .filter(Boolean)
    .map(migrarFallaLegado)
    .filter(Boolean);
}

// ── MIGRACIÓN DE REGISTROS HISTÓRICOS ────────────────────────────────────

/**
 * Codifica un registro creado antes de TIS-F0124.
 *
 * Es idempotente: un registro ya codificado se devuelve intacto, de modo que
 * puede correr en cada arranque de la app sin degradar los datos.
 *
 * No reescribe `fail`: el texto original del registro se conserva tal cual
 * quedó capturado. Los códigos se AGREGAN. Un registro migrado nunca se
 * confunde con uno capturado bajo el catálogo vigente, porque lleva
 * `catalogo: 'legado'` y, si hubo ambigüedad, `requiereReclasificacion`.
 */
export function migrarRegistro(record) {
  if (!record || Array.isArray(record.defectCodes)) return record;

  const partes = (record.parts && record.parts.length)
    ? record.parts
    : [{ partnum: record.partnum || '', fail: record.fail }];

  const migratedParts = partes.map(p => ({
    ...p,
    defectCodes: Array.isArray(p.defectCodes)
      ? p.defectCodes
      : migrarCadenaFallas(p.fail),
  }));

  const allCodes = migratedParts.flatMap(p => p.defectCodes);

  return {
    ...record,
    parts: (record.parts && record.parts.length) ? migratedParts : record.parts,
    defectCodes: allCodes,
    severidad: severidadMaxima(allCodes),
    requiereReclasificacion: allCodes.some(esSinClasificar),
    catalogo: 'legado',
  };
}

/** Aplica la migración a una colección completa. */
export function migrarRegistros(records) {
  return (records || []).map(migrarRegistro);
}

// ── BÚSQUEDA (alimenta el selector del formulario) ────────────────────────

function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function buscarElementos(q) {
  const f = fold(q).trim();
  if (!f) return ELEMENTOS;
  return ELEMENTOS.filter(e => e.buscar.includes(f));
}

export function buscarTipos(q) {
  const f = fold(q).trim();
  if (!f) return TIPOS;
  return TIPOS.filter(t => t.buscar.includes(f));
}
