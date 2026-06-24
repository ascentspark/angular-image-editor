/**
 * A bounded linear undo/redo history.
 *
 * Each entry pairs a human label (for the History panel) with an opaque state
 * snapshot (the editor stores serialized Fabric scenes here). Pure and fully
 * unit-testable — it holds no Fabric references.
 */

export interface HistoryEntry<T> {
  readonly label: string;
  readonly state: T;
}

const DEFAULT_MAX_ENTRIES = 50;

export class EditHistory<T> {
  private readonly stack: HistoryEntry<T>[];
  private cursor = 0;
  private readonly maxEntries: number;

  constructor(initialLabel: string, initialState: T, maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, maxEntries);
    this.stack = [{ label: initialLabel, state: initialState }];
  }

  /** All retained entries, oldest first. */
  get entries(): readonly HistoryEntry<T>[] {
    return this.stack;
  }

  /** Index of the current entry within {@link entries}. */
  get index(): number {
    return this.cursor;
  }

  get length(): number {
    return this.stack.length;
  }

  get current(): HistoryEntry<T> {
    return this.stack[this.cursor];
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  /**
   * Record a new state. Any redo branch ahead of the cursor is discarded, and
   * the oldest entries are dropped once the cap is exceeded.
   */
  push(label: string, state: T): void {
    this.stack.splice(this.cursor + 1);
    this.stack.push({ label, state });
    while (this.stack.length > this.maxEntries) {
      this.stack.shift();
    }
    this.cursor = this.stack.length - 1;
  }

  /** Step back one entry, or return `null` if already at the start. */
  undo(): HistoryEntry<T> | null {
    if (!this.canUndo) {
      return null;
    }
    this.cursor -= 1;
    return this.current;
  }

  /** Step forward one entry, or return `null` if already at the end. */
  redo(): HistoryEntry<T> | null {
    if (!this.canRedo) {
      return null;
    }
    this.cursor += 1;
    return this.current;
  }

  /** Replace the entire history with a single fresh entry. */
  reset(label: string, state: T): void {
    this.stack.splice(0, this.stack.length, { label, state });
    this.cursor = 0;
  }
}
