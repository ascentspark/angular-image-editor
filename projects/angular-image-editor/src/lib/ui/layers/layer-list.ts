import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { LayerInfo } from '../../engine/editor-engine';
import { AspIcon } from '../../icons/asp-icon';

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

export interface LayerOpacityChange {
  readonly id: string;
  readonly value: number;
}

/**
 * The persistent Layers panel: the object z-stack plus the object-ops that act on
 * the current selection (group/ungroup/align/duplicate/delete + opacity). Lives
 * in the right column below the tool Options, available regardless of the active
 * tool — locking a layer makes clicks pass through, fixing overlap mis-selection.
 * Presentational; the container owns the engine.
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

  readonly selectLayer = output<string>();
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

  protected readonly collapsed = signal(false);
  protected readonly alignOpen = signal(false);

  protected readonly selected = computed<LayerInfo | undefined>(() =>
    this.layers().find((l) => l.selected),
  );
  protected readonly hasSelection = computed(() => this.selected() !== undefined);
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
}
