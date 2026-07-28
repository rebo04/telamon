/**
 * index.html embebe una copia del motor TIS-F0124 porque es un PWA de un
 * solo archivo que opera offline en el iPad.
 *
 * Ese es el riesgo obvio: que la copia y src/ digan cosas distintas y que en
 * piso se clasifique distinto que en los reportes. Esta prueba lo impide.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = readFileSync(join(REPO, 'index.html'), 'utf8');

const BLOQUE = /\/\/ <<< TIS-F0124 AUTOGENERADO[\s\S]*?\/\/ >>> TIS-F0124 FIN AUTOGENERADO/;

describe('motor inline en index.html', () => {
  it('existe el bloque autogenerado', () => {
    expect(BLOQUE.test(HTML)).toBe(true);
  });

  it('está sincronizado con src/ (si falla: python3 tools/sync-inline.py)', () => {
    // El script es la autoridad: compara y sale con código 1 si difieren.
    expect(() =>
      execFileSync('python3', [join(REPO, 'tools', 'sync-inline.py'), '--check'], {
        cwd: REPO,
        stdio: 'pipe',
      })
    ).not.toThrow();
  });

  it('el catálogo inline coincide con el de src/ elemento por elemento', async () => {
    const src = await import('../../src/tis-f0124.js');
    const inline = new Function(HTML.match(BLOQUE)[0] + '\nreturn { ELEMENTOS, TIPOS, ANCLAJES_DOC, TIS_F0124_SELLO };')();

    expect(inline.ELEMENTOS).toEqual(src.ELEMENTOS);
    expect(inline.TIPOS).toEqual(src.TIPOS);
    expect(inline.ANCLAJES_DOC).toEqual(src.ANCLAJES_DOC);
    expect(inline.TIS_F0124_SELLO).toBe(src.TIS_F0124_SELLO);
  });

  it('el motor inline resuelve la severidad igual que src/', async () => {
    const src = await import('../../src/defect-code.js');
    const inline = new Function(HTML.match(BLOQUE)[0] + '\nreturn { resolverSeveridad, ELEMENTOS, TIPOS };')();

    // Las 5,112 combinaciones, no una muestra: es la tabla que decide
    // contención en piso.
    inline.ELEMENTOS.forEach(e => {
      inline.TIPOS.forEach(t => {
        expect(inline.resolverSeveridad(e.code, t.num))
          .toEqual(src.resolverSeveridad(e.code, t.num));
      });
    });
  });

  it('index.html ya no usa el catálogo de fallas anterior para capturar', () => {
    // FALLAS_LEGADO sigue existiendo (se necesita para leer el historial),
    // pero no debe quedar rastro del estado de captura viejo.
    expect(HTML).not.toMatch(/\bfailState\b/);
    expect(HTML).not.toMatch(/\bconst FAILURES\b/);
  });
});
