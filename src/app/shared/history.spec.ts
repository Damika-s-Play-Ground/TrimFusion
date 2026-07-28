import { HistoryStack } from './history';

describe('HistoryStack', () => {
  // W2-076: undo/redo behavior.
  it('round-trips undo and redo', () => {
    const h = new HistoryStack<number>();
    h.push(1); // state 1 replaced...
    h.push(2); // ...then state 2 replaced; current is 3
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.canUndo).toBeFalse();
    expect(h.redo(1)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.canRedo).toBeFalse();
  });

  it('clears the redo branch when a new state is pushed', () => {
    const h = new HistoryStack<number>();
    h.push(1);
    expect(h.undo(2)).toBe(1);
    expect(h.canRedo).toBeTrue();
    h.push(1); // diverge
    expect(h.canRedo).toBeFalse();
  });

  it('returns null when there is nothing to undo/redo', () => {
    const h = new HistoryStack<number>();
    expect(h.undo(1)).toBeNull();
    expect(h.redo(1)).toBeNull();
  });

  it('trims the oldest entries past the limit', () => {
    const h = new HistoryStack<number>(2);
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    // 1 was trimmed by the limit.
    expect(h.canUndo).toBeFalse();
  });

  it('clear() empties both branches', () => {
    const h = new HistoryStack<number>();
    h.push(1);
    h.undo(2);
    h.clear();
    expect(h.canUndo).toBeFalse();
    expect(h.canRedo).toBeFalse();
  });
});
