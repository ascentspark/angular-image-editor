import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AspIcon } from '../../icons/asp-icon';
import type { HistoryEntry } from '../../engine/history';

/**
 * The History panel (bottom of the options column). Presentational: shows the
 * engine's edit entries, highlighting the current one and dimming any redo
 * branch ahead of the cursor.
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
}
