import { describe, it, expect } from 'vitest';
import {
  COMPONENTS,
  TESTS,
  FAILURES,
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

  it('initialises failState for every failure + Otro', () => {
    const { failState } = makeEmptyBlock();
    [...FAILURES, 'Otro'].forEach(f => {
      expect(failState).toHaveProperty(f);
      expect(failState[f]).toBe(false);
    });
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
    const b = makeEmptyBlock();
    return Object.assign(b, overrides);
  }

  it('returns N/A when no failures are selected', () => {
    expect(blockFailStr(block())).toBe('N/A');
  });

  it('returns the single selected failure name', () => {
    const b = block();
    b.failState['Cortocircuito'] = true;
    expect(blockFailStr(b)).toBe('Cortocircuito');
  });

  it('joins multiple failures with ", "', () => {
    const b = block();
    b.failState['Cortocircuito'] = true;
    b.failState['Terminal no insertada (Push-back)'] = true;
    const result = blockFailStr(b);
    expect(result).toContain('Cortocircuito');
    expect(result).toContain('Terminal no insertada (Push-back)');
    expect(result).toContain(', ');
  });

  it('appends "Otro: <text>" when Otro is checked and otherFail is set', () => {
    const b = block({ otherFail: 'Falla especial XYZ' });
    b.failState['Otro'] = true;
    expect(blockFailStr(b)).toBe('Otro: Falla especial XYZ');
  });

  it('appends "Otro" without detail when otherFail is empty', () => {
    const b = block({ otherFail: '' });
    b.failState['Otro'] = true;
    expect(blockFailStr(b)).toBe('Otro');
  });

  it('does not include "Otro" keyword in the regular failure list', () => {
    const b = block();
    b.failState['Cortocircuito'] = true;
    b.failState['Otro'] = false;
    expect(blockFailStr(b)).not.toContain('Otro');
  });

  it('combines regular failures + Otro correctly', () => {
    const b = block({ otherFail: 'Vibracion' });
    b.failState['Cortocircuito'] = true;
    b.failState['Otro'] = true;
    const result = blockFailStr(b);
    expect(result).toContain('Cortocircuito');
    expect(result).toContain('Otro: Vibracion');
  });

  it('handles missing failState gracefully (returns N/A)', () => {
    expect(blockFailStr({ otherFail: '' })).toBe('N/A');
  });
});
