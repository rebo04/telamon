import { describe, it, expect } from 'vitest';
import { validateFormInputs, checkPartNumberDuplicatesInHistory, makeEmptyBlock } from '../../src/logic.js';

// ── validateFormInputs ──────────────────────────────────────────────────

function validBlock(partnum = 'PN-001') {
  const b = makeEmptyBlock();
  b.partnum = partnum;
  return b;
}

function validInput(overrides = {}) {
  return {
    cell: '215',
    date: '2026-06-01',
    tester: 'EID3520',
    partBlocks: [validBlock()],
    ...overrides,
  };
}

describe('validateFormInputs', () => {
  it('returns null (valid) when all required fields are present', () => {
    expect(validateFormInputs(validInput())).toBeNull();
  });

  it('returns error when cell is missing', () => {
    expect(validateFormInputs(validInput({ cell: '' }))).toBeTruthy();
  });

  it('returns error when cell is undefined', () => {
    expect(validateFormInputs(validInput({ cell: undefined }))).toBeTruthy();
  });

  it('returns error when date is missing', () => {
    expect(validateFormInputs(validInput({ date: '' }))).toBeTruthy();
  });

  it('returns error when tester is missing', () => {
    expect(validateFormInputs(validInput({ tester: '' }))).toBeTruthy();
  });

  it('returns error when all partBlocks have empty partnum', () => {
    const b = makeEmptyBlock(); // partnum = ''
    expect(validateFormInputs(validInput({ partBlocks: [b] }))).toBeTruthy();
  });

  it('returns error when partBlocks array is empty', () => {
    expect(validateFormInputs(validInput({ partBlocks: [] }))).toBeTruthy();
  });

  it('returns error when partBlocks is undefined', () => {
    expect(validateFormInputs(validInput({ partBlocks: undefined }))).toBeTruthy();
  });

  it('ignores blocks with empty partnum when checking count', () => {
    const emptyBlock = makeEmptyBlock();
    const filledBlock = validBlock('PN-ABC');
    const result = validateFormInputs(validInput({ partBlocks: [emptyBlock, filledBlock] }));
    expect(result).toBeNull();
  });

  it('returns error message for duplicate part numbers in the form', () => {
    const blocks = [validBlock('PN-001'), validBlock('PN-001')];
    const error = validateFormInputs(validInput({ partBlocks: blocks }));
    expect(error).toBeTruthy();
    expect(error).toContain('duplicados');
  });

  it('duplicate check is case-insensitive', () => {
    const blocks = [validBlock('pn-001'), validBlock('PN-001')];
    const error = validateFormInputs(validInput({ partBlocks: blocks }));
    expect(error).toBeTruthy();
  });

  it('allows two different part numbers', () => {
    const blocks = [validBlock('PN-001'), validBlock('PN-002')];
    expect(validateFormInputs(validInput({ partBlocks: blocks }))).toBeNull();
  });

  it('returns a string (not boolean) error', () => {
    const error = validateFormInputs(validInput({ cell: '' }));
    expect(typeof error).toBe('string');
  });
});

// ── checkPartNumberDuplicatesInHistory ──────────────────────────────────

function makeRecord(partnums) {
  if (Array.isArray(partnums)) {
    return { parts: partnums.map(p => ({ partnum: p })) };
  }
  return { partnum: partnums };
}

describe('checkPartNumberDuplicatesInHistory', () => {
  it('returns null when history is empty', () => {
    const blocks = [validBlock('PN-NEW')];
    expect(checkPartNumberDuplicatesInHistory(blocks, [])).toBeNull();
  });

  it('returns null when no partnum matches history', () => {
    const records = [makeRecord(['PN-OLD'])];
    const blocks = [validBlock('PN-NEW')];
    expect(checkPartNumberDuplicatesInHistory(blocks, records)).toBeNull();
  });

  it('returns the conflicting partnum when match found in parts array', () => {
    const records = [makeRecord(['PN-123'])];
    const blocks = [validBlock('PN-123')];
    expect(checkPartNumberDuplicatesInHistory(blocks, records)).toBe('PN-123');
  });

  it('returns the conflicting partnum when match found in legacy partnum field', () => {
    const records = [makeRecord('PN-LEGACY')];
    const blocks = [validBlock('PN-LEGACY')];
    expect(checkPartNumberDuplicatesInHistory(blocks, records)).toBe('PN-LEGACY');
  });

  it('comparison is case-insensitive', () => {
    const records = [makeRecord(['pn-abc'])];
    const blocks = [validBlock('PN-ABC')];
    expect(checkPartNumberDuplicatesInHistory(blocks, records)).toBe('PN-ABC');
  });

  it('ignores blocks with empty partnum', () => {
    const records = [makeRecord(['PN-OLD'])];
    const blocks = [makeEmptyBlock()]; // partnum = ''
    expect(checkPartNumberDuplicatesInHistory(blocks, records)).toBeNull();
  });

  it('returns first conflicting partnum when multiple matches exist', () => {
    const records = [makeRecord(['PN-A']), makeRecord(['PN-B'])];
    const blocks = [validBlock('PN-A'), validBlock('PN-B')];
    const result = checkPartNumberDuplicatesInHistory(blocks, records);
    expect(['PN-A', 'PN-B']).toContain(result);
  });

  it('returns null when history records have neither parts nor partnum', () => {
    const records = [{ cell: '100' }]; // malformed record
    const blocks = [validBlock('PN-NEW')];
    expect(checkPartNumberDuplicatesInHistory(blocks, records)).toBeNull();
  });
});
