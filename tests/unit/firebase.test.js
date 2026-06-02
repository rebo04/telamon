/**
 * Firebase integration tests — all Firebase calls are mocked so no
 * network connection is needed. The tests verify the control-flow and
 * conditional branching of saveToFirebase / deleteFromFirebase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline minimal implementations that mirror index.html behaviour ──────
// We test the logic in isolation rather than importing it from the HTML.

function makeFirebaseReady(overrides = {}) {
  return {
    _firebaseReady: true,
    _db_ref: {},
    _COL: 'registros',
    _col: {},
    _addDoc: vi.fn().mockResolvedValue({ id: 'fb-new-id' }),
    _setDoc: vi.fn().mockResolvedValue(undefined),
    _deleteDoc: vi.fn().mockResolvedValue(undefined),
    _doc: vi.fn().mockReturnValue('doc-ref'),
    ...overrides,
  };
}

async function saveToFirebase(record, win) {
  if (!win._firebaseReady) return;
  try {
    if (record._firebaseId) {
      await win._setDoc(win._doc(win._db_ref, win._COL, record._firebaseId), record);
    } else {
      const docRef = await win._addDoc(win._col, record);
      record._firebaseId = docRef.id;
    }
  } catch (e) { /* swallowed */ }
}

async function deleteFromFirebase(firebaseId, win) {
  if (!win._firebaseReady || !firebaseId) return;
  try {
    await win._deleteDoc(win._doc(win._db_ref, win._COL, firebaseId));
  } catch (e) { /* swallowed */ }
}

// ── saveToFirebase ───────────────────────────────────────────────────────

describe('saveToFirebase', () => {
  let win;
  beforeEach(() => { win = makeFirebaseReady(); });

  it('calls _addDoc for a new record (no _firebaseId)', async () => {
    const record = { id: 1, cell: '215' };
    await saveToFirebase(record, win);
    expect(win._addDoc).toHaveBeenCalledOnce();
    expect(win._setDoc).not.toHaveBeenCalled();
  });

  it('sets _firebaseId on the record after addDoc', async () => {
    const record = { id: 1, cell: '215' };
    await saveToFirebase(record, win);
    expect(record._firebaseId).toBe('fb-new-id');
  });

  it('calls _setDoc for an existing record (has _firebaseId)', async () => {
    const record = { id: 1, _firebaseId: 'existing-id' };
    await saveToFirebase(record, win);
    expect(win._setDoc).toHaveBeenCalledOnce();
    expect(win._addDoc).not.toHaveBeenCalled();
  });

  it('passes the correct document reference to _setDoc', async () => {
    const record = { id: 1, _firebaseId: 'existing-id' };
    await saveToFirebase(record, win);
    expect(win._doc).toHaveBeenCalledWith(win._db_ref, win._COL, 'existing-id');
  });

  it('does nothing when Firebase is not ready', async () => {
    win._firebaseReady = false;
    await saveToFirebase({ id: 1 }, win);
    expect(win._addDoc).not.toHaveBeenCalled();
    expect(win._setDoc).not.toHaveBeenCalled();
  });

  it('does not throw when _addDoc rejects', async () => {
    win._addDoc = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(saveToFirebase({ id: 1 }, win)).resolves.not.toThrow();
  });

  it('does not throw when _setDoc rejects', async () => {
    win._setDoc = vi.fn().mockRejectedValue(new Error('permission denied'));
    await expect(saveToFirebase({ id: 1, _firebaseId: 'x' }, win)).resolves.not.toThrow();
  });
});

// ── deleteFromFirebase ───────────────────────────────────────────────────

describe('deleteFromFirebase', () => {
  let win;
  beforeEach(() => { win = makeFirebaseReady(); });

  it('calls _deleteDoc with the correct id', async () => {
    await deleteFromFirebase('fb-123', win);
    expect(win._deleteDoc).toHaveBeenCalledOnce();
    expect(win._doc).toHaveBeenCalledWith(win._db_ref, win._COL, 'fb-123');
  });

  it('does nothing when Firebase is not ready', async () => {
    win._firebaseReady = false;
    await deleteFromFirebase('fb-123', win);
    expect(win._deleteDoc).not.toHaveBeenCalled();
  });

  it('does nothing when firebaseId is null', async () => {
    await deleteFromFirebase(null, win);
    expect(win._deleteDoc).not.toHaveBeenCalled();
  });

  it('does nothing when firebaseId is undefined', async () => {
    await deleteFromFirebase(undefined, win);
    expect(win._deleteDoc).not.toHaveBeenCalled();
  });

  it('does nothing when firebaseId is an empty string', async () => {
    await deleteFromFirebase('', win);
    expect(win._deleteDoc).not.toHaveBeenCalled();
  });

  it('does not throw when _deleteDoc rejects', async () => {
    win._deleteDoc = vi.fn().mockRejectedValue(new Error('not found'));
    await expect(deleteFromFirebase('fb-xyz', win)).resolves.not.toThrow();
  });
});
