import { describe, it, expect } from 'vitest';
import {
  COMPONENTS,
  TESTS,
  crearDefecto,
  makeEmptyBlock,
  toggleBlockComp,
  toggleSubtype,
  blockFailStr,
} from '../../src/logic.js';

// ── makeEmptyBlock ──────────────────────────────────────────────────────

describe('makeEmptyBlock', () => {
  it('returns an object with an empty partnum', () => {
    expect(makeEmptyBlock().partnum).toBe('');
  });

  it('returns empty otherFail and solution', () => {
    const b = makeEmptyBlock();
    expect(b.otherFail).toBe('');
    expect(b.solution).toBe('');
  });

  it('initialises compState for every component', () => {
    const { compState } = makeEmptyBlock();
    COMPONENTS.forEach(c => {
      expect(compState).toHaveProperty(c);
      expect(compState[c].yes).toBe(false);
      expect(compState[c].no).toBe(false);
      expect(compState[c].subtypes).toEqual([]);
    });
  });

  it('initialises testState for every test', () => {
    const { testState } = makeEmptyBlock();
    TESTS.forEach(t => {
      expect(testState).toHaveProperty(t);
      expect(testState[t]).toBe(false);
    });
  });

  it('initialises defectCodes as an empty array', () => {
    expect(makeEmptyBlock().defectCodes).toEqual([]);
  });

  it('no longer carries the legacy failState map', () => {
    expect(makeEmptyBlock()).not.toHaveProperty('failState');
  });

  it('initialises defectState as an empty object', () => {
    expect(makeEmptyBlock().defectState).toEqual({});
  });

  it('successive calls return independent objects (no shared state)', () => {
    const a = makeEmptyBlock();
    const b = makeEmptyBlock();
    a.partnum = 'ABC';
    a.compState[COMPONENTS[0]].yes = true;
    expect(b.partnum).toBe('');
    expect(b.compState[COMPONENTS[0]].yes).toBe(false);
  });
});

// ── toggleBlockComp ─────────────────────────────────────────────────────

describe('toggleBlockComp', () => {
  const firstComp = COMPONENTS[0];

  function freshState() {
    return makeEmptyBlock().compState;
  }

  it('sets yes=true when toggling yes on a blank component', () => {
    const cs = freshState();
    toggleBlockComp(cs, firstComp, 'yes');
    expect(cs[firstComp].yes).toBe(true);
  });

  it('setting yes=true clears no', () => {
    const cs = freshState();
    cs[firstComp].no = true;
    toggleBlockComp(cs, firstComp, 'yes');
    expect(cs[firstComp].yes).toBe(true);
    expect(cs[firstComp].no).toBe(false);
  });

  it('setting no=true clears yes', () => {
    const cs = freshState();
    cs[firstComp].yes = true;
    toggleBlockComp(cs, firstComp, 'no');
    expect(cs[firstComp].no).toBe(true);
    expect(cs[firstComp].yes).toBe(false);
  });

  it('toggling yes off clears subtypes', () => {
    const cs = freshState();
    cs[firstComp].yes = true;
    cs[firstComp].subtypes = ['PVC', 'Kapton'];
    toggleBlockComp(cs, firstComp, 'yes'); // now yes=false
    expect(cs[firstComp].subtypes).toEqual([]);
    expect(cs[firstComp].subtype).toBe('');
  });

  it('toggling yes twice returns to original state', () => {
    const cs = freshState();
    toggleBlockComp(cs, firstComp, 'yes');
    toggleBlockComp(cs, firstComp, 'yes');
    expect(cs[firstComp].yes).toBe(false);
  });

  it('does nothing for an unknown component name', () => {
    const cs = freshState();
    expect(() => toggleBlockComp(cs, 'NONEXISTENT', 'yes')).not.toThrow();
  });
});

// ── toggleSubtype ───────────────────────────────────────────────────────

describe('toggleSubtype', () => {
  const comp = COMPONENTS[0]; // 'Cinta (Tape) - Material'
  const sub = 'PVC';

  function freshState() {
    const cs = makeEmptyBlock().compState;
    cs[comp].yes = true;
    return cs;
  }

  it('adds a subtype when not present', () => {
    const cs = freshState();
    toggleSubtype(cs, comp, sub);
    expect(cs[comp].subtypes).toContain(sub);
  });

  it('removes a subtype when already present', () => {
    const cs = freshState();
    cs[comp].subtypes = [sub];
    toggleSubtype(cs, comp, sub);
    expect(cs[comp].subtypes).not.toContain(sub);
  });

  it('can hold multiple subtypes simultaneously', () => {
    const cs = freshState();
    toggleSubtype(cs, comp, 'PVC');
    toggleSubtype(cs, comp, 'Kapton');
    expect(cs[comp].subtypes).toContain('PVC');
    expect(cs[comp].subtypes).toContain('Kapton');
    expect(cs[comp].subtypes).toHaveLength(2);
  });

  it('clears the legacy subtype string after toggle', () => {
    const cs = freshState();
    cs[comp].subtype = 'OldValue'; // backward-compat field
    toggleSubtype(cs, comp, sub);
    expect(cs[comp].subtype).toBe('');
  });

  it('migrates legacy cs.subtype into subtypes array on first call', () => {
    const cs = freshState();
    cs[comp].subtypes = undefined; // simulate old record
    cs[comp].subtype = 'Aluminio';
    toggleSubtype(cs, comp, 'PVC');
    expect(cs[comp].subtypes).toContain('Aluminio');
    expect(cs[comp].subtypes).toContain('PVC');
  });

  it('does nothing for an unknown component', () => {
    const cs = freshState();
    expect(() => toggleSubtype(cs, 'GHOST', 'PVC')).not.toThrow();
  });
});

// ── blockFailStr ────────────────────────────────────────────────────────

describe('blockFailStr', () => {
  function block(overrides = {}) {
    return Object.assign(makeEmptyBlock(), overrides);
  }

  it('returns N/A when no defects are captured', () => {
    expect(blockFailStr(block())).toBe('N/A');
  });

  it('describes a single coded defect', () => {
    const b = block({ defectCodes: [crearDefecto('CN', 12)] });
    expect(blockFailStr(b)).toBe('CN-12 · Continuidad / Corto');
  });

  it('joins multiple defects with " | "', () => {
    const b = block({ defectCodes: [crearDefecto('CN', 12), crearDefecto('TE', 32)] });
    const result = blockFailStr(b);
    expect(result).toContain('CN-12');
    expect(result).toContain('TE-32');
    expect(result).toContain(' | ');
  });

  it('appends "Otro: <text>" for defects outside the catalogue', () => {
    const b = block({ otherFail: 'Falla especial XYZ' });
    expect(blockFailStr(b)).toBe('Otro: Falla especial XYZ');
  });

  it('ignores a blank otherFail', () => {
    expect(blockFailStr(block({ otherFail: '   ' }))).toBe('N/A');
  });

  it('combines coded defects with the free-text field', () => {
    const b = block({ defectCodes: [crearDefecto('CN', 12)], otherFail: 'Vibracion' });
    const result = blockFailStr(b);
    expect(result).toContain('CN-12 · Continuidad / Corto');
    expect(result).toContain('Otro: Vibracion');
  });

  it('tolerates a block with no defectCodes array at all', () => {
    expect(blockFailStr({})).toBe('N/A');
  });
});
