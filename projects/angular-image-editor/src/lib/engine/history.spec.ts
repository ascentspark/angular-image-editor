import { EditHistory } from './history';

describe('EditHistory', () => {
  it('starts with a single entry and nothing to undo/redo', () => {
    const h = new EditHistory<string>('Opened image', 's0');
    expect(h.length).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.current.label).toBe('Opened image');
    expect(h.current.state).toBe('s0');
    expect(h.index).toBe(0);
  });

  it('push appends, enables undo, and moves current to the new entry', () => {
    const h = new EditHistory<string>('Opened image', 's0');
    h.push('Rotate CW', 's1');
    expect(h.length).toBe(2);
    expect(h.index).toBe(1);
    expect(h.current.state).toBe('s1');
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it('undo returns the previous entry and enables redo', () => {
    const h = new EditHistory<string>('init', 's0');
    h.push('a', 's1');
    const undone = h.undo();
    expect(undone?.state).toBe('s0');
    expect(h.current.state).toBe('s0');
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it('redo re-applies the next entry', () => {
    const h = new EditHistory<string>('init', 's0');
    h.push('a', 's1');
    h.undo();
    const redone = h.redo();
    expect(redone?.state).toBe('s1');
    expect(h.current.state).toBe('s1');
    expect(h.canRedo).toBe(false);
  });

  it('undo at the start returns null and does not move', () => {
    const h = new EditHistory<string>('init', 's0');
    expect(h.undo()).toBeNull();
    expect(h.index).toBe(0);
  });

  it('redo at the end returns null and does not move', () => {
    const h = new EditHistory<string>('init', 's0');
    h.push('a', 's1');
    expect(h.redo()).toBeNull();
    expect(h.index).toBe(1);
  });

  it('pushing after an undo truncates the redo branch', () => {
    const h = new EditHistory<string>('init', 's0');
    h.push('a', 's1');
    h.push('b', 's2');
    h.undo(); // back to s1
    h.push('c', 's3'); // should discard s2
    expect(h.length).toBe(3);
    expect(h.entries.map((e) => e.state)).toEqual(['s0', 's1', 's3']);
    expect(h.canRedo).toBe(false);
    expect(h.current.state).toBe('s3');
  });

  it('caps the number of retained entries, dropping the oldest', () => {
    const h = new EditHistory<string>('init', 's0', 3);
    h.push('a', 's1');
    h.push('b', 's2');
    h.push('c', 's3'); // exceeds cap of 3 → drop 's0'
    expect(h.length).toBe(3);
    expect(h.entries.map((e) => e.state)).toEqual(['s1', 's2', 's3']);
    expect(h.current.state).toBe('s3');
    expect(h.canUndo).toBe(true);
  });

  it('reset collapses to a single entry', () => {
    const h = new EditHistory<string>('init', 's0');
    h.push('a', 's1');
    h.reset('Opened image', 'fresh');
    expect(h.length).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.current.state).toBe('fresh');
  });
});
