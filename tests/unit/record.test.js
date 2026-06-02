import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildRecord, getRecordStatus, makeEmptyBlock, blockFailStr, getDefectBreakdown } from '../../src/logic.js';

// Fix Date so id / ts are deterministic in tests
const FIXED_TS = '2026-06-01T10:00:00.000Z';
const FIXED_ID = new Date(FIXED_TS).getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_TS));
});
afterAll(() => {
  vi.useRealTimers();
});

// ── helpers ──────────────────────────────────────────────────────────────

function header(overrides = {}) {
  return {
    cell: '215',
    date: '2026-06-01',
    slot: 'B12',
    client: 'AUTOLIV',
    tester: 'EID3520',
    inspector: 'Juan Perez',
    ...overrides,
  };
}

function part(overrides = {}) {
  return {
    partnum: 'PN-001',
    components: {},
    tests: {},
    fail: 'N/A',
    solution: '',
    defects: {},
    defectDetection: [],
    defectOperator: [],
    ...overrides,
  };
}

// ── buildRecord ──────────────────────────────────────────────────────────

describe('buildRecord', () => {
  it('copies all header fields into the record', () => {
    const rec = buildRecord(header(), [part()]);
    expect(rec.cell).toBe('215');
    expect(rec.date).toBe('2026-06-01');
    expect(rec.slot).toBe('B12');
    expect(rec.client).toBe('AUTOLIV');
    expect(rec.tester).toBe('EID3520');
    expect(rec.inspector).toBe('Juan Perez');
  });

  it('sets fail to N/A when no part has a failure', () => {
    const rec = buildRecord(header(), [part()]);
    expect(rec.fail).toBe('N/A');
  });

  it('uses the part failure string when set', () => {
    const rec = buildRecord(header(), [part({ fail: 'Cortocircuito' })]);
    expect(rec.fail).toBe('Cortocircuito');
  });

  it('joins multiple part failures with " | "', () => {
    const parts = [
      part({ partnum: 'PN-001', fail: 'Cortocircuito' }),
      part({ partnum: 'PN-002', fail: 'Terminal no insertada (Push-back)' }),
    ];
    const rec = buildRecord(header(), parts);
    expect(rec.fail).toContain('Cortocircuito');
    expect(rec.fail).toContain('Terminal no insertada (Push-back)');
    expect(rec.fail).toContain(' | ');
  });

  it('deduplicates identical failure strings across parts', () => {
    const parts = [
      part({ partnum: 'PN-001', fail: 'Cortocircuito' }),
      part({ partnum: 'PN-002', fail: 'Cortocircuito' }),
    ];
    const rec = buildRecord(header(), parts);
    // Should appear only once
    const count = rec.fail.split('Cortocircuito').length - 1;
    expect(count).toBe(1);
  });

  it('sets solution to N/A when no part has a solution', () => {
    const rec = buildRecord(header(), [part()]);
    expect(rec.solution).toBe('N/A');
  });

  it('uses the part solution when set', () => {
    const rec = buildRecord(header(), [part({ fail: 'Cortocircuito', solution: 'Reparado' })]);
    expect(rec.solution).toBe('Reparado');
  });

  it('sets solved=true when fail exists and solution covers it', () => {
    const rec = buildRecord(header(), [part({ fail: 'Cortocircuito', solution: 'Reparado' })]);
    expect(rec.solved).toBe(true);
  });

  it('sets solved=false when fail exists but no solution', () => {
    const rec = buildRecord(header(), [part({ fail: 'Cortocircuito', solution: '' })]);
    expect(rec.solved).toBe(false);
  });

  it('sets solved=false when there is no failure at all', () => {
    const rec = buildRecord(header(), [part()]);
    expect(rec.solved).toBe(false);
  });

  it('joins multiple part numbers with " / "', () => {
    const parts = [part({ partnum: 'PN-001' }), part({ partnum: 'PN-002' })];
    const rec = buildRecord(header(), parts);
    expect(rec.partnum).toBe('PN-001 / PN-002');
  });

  it('includes the parts array unchanged', () => {
    const partsData = [part(), part({ partnum: 'PN-002' })];
    const rec = buildRecord(header(), partsData);
    expect(rec.parts).toBe(partsData);
  });

  it('merges defects from all parts', () => {
    const p1 = part({ defects: { 'Sensor mal calibrado': true } });
    const p2 = part({ defects: { 'Conector mal asentado': true } });
    const rec = buildRecord(header(), [p1, p2]);
    expect(rec.defects['Sensor mal calibrado']).toBe(true);
    expect(rec.defects['Conector mal asentado']).toBe(true);
  });

  it('deduplicates defectDetection across parts', () => {
    const p1 = part({ defectDetection: ['Sensor mal calibrado'] });
    const p2 = part({ defectDetection: ['Sensor mal calibrado'] });
    const rec = buildRecord(header(), [p1, p2]);
    expect(rec.defectDetection).toHaveLength(1);
    expect(rec.defectDetection[0]).toBe('Sensor mal calibrado');
  });

  it('includes a changeHistory with a CREADO entry', () => {
    const rec = buildRecord(header(), [part()]);
    expect(rec.changeHistory).toHaveLength(1);
    expect(rec.changeHistory[0].action).toBe('CREADO');
  });

  it('changeHistory detail mentions the failure when one exists', () => {
    const rec = buildRecord(header(), [part({ fail: 'Cortocircuito' })]);
    expect(rec.changeHistory[0].detail).toContain('Cortocircuito');
  });

  it('changeHistory detail says "sin falla" when no failure', () => {
    const rec = buildRecord(header(), [part()]);
    expect(rec.changeHistory[0].detail).toContain('sin falla');
  });

  it('allows overriding id and ts via overrides', () => {
    const rec = buildRecord(header(), [part()], { id: 42, ts: '2020-01-01T00:00:00.000Z' });
    expect(rec.id).toBe(42);
    expect(rec.ts).toBe('2020-01-01T00:00:00.000Z');
  });
});

// ── getRecordStatus ──────────────────────────────────────────────────────

describe('getRecordStatus', () => {
  it('returns OK for a record with fail=N/A', () => {
    expect(getRecordStatus({ fail: 'N/A', solved: false })).toBe('OK');
  });

  it('returns OK for a record with no fail field', () => {
    expect(getRecordStatus({})).toBe('OK');
  });

  it('returns OK for empty fail string', () => {
    expect(getRecordStatus({ fail: '' })).toBe('OK');
  });

  it('returns OK for whitespace-only fail', () => {
    expect(getRecordStatus({ fail: '   ', solved: false })).toBe('OK');
  });

  it('returns CON FALLA when fail is set and solved=false', () => {
    expect(getRecordStatus({ fail: 'Cortocircuito', solved: false })).toBe('CON FALLA');
  });

  it('returns SOLUCIONADO when fail is set and solved=true', () => {
    expect(getRecordStatus({ fail: 'Cortocircuito', solved: true })).toBe('SOLUCIONADO');
  });

  it('is case-insensitive for "n/a" check', () => {
    expect(getRecordStatus({ fail: 'N/A', solved: false })).toBe('OK');
    expect(getRecordStatus({ fail: 'n/a', solved: false })).toBe('OK');
  });
});
