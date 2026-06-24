/**
 * A bounded linear undo/redo history that stores **diffs**, not full snapshots.
 *
 * The editor serializes its whole scene (often hundreds of KB once an image is
 * loaded) on every edit. Keeping 50 full snapshots would cost tens of MB. This
 * history keeps one full base plus a chain of jsondiffpatch deltas — each
 * incremental edit (move a shape, tweak a color) is a sub-KB delta — and
 * reconstructs any state on demand by replaying deltas from the base.
 *
 * Behavior is identical to a full-snapshot stack: `current`/`undo`/`redo`
 * return the exact serialized state, branches truncate on push, and the oldest
 * entries drop once the cap is exceeded (the new oldest is re-materialized into
 * the base so the chain stays valid). Pure and unit-testable — no Fabric refs.
 */

import { create, type DiffPatcher, type Delta } from 'jsondiffpatch';

import type { HistoryEntry } from './history';

/** Minimal projection of an entry for the History panel (labels only). */
export interface HistoryStep {
  readonly label: string;
}

/** Parsed snapshot object; opaque to this module (it only diffs/patches it). */
type SceneState = Record<string, unknown>;

/**
 * One node in the chain. The first node is a *base* (`full` set, `delta`
 * undefined); every later node is a *delta* against its predecessor's
 * reconstructed state (`full` undefined, `delta` set — or undefined when the
 * edit produced no change).
 */
interface Node {
  label: string;
  full: SceneState | null;
  delta: Delta | undefined;
}

const DEFAULT_MAX_ENTRIES = 50;

export class DeltaHistory {
  private readonly differ: DiffPatcher;
  private readonly stack: Node[];
  private cursor = 0;
  private readonly maxEntries: number;

  constructor(initialLabel: string, initialState: string, maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, maxEntries);
    this.differ = create({
      // Match array items by their stable editor id so reordering/edits produce
      // small deltas; fall back to positional matching when an item has no id.
      objectHash: (item: unknown, index?: number) => {
        const id = (item as Record<string, unknown> | null)?.['aspId'];
        return typeof id === 'string' ? id : `$$index:${index}`;
      },
      // Text diffing is opt-in (needs a diff-match-patch instance) and brings no
      // benefit for our short scene fields, so it is left off by omitting it.
    });
    this.stack = [{ label: initialLabel, full: parse(initialState), delta: undefined }];
  }

  /** Labels for every retained entry, oldest first (for the History panel). */
  get entries(): readonly HistoryStep[] {
    return this.stack.map((n) => ({ label: n.label }));
  }

  get index(): number {
    return this.cursor;
  }

  get length(): number {
    return this.stack.length;
  }

  get current(): HistoryEntry<string> {
    return this.entryAt(this.cursor);
  }

  /** The base entry (index 0) — used by the engine's full "reset edits" action. */
  get first(): HistoryEntry<string> {
    return this.entryAt(0);
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  /**
   * Record a new state. The redo branch ahead of the cursor is discarded, and
   * the oldest entries drop once the cap is exceeded.
   */
  push(label: string, state: string): void {
    const prev = this.reconstruct(this.cursor);
    const next = parse(state);
    const delta = this.differ.diff(prev, next);
    this.stack.splice(this.cursor + 1);
    this.stack.push({ label, full: null, delta });
    while (this.stack.length > this.maxEntries) {
      this.dropOldest();
    }
    this.cursor = this.stack.length - 1;
  }

  /** Step back one entry, or return `null` if already at the start. */
  undo(): HistoryEntry<string> | null {
    if (!this.canUndo) {
      return null;
    }
    this.cursor -= 1;
    return this.current;
  }

  /** Step forward one entry, or return `null` if already at the end. */
  redo(): HistoryEntry<string> | null {
    if (!this.canRedo) {
      return null;
    }
    this.cursor += 1;
    return this.current;
  }

  /** Replace the entire history with a single fresh base entry. */
  reset(label: string, state: string): void {
    this.stack.splice(0, this.stack.length, { label, full: parse(state), delta: undefined });
    this.cursor = 0;
  }

  /** Serialized byte length of the delta retained for an entry (for tests/metrics). */
  retainedDeltaBytes(index: number): number {
    const node = this.stack[index];
    if (!node || node.delta === undefined) {
      return 0;
    }
    return JSON.stringify(node.delta).length;
  }

  /** Reconstruct the serialized state at an index by replaying deltas from the base. */
  private entryAt(index: number): HistoryEntry<string> {
    return { label: this.stack[index].label, state: stringify(this.reconstruct(index)) };
  }

  /**
   * Replay the delta chain from the base (index 0) up to `targetIndex`. The
   * base is deep-cloned first so patching never mutates retained state.
   */
  private reconstruct(targetIndex: number): SceneState {
    let obj = this.differ.clone(this.stack[0].full) as SceneState;
    for (let i = 1; i <= targetIndex; i++) {
      const delta = this.stack[i].delta;
      if (delta !== undefined) {
        obj = this.differ.patch(obj, delta) as SceneState;
      }
    }
    return obj;
  }

  /**
   * Drop the base entry and promote the next one to a fresh base by
   * materializing its full state (its delta no longer has a predecessor).
   */
  private dropOldest(): void {
    if (this.stack.length <= 1) {
      return;
    }
    const newBase = this.reconstruct(1);
    this.stack.shift();
    this.stack[0] = { label: this.stack[0].label, full: newBase, delta: undefined };
    this.cursor = Math.max(0, this.cursor - 1);
  }
}

/** Parse a serialized snapshot into a mutable object the differ can work with. */
function parse(state: string): SceneState {
  return JSON.parse(state) as SceneState;
}

/** Deterministically re-serialize a reconstructed state. */
function stringify(state: SceneState): string {
  return JSON.stringify(state);
}
