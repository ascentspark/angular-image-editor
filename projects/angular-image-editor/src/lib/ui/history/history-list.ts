import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { AspIcon } from '../../icons/asp-icon';
import type { HistoryEntry } from '../../engine/history';

/**
 * The History panel (bottom of the options column). Presentational: shows the
 * engine's edit entries, highlighting the current one and dimming any redo
 * branch ahead of the cursor. The user can collapse it via the header chevron.
 */
@Component({
  selector: 'asp-history-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspIcon],
  templateUrl: './history-list.html',
  styleUrl: './history-list.css',
})
export class AspHistoryList {
  readonly entries = input.required<readonly HistoryEntry<string>[]>();
  readonly currentIndex = input.required<number>();

  protected readonly collapsed = signal(false);

  protected toggle(): void {
    this.collapsed.update((v) => !v);
  }
}
