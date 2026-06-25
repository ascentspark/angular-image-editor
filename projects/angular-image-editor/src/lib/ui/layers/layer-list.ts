import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { LayerInfo } from '../../engine/editor-engine';
import { AspIcon } from '../../icons/asp-icon';

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

export interface LayerOpacityChange {
  readonly id: string;
  readonly value: number;
}

/** A layer click, carrying whether a modifier (shift/cmd/ctrl) was held. */
export interface LayerSelectEvent {
  readonly id: string;
  readonly additive: boolean;
}

/** A layer rename request. */
export interface LayerRenameEvent {
  readonly id: string;
  readonly name: string;
}

/**
 * The persistent Layers panel: the object z-stack plus the object-ops that act on
 * the current selection (group/ungroup/align/duplicate/delete + opacity). Lives
 * in the right column below the tool Options, available regardless of the active
 * tool — locking a layer makes clicks pass through, fixing overlap mis-selection.
 *
 * Rows support shift/cmd/ctrl-click multi-select, drag-and-drop reordering, and
 * double-click to rename. Presentational; the container owns the engine.
 */
@Component({
  selector: 'asp-layer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspIcon],
  templateUrl: './layer-list.html',
  styleUrl: './layer-list.css',
})
export class AspLayerList {
  readonly layers = input.required<readonly LayerInfo[]>();

  readonly selectLayer = output<LayerSelectEvent>();
  readonly toggleLock = output<string>();
  readonly toggleVisible = output<string>();
  readonly moveUp = output<string>();
  readonly moveDown = output<string>();
  readonly removeLayer = output<string>();
  readonly groupSelection = output<void>();
  readonly ungroupSelection = output<void>();
  readonly duplicateSelection = output<void>();
  readonly deleteSelection = output<void>();
  readonly alignSelection = output<AlignMode>();
  readonly opacityInput = output<LayerOpacityChange>();
  readonly opacityCommit = output<LayerOpacityChange>();
  /** New front-to-back order of layer ids after a drag-and-drop reorder. */
  readonly reorderLayers = output<readonly string[]>();
  readonly renameLayer = output<LayerRenameEvent>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly collapsed = signal(false);
  protected readonly alignOpen = signal(false);

  // drag-and-drop reorder state
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dropTargetId = signal<string | null>(null);
  /** Whether the drop indicator sits above (vs below) the hovered row. */
  protected readonly dropAbove = signal(true);

  // inline rename state
  protected readonly editingId = signal<string | null>(null);
  protected readonly editValue = signal('');

  protected readonly selected = computed<LayerInfo | undefined>(() =>
    this.layers().find((l) => l.selected),
  );
  protected readonly hasSelection = computed(() => this.selected() !== undefined);
  protected readonly selectionCount = computed(() => this.layers().filter((l) => l.selected).length);
  protected readonly opacityPct = computed(() => Math.round((this.selected()?.opacity ?? 1) * 100));

  protected toggle(): void {
    this.collapsed.update((v) => !v);
  }

  protected toggleAlign(): void {
    this.alignOpen.update((v) => !v);
  }

  protected emitAlign(mode: AlignMode): void {
    this.alignSelection.emit(mode);
    this.alignOpen.set(false);
  }

  protected onSelect(id: string, event: MouseEvent): void {
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    this.selectLayer.emit({ id, additive });
  }

  protected onOpacityInput(event: Event): void {
    const id = this.selected()?.id;
    if (id) {
      this.opacityInput.emit({ id, value: Number((event.target as HTMLInputElement).value) / 100 });
    }
  }

  protected onOpacityCommit(event: Event): void {
    const id = this.selected()?.id;
    if (id) {
      this.opacityCommit.emit({ id, value: Number((event.target as HTMLInputElement).value) / 100 });
    }
  }

  // ---- drag-and-drop reordering -------------------------------------------

  protected onDragStart(id: string, event: DragEvent): void {
    // Don't start a row drag from the action buttons (lock/show/move/etc).
    if ((event.target as HTMLElement).closest('.asp-layers__actions')) {
      event.preventDefault();
      return;
    }
    this.draggingId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Firefox requires data to be set for a drag to begin.
      event.dataTransfer.setData('text/plain', id);
    }
  }

  protected onDragOver(id: string, event: DragEvent): void {
    const dragged = this.draggingId();
    if (dragged === null || dragged === id) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropAbove.set(event.clientY - rect.top < rect.height / 2);
    this.dropTargetId.set(id);
  }

  protected onDrop(id: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggingId();
    if (dragged === null || dragged === id) {
      this.clearDragState();
      return;
    }
    const order = this.layers()
      .map((l) => l.id)
      .filter((layerId) => layerId !== dragged);
    const targetIndex = order.indexOf(id);
    const insertAt = this.dropAbove() ? targetIndex : targetIndex + 1;
    order.splice(insertAt, 0, dragged);
    this.reorderLayers.emit(order);
    this.clearDragState();
  }

  protected onDragEnd(): void {
    this.clearDragState();
  }

  private clearDragState(): void {
    this.draggingId.set(null);
    this.dropTargetId.set(null);
  }

  // ---- inline rename -------------------------------------------------------

  protected startRename(layer: LayerInfo): void {
    this.editingId.set(layer.id);
    this.editValue.set(layer.label);
    // Focus + select the input once it has rendered.
    queueMicrotask(() => {
      const input = this.host.nativeElement.querySelector<HTMLInputElement>(
        '.asp-layers__rename-input',
      );
      input?.focus();
      input?.select();
    });
  }

  protected onRenameInput(event: Event): void {
    this.editValue.set((event.target as HTMLInputElement).value);
  }

  protected commitRename(layer: LayerInfo): void {
    if (this.editingId() !== layer.id) {
      return;
    }
    const name = this.editValue().trim();
    this.editingId.set(null);
    if (name !== '' && name !== layer.label) {
      this.renameLayer.emit({ id: layer.id, name });
    }
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }
}
