/**
 * Toolbar grouping — maps the resolved tool set into a small number of toolbar
 * slots, Photoshop-style. Each group occupies one slot; a group with more than
 * one resolved member and `flyout: true` shows a flyout to switch between them.
 *
 * Tools NOT represented here (layers, object-ops like group/align/duplicate/
 * delete/opacity) are intentionally absent — they live in the persistent Layers
 * panel, not the toolbar.
 */

import type { AspTool } from '../types/editor.types';

export interface ToolGroup {
  readonly id: string;
  readonly label: string;
  /** Lucide icon for the slot. */
  readonly icon: string;
  /** Tools that belong to this slot, in display order. */
  readonly members: readonly AspTool[];
  /** Whether multiple members are switched via a toolbar flyout (vs in-panel tabs). */
  readonly flyout: boolean;
}

export interface ResolvedGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** The subset of members present in the resolved tool set, in order. */
  readonly members: AspTool[];
  readonly flyout: boolean;
}

export const TOOLBAR_GROUPS: readonly ToolGroup[] = [
  { id: 'select', label: 'Select', icon: 'mouse-pointer-2', members: ['select'], flyout: false },
  {
    id: 'transform',
    label: 'Crop & rotate',
    icon: 'crop',
    members: ['crop', 'rotate', 'straighten', 'resize'],
    flyout: false,
  },
  {
    id: 'color',
    label: 'Color',
    icon: 'sliders-horizontal',
    members: ['adjust', 'filters'],
    flyout: false,
  },
  { id: 'draw', label: 'Draw', icon: 'pencil', members: ['pen', 'highlighter'], flyout: true },
  { id: 'eraser', label: 'Eraser', icon: 'eraser', members: ['eraser'], flyout: false },
  { id: 'shapes', label: 'Shapes', icon: 'square', members: ['shapes'], flyout: false },
  { id: 'text', label: 'Text', icon: 'type', members: ['text'], flyout: false },
  {
    id: 'redact',
    label: 'Redact',
    icon: 'square-dashed-mouse-pointer',
    members: ['redact'],
    flyout: false,
  },
  { id: 'canvas', label: 'Canvas', icon: 'image', members: ['frame', 'background'], flyout: true },
];

/** Resolve toolbar slots for a tool set: keep groups with ≥1 member, members in order. */
export function resolveGroups(tools: readonly AspTool[]): ResolvedGroup[] {
  const present = new Set(tools);
  const groups: ResolvedGroup[] = [];
  for (const group of TOOLBAR_GROUPS) {
    const members = group.members.filter((m) => present.has(m));
    if (members.length > 0) {
      groups.push({ id: group.id, label: group.label, icon: group.icon, members, flyout: group.flyout });
    }
  }
  return groups;
}

/** The group a tool belongs to (or null). */
export function groupForTool(tool: AspTool): ToolGroup | null {
  return TOOLBAR_GROUPS.find((g) => g.members.includes(tool)) ?? null;
}
