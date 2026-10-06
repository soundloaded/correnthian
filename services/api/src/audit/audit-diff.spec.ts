import { describe, expect, it } from 'vitest';
import { diffState } from './audit-diff.js';

describe('diffState', () => {
  it('keeps only the fields that differ', () => {
    const before = { id: 'a1', symbol: 'XAU', enabled: true, updatedAt: new Date('2026-01-01') };
    const after = { id: 'a1', symbol: 'XAU', enabled: false, updatedAt: new Date('2026-01-01') };

    const change = diffState(before, after);
    expect(change.changed).toEqual(['enabled']);
    expect(change.before).toEqual({ enabled: true });
    expect(change.after).toEqual({ enabled: false });
  });

  it('does not report a change when only the query order differed', () => {
    const a = { symbol: 'XAU', enabled: true };
    const b = { enabled: true, symbol: 'XAU' };
    expect(diffState(a, b).changed).toEqual([]);
  });

  it('normalises a timestamp to a comparable string rather than reporting it raw', () => {
    const at = new Date('2026-10-06T05:42:00.000Z');
    const change = diffState({ at: null }, { at });
    expect(change.after).toEqual({ at: '2026-10-06T05:42:00.000Z' });
  });

  it('treats an unchanged Date as unchanged', () => {
    const at = new Date('2026-10-06T05:42:00.000Z');
    expect(diffState({ at }, { at: new Date(at) }).changed).toEqual([]);
  });

  it('survives a bigint, which JSON.stringify would throw on', () => {
    const change = diffState({ blockNumber: 21_000_000n }, { blockNumber: 21_000_001n });
    expect(change.after).toEqual({ blockNumber: '21000001' });
  });

  it('reports a create with no before', () => {
    const change = diffState(null, { state: 'created' });
    expect(change.before).toBeNull();
    expect(change.after).toEqual({ state: 'created' });
    expect(change.changed).toEqual(['state']);
  });

  it('reports a delete with no after', () => {
    const change = diffState({ state: 'disabled' }, null);
    expect(change.after).toBeNull();
    expect(change.changed).toEqual(['state']);
  });

  it('reports a field present on only one side', () => {
    const change = diffState({ a: 1 }, { a: 1, b: 2 });
    expect(change.changed).toEqual(['b']);
    expect(change.before).toEqual({ b: null });
    expect(change.after).toEqual({ b: 2 });
  });

  it('narrows to the fields a caller names', () => {
    const before = { status: 'active', notes: 'old note', updatedAt: new Date(0) };
    const after = { status: 'disabled', notes: 'new note', updatedAt: new Date(1) };
    const change = diffState(before, after, { fields: ['status'] });
    expect(change.changed).toEqual(['status']);
    expect(change.after).toEqual({ status: 'disabled' });
  });

  it('returns an empty pair when nothing changed, rather than an empty object', () => {
    // An empty `{}` reads as "something changed" with nothing to see.
    const change = diffState({ a: 1 }, { a: 1 });
    expect(change).toEqual({ before: null, after: null, changed: [] });
  });

  it('compares nested objects structurally, not by identity', () => {
    const change = diffState(
      { trust: { tier: 'unverified', flags: [] } },
      { trust: { tier: 'unverified', flags: [] } },
    );
    expect(change.changed).toEqual([]);
  });

  it('refuses a snapshot that is not a row', () => {
    expect(() => diffState('a string', {})).toThrow(/row-like object/);
  });
});