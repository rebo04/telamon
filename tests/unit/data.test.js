import { describe, it, expect } from 'vitest';
import {
  COMPONENTS_DICT,
  COMPONENTS,
  TESTS,
  FAILURES,
  DEFECT_TYPES,
  DEFECT_CATEGORIES,
} from '../../src/logic.js';

describe('COMPONENTS_DICT', () => {
  it('has exactly 11 categories', () => {
    expect(Object.keys(COMPONENTS_DICT)).toHaveLength(11);
  });

  it('every category has at least one subtype', () => {
    Object.values(COMPONENTS_DICT).forEach(subs => {
      expect(subs.length).toBeGreaterThan(0);
    });
  });

  it('contains the expected categories', () => {
    const cats = Object.keys(COMPONENTS_DICT);
    expect(cats).toContain('Cinta (Tape) - Material');
    expect(cats).toContain('Cable');
    expect(cats).toContain('Conector');
    expect(cats).toContain('Terminal');
    expect(cats).toContain('Empalme (Splice)');
    expect(cats).toContain('Componentes Especiales');
  });

  it('Cable category has Coaxial and Blindado subtypes', () => {
    expect(COMPONENTS_DICT['Cable']).toContain('Coaxial');
    expect(COMPONENTS_DICT['Cable']).toContain('Blindado (Shielded)');
  });

  it('Conector category has Sellado and No Sellado subtypes', () => {
    expect(COMPONENTS_DICT['Conector']).toContain('Sellado (Sealed)');
    expect(COMPONENTS_DICT['Conector']).toContain('No Sellado');
  });
});

describe('COMPONENTS', () => {
  it('is the key array of COMPONENTS_DICT', () => {
    expect(COMPONENTS).toEqual(Object.keys(COMPONENTS_DICT));
  });

  it('has 11 entries', () => {
    expect(COMPONENTS).toHaveLength(11);
  });

  it('every entry exists in COMPONENTS_DICT', () => {
    COMPONENTS.forEach(c => {
      expect(COMPONENTS_DICT).toHaveProperty(c);
    });
  });
});

describe('TESTS', () => {
  it('has exactly 15 entries', () => {
    expect(TESTS).toHaveLength(15);
  });

  it('starts with Continuidad Eléctrica', () => {
    expect(TESTS[0]).toBe('Continuidad Eléctrica');
  });

  it('ends with Poka-Yoke', () => {
    expect(TESTS[TESTS.length - 1]).toBe('Poka-Yoke');
  });

  it('contains key electrical tests', () => {
    expect(TESTS).toContain('Cortocircuito / Aislamiento');
    expect(TESTS).toContain('Hipot (Dieléctrico/Alta Tensión)');
    expect(TESTS).toContain('Caída de Tensión');
  });

  it('contains traceability test', () => {
    expect(TESTS).toContain('Escaneo Barcode');
  });

  it('has no duplicate entries', () => {
    expect(new Set(TESTS).size).toBe(TESTS.length);
  });
});

describe('FAILURES', () => {
  it('has exactly 10 entries', () => {
    expect(FAILURES).toHaveLength(10);
  });

  it('starts with Terminal no insertada', () => {
    expect(FAILURES[0]).toBe('Terminal no insertada (Push-back)');
  });

  it('contains Miswire entry', () => {
    expect(FAILURES).toContain('Cables invertidos (Miswire)');
  });

  it('contains Cortocircuito', () => {
    expect(FAILURES).toContain('Cortocircuito');
  });

  it('has no duplicate entries', () => {
    expect(new Set(FAILURES).size).toBe(FAILURES.length);
  });
});

describe('DEFECT_TYPES', () => {
  it('has exactly 2 top-level categories', () => {
    expect(Object.keys(DEFECT_TYPES)).toHaveLength(2);
  });

  it('contains the Detección category', () => {
    expect(DEFECT_TYPES).toHaveProperty('Defecto de Detección (Tester)');
  });

  it('contains the Operador category', () => {
    expect(DEFECT_TYPES).toHaveProperty('Defecto de Operador');
  });

  it('Detección category has 8 entries', () => {
    expect(DEFECT_TYPES['Defecto de Detección (Tester)']).toHaveLength(8);
  });

  it('Operador category has 8 entries', () => {
    expect(DEFECT_TYPES['Defecto de Operador']).toHaveLength(8);
  });

  it('Detección category contains Falso positivo', () => {
    expect(DEFECT_TYPES['Defecto de Detección (Tester)']).toContain(
      'Falso positivo (marca falla sin haberla)'
    );
  });

  it('Operador category contains Montaje incorrecto', () => {
    expect(DEFECT_TYPES['Defecto de Operador']).toContain('Montaje incorrecto del arnés');
  });
});

describe('DEFECT_CATEGORIES', () => {
  it('is the key array of DEFECT_TYPES', () => {
    expect(DEFECT_CATEGORIES).toEqual(Object.keys(DEFECT_TYPES));
  });

  it('has 2 entries', () => {
    expect(DEFECT_CATEGORIES).toHaveLength(2);
  });
});
