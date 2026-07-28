/**
 * Pure business-logic extracted from index.html for testability.
 * No DOM, no Firebase, no side-effects.
 */

import {
  defectosAString,
  severidadMaxima,
  esSinClasificar,
  TIS_F0124_SELLO,
} from './defect-code.js';

export * from './defect-code.js';

// ── DATA ──────────────────────────────────────────────────────────────────

export const COMPONENTS_DICT = {
  'Cinta (Tape) - Material': ['PVC', 'Tela / PET (Cloth)', 'Fleece / PE (Vellón)', 'Aluminio', 'Teflón (PTFE)', 'Mastic', 'Kapton', 'Fibra de Vidrio'],
  'Cinta (Tape) - Aplicación': ['Espiral / Traslape (Half-lap)', 'Punteada (Spot Tape)', 'Continua (Corrida)', 'Longitudinal', 'Espaciada (Open gap)', 'Bandera (Flag)'],
  'Tubo / Cubierta': ['Corrugado Abierto (Slit Loom)', 'Corrugado Cerrado', 'Manga Térmica (Heat Shrink)', 'Tubo PVC', 'Grommet (Pasamuros)'],
  'Protección': ['Malla (Braided Sleeve)', 'Esponja (Foam)', 'Cinta Anti-Ruido (Anti-Rattle)'],
  'Sujeción (Clips/Ties)': ['Clip (Fir Tree/Rosebud)', 'Clip Edge', 'Clip con Corbata', 'Corbata (Cable Tie)', 'Canaleta (Channel)'],
  'Cable': ['Convencional (TXL/FLRY)', 'Par Trenzado', 'Blindado (Shielded)', 'Coaxial', 'Cable de Batería'],
  'Conector': ['Sellado (Sealed)', 'No Sellado', 'Inline (Conector-Conector)', 'Dummy Plug (Tapón)'],
  'Accesorios Conector': ['TPA', 'CPA', 'PLR', 'Backshell / Wire Dress', 'Cavity Plug (Sello ciego)'],
  'Terminal': ['Pin (Macho)', 'Socket (Hembra)', 'Terminal de Ojillo (Tierra)', 'Espada', 'IDC'],
  'Empalme (Splice)': ['Soldadura Ultrasónica', 'Crimp Splice', 'Solder Sleeve'],
  'Componentes Especiales': ['Relay', 'Fusible', 'Diodo / Resistencia', 'Ferrita', 'Inflador (Airbag)', 'Sensor', 'Barcode / QR Code'],
};

export const COMPONENTS = Object.keys(COMPONENTS_DICT);

export const TESTS = [
  'Continuidad Eléctrica',
  'Cortocircuito / Aislamiento',
  'Caída de Tensión',
  'Hipot (Dieléctrico/Alta Tensión)',
  'Push-Pull (Extracción)',
  'Push-Out Force (Empuje Terminal)',
  'Prueba de Fuga (Leak Test)',
  'Verificación Dimensional / Ruteo',
  'Detección de Candados (TPA/CPA)',
  'Detección de Clips / Sujeción',
  'Verificación de Color (Visión)',
  'Presencia de Cinta / Spot Tape',
  'Alineación de Terminal',
  'Escaneo Barcode',
  'Poka-Yoke',
];

/**
 * Catálogo de fallas anterior a TIS-F0124. Ya NO se captura con él: se
 * conserva únicamente para poder migrar y releer los registros históricos.
 * No agregar entradas — el catálogo vigente es TIS-F0124.
 */
export const FALLAS_LEGADO = [
  'Terminal no insertada (Push-back)',
  'Cables invertidos (Miswire)',
  'Circuito abierto / Sin continuidad',
  'Cortocircuito',
  'Falta de componente (Clip, Sello, TPA)',
  'Daño en aislamiento / Cobre expuesto',
  'Conector dañado / Roto',
  'Ruteo incorrecto / Longitud',
  'Encintado defectuoso / Faltante',
  'Terminal dañada / Deformada',
];

export const DEFECT_TYPES = {
  'Defecto de Detección (Tester)': [
    'Falso positivo (marca falla sin haberla)',
    'Falso negativo (no detecta falla real)',
    'Sensor mal calibrado',
    'Fixture/Pinза desgastada',
    'Programa/Software del tester desactualizado',
    'Lectura intermitente',
    'Falla de comunicación del tester',
    'Contacto sucio en fixture',
    'Holder mal alineado / conector no asienta en fixture',
  ],
  'Defecto de Operador': [
    'Montaje incorrecto del arnés',
    'Conector mal asentado',
    'Terminal mal insertada por operador',
    'Componente omitido',
    'Ruteo incorrecto',
    'Escaneo de barcode erróneo',
    'No siguió instrucción de trabajo',
    'Arnés colocado en fixture equivocado',
  ],
};

export const DEFECT_CATEGORIES = Object.keys(DEFECT_TYPES);

// Passwords — same values as in index.html.
export const PASS_ADMIN   = 'REBO1505';
export const PASS_CHECKER = 'CHECKUSER';
export const PASS_VIEWER  = 'TELAMON2026';
export const PASS_PAPOI   = 'PAPOI';

// ── BLOCK FACTORY ────────────────────────────────────────────────────────

export function makeEmptyBlock() {
  const comp = {};
  COMPONENTS.forEach(c => { comp[c] = { yes: false, no: false, subtypes: [] }; });
  const test = {};
  TESTS.forEach(t => { test[t] = false; });
  return {
    partnum: '',
    compState: comp,
    testState: test,
    // Defectos codificados TIS-F0124 — ver src/defect-code.js
    defectCodes: [],
    defectState: {},
    otherFail: '',
    solution: '',
  };
}

// ── TOGGLE HELPERS ───────────────────────────────────────────────────────

/**
 * Toggle a SÍ/NO component state.
 * Mutates compState[name] in place; returns nothing.
 */
export function toggleBlockComp(compState, name, key) {
  const cs = compState[name];
  if (!cs) return;
  cs[key] = !cs[key];
  if (key === 'yes' && cs.yes) cs.no = false;
  if (key === 'no'  && cs.no)  cs.yes = false;
  if (!cs.yes) { cs.subtype = ''; cs.subtypes = []; }
}

/**
 * Toggle a subtype pill inside a component.
 * Mutates compState[name].subtypes in place; returns nothing.
 */
export function toggleSubtype(compState, name, val) {
  const cs = compState[name];
  if (!cs) return;
  if (!cs.subtypes) cs.subtypes = cs.subtype ? [cs.subtype] : [];
  if (cs.subtypes.includes(val)) cs.subtypes = cs.subtypes.filter(s => s !== val);
  else cs.subtypes.push(val);
  cs.subtype = '';
}

// ── DEFECT HELPERS ───────────────────────────────────────────────────────

/**
 * Split a flat defects map into {detection, operator} arrays.
 */
export function getDefectBreakdown(defectsObj) {
  const det = [], op = [];
  if (!defectsObj) return { detection: det, operator: op };
  DEFECT_TYPES['Defecto de Detección (Tester)'].forEach(s => { if (defectsObj[s]) det.push(s); });
  DEFECT_TYPES['Defecto de Operador'].forEach(s => { if (defectsObj[s]) op.push(s); });
  return { detection: det, operator: op };
}

// ── FAILURE STRING ───────────────────────────────────────────────────────

/**
 * Build the human-readable failure string for a single part block.
 * Los defectos vienen ya codificados TIS-F0124; `otherFail` cubre lo que
 * todavía no existe en el catálogo (el documento pide solicitar su alta).
 */
export function blockFailStr(b) {
  return defectosAString((b && b.defectCodes) || [], (b && b.otherFail) || '');
}

// ── FORM VALIDATION ──────────────────────────────────────────────────────

/**
 * Validate the required header fields and at least one part block.
 * Returns an error message string on failure, or null when valid.
 */
export function validateFormInputs({ cell, date, partBlocks, tester }) {
  const validBlocks = (partBlocks || []).filter(b => b.partnum.trim() !== '');
  if (!cell || !date || !tester || validBlocks.length === 0) {
    return 'Llena Cell, Fecha, al menos un Part Number y Tester';
  }
  const formPNs = validBlocks.map(b => b.partnum.trim().toLowerCase());
  if (new Set(formPNs).size !== formPNs.length) {
    return 'Hay Part Numbers duplicados en el formulario';
  }
  return null;
}

/**
 * Check whether any block's partnum already exists in the record history.
 * Returns the first conflicting partnum string, or null when clean.
 */
export function checkPartNumberDuplicatesInHistory(partBlocks, records) {
  const validBlocks = partBlocks.filter(b => b.partnum.trim() !== '');
  for (const b of validBlocks) {
    const pnLower = b.partnum.trim().toLowerCase();
    const exists = records.some(r => {
      if (r.parts) return r.parts.some(p => p.partnum.toLowerCase() === pnLower);
      return r.partnum && r.partnum.toLowerCase() === pnLower;
    });
    if (exists) return b.partnum.trim();
  }
  return null;
}

// ── RECORD BUILDER ───────────────────────────────────────────────────────

/**
 * Construct the record object from header fields + per-part data.
 * Purely deterministic; does not call Date.now() directly so tests can
 * control the `id` by passing it via overrides.
 *
 * @param {object} header  - { cell, date, slot, client, tester, inspector }
 * @param {Array}  partsData - array of per-part objects built by submitForm
 * @param {object} [overrides] - optional fields to merge (e.g. { id, ts })
 */
export function buildRecord(header, partsData, overrides = {}) {
  const { cell, date, slot, client, tester, inspector } = header;

  const allFails = partsData.map(p => p.fail).filter(f => f && f !== 'N/A');
  const fail = allFails.length > 0 ? [...new Set(allFails)].join(' | ') : 'N/A';

  const allSolutions = partsData
    .map(p => p.solution)
    .filter(s => s && s.toLowerCase() !== 'n/a' && s !== '');
  const solution = allSolutions.length > 0 ? [...new Set(allSolutions)].join(' | ') : 'N/A';

  const allDet = [...new Set(partsData.flatMap(p => p.defectDetection || []))];
  const allOp  = [...new Set(partsData.flatMap(p => p.defectOperator  || []))];

  // Defectos codificados de todas las partes, deduplicados por código.
  const allCodes = [];
  const seenCodes = new Set();
  partsData.forEach(p => {
    (p.defectCodes || []).forEach(d => {
      if (!d) return;
      const k = esSinClasificar(d) ? `SC:${d.textoOriginal || ''}` : `${d.codigo}|${d.sev}`;
      if (seenCodes.has(k)) return;
      seenCodes.add(k);
      allCodes.push(d);
    });
  });
  const severidad = severidadMaxima(allCodes);
  const requiereReclasificacion = allCodes.some(esSinClasificar);

  const combinedDefects = {};
  partsData.forEach(p => {
    Object.keys(p.defects || {}).forEach(k => { if (p.defects[k]) combinedDefects[k] = true; });
  });

  const isSolved = fail !== 'N/A' && allSolutions.length >= allFails.length && allFails.length > 0;

  return {
    id: Date.now(),
    cell, date, slot, client, tester, inspector,
    fail, solution,
    solved: isSolved,
    defects: combinedDefects,
    defectDetection: allDet,
    defectOperator: allOp,
    // ── TIS-F0124 ──
    defectCodes: allCodes,
    severidad,
    requiereReclasificacion,
    catalogo: TIS_F0124_SELLO,
    partnum: partsData.map(p => p.partnum).join(' / '),
    parts: partsData,
    ts: new Date().toISOString(),
    changeHistory: [{
      date: new Date().toLocaleString('es-MX'),
      action: 'CREADO',
      detail: fail && fail.toLowerCase() !== 'n/a'
        ? 'Registro creado con falla: ' + fail
        : 'Registro creado sin falla',
    }],
    ...overrides,
  };
}

// ── STATUS HELPERS ───────────────────────────────────────────────────────

/**
 * Derive the display status for a record.
 * Returns 'OK' | 'CON FALLA' | 'SOLUCIONADO'.
 */
export function getRecordStatus(record) {
  const hasFail =
    record.fail &&
    record.fail.toLowerCase() !== 'n/a' &&
    record.fail.trim() !== '';
  if (hasFail && !record.solved) return 'CON FALLA';
  if (hasFail && record.solved)  return 'SOLUCIONADO';
  return 'OK';
}

// ── HISTORY STATS ────────────────────────────────────────────────────────

/**
 * Compute the dashboard statistics shown in the history view.
 * Returns { total, ok, fail, testers }.
 *   total  — sum of part-number count across all records
 *   ok     — total - fail
 *   fail   — part-numbers with an active (unsolved) failure
 *   testers — distinct tester IDs
 */
export function computeHistoryStats(records) {
  const total = records.reduce((acc, r) => acc + (r.parts ? r.parts.length : 1), 0);
  const withFail = records.reduce((acc, r) => {
    const hasFail =
      r.fail &&
      r.fail.toLowerCase() !== 'n/a' &&
      r.fail.trim() !== '' &&
      !r.solved;
    return acc + ((r.parts ? r.parts.length : 1) * (hasFail ? 1 : 0));
  }, 0);
  // Severidad del registro = la peor de sus defectos. Un registro ya
  // solucionado sigue contando para el histórico de severidad: lo que se
  // corrigió no borra que ocurrió.
  const severidad = { A: 0, B: 0, C: 0 };
  let sinClasificar = 0;
  records.forEach(r => {
    if (r.severidad && severidad[r.severidad] !== undefined) severidad[r.severidad]++;
    if (r.requiereReclasificacion) sinClasificar++;
  });

  return {
    total,
    ok: total - withFail,
    fail: withFail,
    testers: new Set(records.map(r => r.tester)).size,
    severidad,
    sinClasificar,
  };
}

// ── AUTH ─────────────────────────────────────────────────────────────────

/**
 * Map a plaintext password to a role string.
 * Returns null for an unrecognised password.
 */
export function applyRoleLogic(password) {
  if (password === PASS_ADMIN)   return 'admin';
  if (password === PASS_CHECKER) return 'checker';
  if (password === PASS_PAPOI)   return 'papoi';
  if (password === PASS_VIEWER)  return 'viewer';
  return null;
}
