import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { LayerInfo } from '../../engine/editor-engine';
import { AspIcon } from '../../icons/asp-icon';

/**
 * The layers panel: the canvas object stack (top first) with select, lock,
 * show/hide, reorder, and delete. Locking a layer makes it non-interactive so
 * clicks pass through to objects beneath — the fix for overlap mis-selection.
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
}
