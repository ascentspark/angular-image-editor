import type { AspTool } from '../types/editor.types';
import { groupForTool, resolveGroups } from './toolbar-groups';

describe('resolveGroups', () => {
  it('keeps only groups with at least one present member, in order', () => {
    const groups = resolveGroups(['adjust', 'crop', 'pen', 'highlighter', 'frame']);
    expect(groups.map((g) => g.id)).toEqual(['transform', 'color', 'draw', 'canvas']);
  });

  it('filters members to the present tools, preserving order', () => {
    const draw = resolveGroups(['highlighter', 'pen']).find((g) => g.id === 'draw');
    expect(draw?.members).toEqual(['pen', 'highlighter']);
  });

  it('omits layers and object-ops (they are not toolbar groups)', () => {
    const tools = ['layers', 'duplicate', 'delete', 'opacity', 'align', 'group'] as AspTool[];
    expect(resolveGroups(tools)).toEqual([]);
  });

  it('maps a full set to the eight slots', () => {
    const groups = resolveGroups([
      'select',
      'crop',
      'rotate',
      'adjust',
      'filters',
      'pen',
      'highlighter',
      'shapes',
      'text',
      'redact',
      'frame',
      'background',
    ]);
    expect(groups.map((g) => g.id)).toEqual([
      'select',
      'transform',
      'color',
      'draw',
      'shapes',
      'text',
      'redact',
      'canvas',
    ]);
  });
});

describe('groupForTool', () => {
  it('finds the owning group', () => {
    expect(groupForTool('filters')?.id).toBe('color');
    expect(groupForTool('rotate')?.id).toBe('transform');
    expect(groupForTool('background')?.id).toBe('canvas');
  });

  it('returns null for tools with no toolbar slot', () => {
    expect(groupForTool('layers')).toBeNull();
    expect(groupForTool('opacity')).toBeNull();
  });
});
