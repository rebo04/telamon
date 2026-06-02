import { describe, it, expect } from 'vitest';
import { applyRoleLogic, PASS_ADMIN, PASS_CHECKER, PASS_VIEWER, PASS_PAPOI } from '../../src/logic.js';

describe('applyRoleLogic', () => {
  it('returns "admin" for the admin password', () => {
    expect(applyRoleLogic(PASS_ADMIN)).toBe('admin');
  });

  it('returns "checker" for the checker password', () => {
    expect(applyRoleLogic(PASS_CHECKER)).toBe('checker');
  });

  it('returns "papoi" for the papoi password', () => {
    expect(applyRoleLogic(PASS_PAPOI)).toBe('papoi');
  });

  it('returns "viewer" for the viewer password', () => {
    expect(applyRoleLogic(PASS_VIEWER)).toBe('viewer');
  });

  it('returns null for an incorrect password', () => {
    expect(applyRoleLogic('wrong')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(applyRoleLogic('')).toBeNull();
  });

  it('is case-sensitive (lowercase admin password fails)', () => {
    expect(applyRoleLogic(PASS_ADMIN.toLowerCase())).toBeNull();
  });

  it('is case-sensitive (uppercase viewer password fails)', () => {
    expect(applyRoleLogic(PASS_VIEWER.toLowerCase())).toBeNull();
  });

  it('returns null for a password with extra whitespace', () => {
    expect(applyRoleLogic(` ${PASS_ADMIN} `)).toBeNull();
  });

  it('returns a string role, not a boolean', () => {
    const role = applyRoleLogic(PASS_ADMIN);
    expect(typeof role).toBe('string');
  });

  it('four distinct passwords map to four distinct roles', () => {
    const roles = new Set([
      applyRoleLogic(PASS_ADMIN),
      applyRoleLogic(PASS_CHECKER),
      applyRoleLogic(PASS_PAPOI),
      applyRoleLogic(PASS_VIEWER),
    ]);
    expect(roles.size).toBe(4);
  });
});
