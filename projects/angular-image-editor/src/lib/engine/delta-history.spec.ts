import { DeltaHistory } from './delta-history';

/** Build a JSON snapshot string the way the engine does (objects, not scalars). */
const snap = (n: number, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ json: { objects: [{ aspId: `o${n}`, left: n * 10 }] }, step: n, ...extra });

describe('DeltaHistory', () => {
  it('starts with a single entry and nothing to undo/redo', () => {
    const h = new DeltaHistory('Opened image', snap(0));
    expect(h.length).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.current.label).toBe('Opened image');
    expect(h.current.state).toBe(snap(0));
    expect(h.index).toBe(0);
  });

  it('push appends, enables undo, and moves current to the new entry', () => {
    const h = new DeltaHistory('Opened image', snap(0));
    h.push('Rotate CW', snap(1));
    expect(h.length).toBe(2);
    expect(h.index).toBe(1);
    expect(h.current.state).toBe(snap(1));
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it('undo reconstructs the previous state exactly and enables redo', () => {
    const h = new DeltaHistory('init', snap(0));
    h.push('a', snap(1));
    const undone = h.undo();
    expect(undone?.state).toBe(snap(0));
    expect(h.current.state).toBe(snap(0));
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it('redo reconstructs the next state exactly', () => {
    const h = new DeltaHistory('init', snap(0));
    h.push('a', snap(1));
    h.undo();
    const redone = h.redo();
    expect(redone?.state).toBe(snap(1));
    expect(h.current.state).toBe(snap(1));
    expect(h.canRedo).toBe(false);
  });

  it('reconstructs every state across a long chain of pushes', () => {
    const h = new DeltaHistory('init', snap(0));
    for (let i = 1; i < 12; i++) {
      h.push(`step ${i}`, snap(i, { note: 'x'.repeat(i) }));
    }
    // walk all the way back, verifying exact reconstruction at each step
    for (let i = 11; i > 0; i--) {
      expect(h.current.state).toBe(snap(i, { note: 'x'.repeat(i) }));
      h.undo();
    }
    expect(h.current.state).toBe(snap(0));
  });

  it('undo at the start returns null and does not move', () => {
    const h = new DeltaHistory('init', snap(0));
    expect(h.undo()).toBeNull();
    expect(h.index).toBe(0);
  });

  it('redo at the end returns null and does not move', () => {
    const h = new DeltaHistory('init', snap(0));
    h.push('a', snap(1));
    expect(h.redo()).toBeNull();
    expect(h.index).toBe(1);
  });

  it('pushing after an undo truncates the redo branch', () => {
    const h = new DeltaHistory('init', snap(0));
    h.push('a', snap(1));
    h.push('b', snap(2));
    h.undo(); // back to snap(1)
    h.push('c', snap(3)); // should discard snap(2)
    expect(h.length).toBe(3);
    expect(h.entries.map((e) => e.label)).toEqual(['init', 'a', 'c']);
    expect(h.canRedo).toBe(false);
    expect(h.current.state).toBe(snap(3));
    // and the surviving earlier states still reconstruct
    h.undo();
    expect(h.current.state).toBe(snap(1));
  });

  it('caps the number of retained entries, dropping the oldest, keeping reconstruction valid', () => {
    const h = new DeltaHistory('init', snap(0), 3);
    h.push('a', snap(1));
    h.push('b', snap(2));
    h.push('c', snap(3)); // exceeds cap of 3 → drop snap(0)
    expect(h.length).toBe(3);
    expect(h.entries.map((e) => e.label)).toEqual(['a', 'b', 'c']);
    expect(h.current.state).toBe(snap(3));
    expect(h.canUndo).toBe(true);
    // the new oldest entry must still reconstruct exactly (it became the base)
    h.undo();
    h.undo();
    expect(h.index).toBe(0);
    expect(h.current.state).toBe(snap(1));
    expect(h.canUndo).toBe(false);
  });

  it('reset collapses to a single entry', () => {
    const h = new DeltaHistory('init', snap(0));
    h.push('a', snap(1));
    h.reset('Opened image', snap(9));
    expect(h.length).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.current.state).toBe(snap(9));
  });

  it('exposes the first entry (base) for engine reset', () => {
    const h = new DeltaHistory('Opened image', snap(0));
    h.push('a', snap(1));
    h.push('b', snap(2));
    expect(h.first.label).toBe('Opened image');
    expect(h.first.state).toBe(snap(0));
  });

  it('stores compact deltas, not full snapshots, for incremental edits', () => {
    const big = 'y'.repeat(5000);
    const base = JSON.stringify({ json: { objects: [{ aspId: 'a', blob: big }] }, n: 0 });
    const next = JSON.stringify({ json: { objects: [{ aspId: 'a', blob: big }] }, n: 1 });
    const h = new DeltaHistory('init', base);
    h.push('tiny change', next);
    // the stored delta for the second entry must be far smaller than the snapshot
    expect(h.retainedDeltaBytes(1)).toBeLessThan(next.length / 4);
    // round-trip still exact
    expect(h.current.state).toBe(next);
    h.undo();
    expect(h.current.state).toBe(base);
  });
});
