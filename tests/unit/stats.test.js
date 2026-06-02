import { describe, it, expect } from 'vitest';
import { computeHistoryStats } from '../../src/logic.js';

function rec(overrides = {}) {
  return {
    fail: 'N/A',
    solved: false,
    tester: 'EID3520',
    ...overrides,
  };
}

function recWithParts(partnums, overrides = {}) {
  return rec({
    parts: partnums.map(pn => ({ partnum: pn })),
    ...overrides,
  });
}

describe('computeHistoryStats', () => {
  it('returns all zeros for an empty records array', () => {
    expect(computeHistoryStats([])).toEqual({ total: 0, ok: 0, fail: 0, testers: 0 });
  });

  it('counts a single record without parts as total=1', () => {
    const { total } = computeHistoryStats([rec()]);
    expect(total).toBe(1);
  });

  it('uses parts.length for records with a parts array', () => {
    const { total } = computeHistoryStats([recWithParts(['PN-A', 'PN-B', 'PN-C'])]);
    expect(total).toBe(3);
  });

  it('sums parts across multiple records', () => {
    const records = [
      recWithParts(['PN-1', 'PN-2']),
      rec(),
      recWithParts(['PN-3']),
    ];
    expect(computeHistoryStats(records).total).toBe(4);
  });

  it('sets ok = total when no records have active failures', () => {
    const records = [rec(), rec()];
    const { total, ok, fail } = computeHistoryStats(records);
    expect(ok).toBe(total);
    expect(fail).toBe(0);
  });

  it('counts a record with fail≠N/A and solved=false as a failure', () => {
    const records = [rec({ fail: 'Cortocircuito', solved: false })];
    expect(computeHistoryStats(records).fail).toBe(1);
    expect(computeHistoryStats(records).ok).toBe(0);
  });

  it('does NOT count solved records as active failures', () => {
    const records = [rec({ fail: 'Cortocircuito', solved: true })];
    const { fail } = computeHistoryStats(records);
    expect(fail).toBe(0);
  });

  it('multiplies failure count by parts.length for multi-part records', () => {
    const records = [recWithParts(['PN-A', 'PN-B'], { fail: 'Cortocircuito', solved: false })];
    expect(computeHistoryStats(records).fail).toBe(2);
  });

  it('counts distinct testers correctly', () => {
    const records = [
      rec({ tester: 'EID3520' }),
      rec({ tester: 'EID3521' }),
      rec({ tester: 'EID3520' }), // duplicate
    ];
    expect(computeHistoryStats(records).testers).toBe(2);
  });

  it('ok = total - fail invariant always holds', () => {
    const records = [
      rec(),
      rec({ fail: 'Cortocircuito', solved: false }),
      rec({ fail: 'Miswire', solved: true }),
      recWithParts(['PN-A', 'PN-B'], { fail: 'Cortocircuito', solved: false }),
    ];
    const { total, ok, fail } = computeHistoryStats(records);
    expect(ok + fail).toBe(total);
  });

  it('handles records with undefined tester gracefully', () => {
    const records = [rec({ tester: undefined })];
    expect(() => computeHistoryStats(records)).not.toThrow();
  });
});
