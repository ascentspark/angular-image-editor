import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { AspIcon } from '../../icons/asp-icon';
import { TOOL_REGISTRY } from '../../registry/tool-registry';
import type { ResolvedGroup } from '../../registry/toolbar-groups';
import type { AspTool } from '../../types/editor.types';

/**
 * The tool rail: one slot per resolved toolbar group. A group with several
 * members and `flyout: true` shows a ▸ that opens a flyout to switch sub-tools
 * (Photoshop-style). The slot shows the group's currently active member's icon.
 */
@Component({
  selector: 'asp-tool-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspIcon],
  templateUrl: './tool-rail.html',
  styleUrl: './tool-rail.css',
})
export class AspToolRail {
  readonly groups = input.required<readonly ResolvedGroup[]>();
  readonly activeTool = input.required<AspTool | null>();
  /** Per-group last-selected member, so a flyout slot shows the right icon. */
  readonly activeMembers = input<Record<string, AspTool>>({});
  readonly toolSelect = output<AspTool>();

  protected readonly openGroup = signal<string | null>(null);
  /** Fixed-position coords for the open flyout (the rail clips overflow). */
  protected readonly flyoutPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  protected memberLabel(member: AspTool): string {
    return TOOL_REGISTRY[member].label;
  }

  protected memberIcon(member: AspTool): string {
    return TOOL_REGISTRY[member].icon;
  }

  protected activeMemberOf(group: ResolvedGroup): AspTool {
    const tool = this.activeTool();
    if (tool !== null && group.members.includes(tool)) {
      return tool;
    }
    const remembered = this.activeMembers()[group.id];
    if (remembered !== undefined && group.members.includes(remembered)) {
      return remembered;
    }
    return group.members[0];
  }

  protected isActive(group: ResolvedGroup): boolean {
    const tool = this.activeTool();
    return tool !== null && group.members.includes(tool);
  }

  protected hasFlyout(group: ResolvedGroup): boolean {
    return group.flyout && group.members.length > 1;
  }

  protected toggleFlyout(id: string, event: Event): void {
    event.stopPropagation();
    const slot = (event.currentTarget as HTMLElement).closest('.asp-rail__slot');
    if (slot) {
      const rect = slot.getBoundingClientRect();
      this.flyoutPos.set({ top: rect.top, left: rect.right + 6 });
    }
    this.openGroup.update((open) => (open === id ? null : id));
  }

  protected closeFlyout(): void {
    this.openGroup.set(null);
  }

  protected pick(tool: AspTool): void {
    this.toolSelect.emit(tool);
    this.closeFlyout();
  }
}
