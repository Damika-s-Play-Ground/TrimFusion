/**
 * Bounded undo/redo stack (pure). The caller owns "current" state: push()
 * records the state being replaced, undo/redo exchange it for the stored one.
 */
export class HistoryStack<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 50) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Record the state being replaced; clears the redo branch. */
  push(state: T): void {
    this.past.push(state);
    if (this.past.length > this.limit) {
      this.past.shift();
    }
    this.future = [];
  }

  /** Returns the state to restore (storing `current` for redo), or null. */
  undo(current: T): T | null {
    const previous = this.past.pop();
    if (previous === undefined) {
      return null;
    }
    this.future.push(current);
    return previous;
  }

  /** Returns the state to restore (storing `current` for undo), or null. */
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) {
      return null;
    }
    this.past.push(current);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
