import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AspIcon } from '../../icons/asp-icon';
import type { ToolMeta } from '../../registry/tool-registry';
import type { AspTool } from '../../types/editor.types';

/**
 * The vertical tool rail (left column of the advanced workspace). Presentational:
 * it renders the resolved tools and emits selections; all state lives in the
 * container. Collapses to a horizontal scroller on mobile.
 */
@Component({
  selector: 'asp-tool-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspIcon],
  templateUrl: './tool-rail.html',
  styleUrl: './tool-rail.css',
})
export class AspToolRail {
  readonly tools = input.required<readonly ToolMeta[]>();
  readonly activeTool = input.required<AspTool | null>();
  readonly toolSelect = output<AspTool>();
}
