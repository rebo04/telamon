import { describe, it, expect } from 'vitest';
import { getDefectBreakdown, DEFECT_TYPES } from '../../src/logic.js';

describe('getDefectBreakdown', () => {
  it('returns empty arrays for null input', () => {
    expect(getDefectBreakdown(null)).toEqual({ detection: [], operator: [] });
  });

  it('returns empty arrays for undefined input', () => {
    expect(getDefectBreakdown(undefined)).toEqual({ detection: [], operator: [] });
  });

  it('returns empty arrays for empty object', () => {
    expect(getDefectBreakdown({})).toEqual({ detection: [], operator: [] });
  });

  it('correctly categorises a detection defect', () => {
    const defects = { 'Falso positivo (marca falla sin haberla)': true };
    const { detection, operator } = getDefectBreakdown(defects);
    expect(detection).toContain('Falso positivo (marca falla sin haberla)');
    expect(operator).toHaveLength(0);
  });

  it('correctly categorises an operator defect', () => {
    const defects = { 'Montaje incorrecto del arnés': true };
    const { detection, operator } = getDefectBreakdown(defects);
    expect(operator).toContain('Montaje incorrecto del arnés');
    expect(detection).toHaveLength(0);
  });

  it('handles mixed defects across both categories', () => {
    const defects = {
      'Sensor mal calibrado': true,
      'Conector mal asentado': true,
    };
    const { detection, operator } = getDefectBreakdown(defects);
    expect(detection).toContain('Sensor mal calibrado');
    expect(operator).toContain('Conector mal asentado');
  });

  it('ignores false-valued entries', () => {
    const defects = {
      'Sensor mal calibrado': true,
      'Falso negativo (no detecta falla real)': false,
    };
    const { detection } = getDefectBreakdown(defects);
    expect(detection).toContain('Sensor mal calibrado');
    expect(detection).not.toContain('Falso negativo (no detecta falla real)');
  });

  it('captures all detection defects when all are true', () => {
    const allDet = {};
    DEFECT_TYPES['Defecto de Detección (Tester)'].forEach(s => { allDet[s] = true; });
    const { detection } = getDefectBreakdown(allDet);
    expect(detection).toHaveLength(DEFECT_TYPES['Defecto de Detección (Tester)'].length);
  });

  it('captures all operator defects when all are true', () => {
    const allOp = {};
    DEFECT_TYPES['Defecto de Operador'].forEach(s => { allOp[s] = true; });
    const { operator } = getDefectBreakdown(allOp);
    expect(operator).toHaveLength(DEFECT_TYPES['Defecto de Operador'].length);
  });

  it('ignores keys that do not belong to either category', () => {
    const defects = { 'UNKNOWN_DEFECT': true };
    const { detection, operator } = getDefectBreakdown(defects);
    expect(detection).toHaveLength(0);
    expect(operator).toHaveLength(0);
  });

  it('preserves insertion order from DEFECT_TYPES arrays', () => {
    const defects = {
      'Lectura intermitente': true,
      'Sensor mal calibrado': true,
    };
    const { detection } = getDefectBreakdown(defects);
    // Sensor comes before Lectura in DEFECT_TYPES
    expect(detection.indexOf('Sensor mal calibrado')).toBeLessThan(
      detection.indexOf('Lectura intermitente')
    );
  });
});
