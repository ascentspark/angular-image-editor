import { ALL_FILTERS, ALL_TOOLS, type AspFilter, type AspTool } from '../types/editor.types';
import { DEFAULT_TOOLS } from './tool-registry';
import { resolveFilters, resolveTools } from './resolve-tools';

describe('resolveTools — mode defaults', () => {
  it('viewer exposes no edit tools', () => {
    expect(resolveTools('viewer', null, [])).toEqual([]);
  });

  it('basic exposes crop/rotate/flip', () => {
    expect(resolveTools('basic', null, [])).toEqual(['crop', 'rotate', 'flip']);
  });

  it('advanced exposes the curated rail set', () => {
    expect(resolveTools('advanced', null, [])).toEqual([...DEFAULT_TOOLS.advanced]);
  });

  it('full exposes every catalog tool exactly once', () => {
    const full = resolveTools('full', null, []);
    expect([...full].sort()).toEqual([...ALL_TOOLS].sort());
    expect(new Set(full).size).toBe(full.length);
  });
});

describe('resolveTools — allowlist override', () => {
  it('uses the explicit tools list as the allowlist, preserving its order', () => {
    expect(resolveTools('advanced', ['crop', 'text', 'rotate'], [])).toEqual([
      'crop',
      'text',
      'rotate',
    ]);
  });

  it('an empty allowlist yields no tools (explicit override, not "fall back to default")', () => {
    expect(resolveTools('advanced', [], [])).toEqual([]);
  });

  it('drops unknown tools from an allowlist', () => {
    const tools = ['crop', 'not-a-tool', 'text'] as unknown as AspTool[];
    expect(resolveTools('advanced', tools, [])).toEqual(['crop', 'text']);
  });

  it('de-duplicates an allowlist', () => {
    expect(resolveTools('advanced', ['crop', 'crop', 'text'], [])).toEqual(['crop', 'text']);
  });
});

describe('resolveTools — disabledTools subtraction', () => {
  it('subtracts disabled tools from the mode default', () => {
    const result = resolveTools('advanced', null, ['filters', 'frame']);
    expect(result).not.toContain('filters');
    expect(result).not.toContain('frame');
    expect(result).toContain('crop');
  });

  it('subtracts disabled tools from an allowlist', () => {
    expect(resolveTools('full', ['crop', 'text', 'filters'], ['filters'])).toEqual(['crop', 'text']);
  });

  it('ignores unknown entries in disabledTools', () => {
    const noise = ['nope'] as unknown as AspTool[];
    expect(resolveTools('basic', null, noise)).toEqual(['crop', 'rotate', 'flip']);
  });
});

describe('resolveFilters', () => {
  it('viewer and basic expose no filters', () => {
    expect(resolveFilters('viewer', null)).toEqual([]);
    expect(resolveFilters('basic', null)).toEqual([]);
  });

  it('advanced exposes a curated subset', () => {
    const f = resolveFilters('advanced', null);
    expect(f).toContain('brightness');
    expect(f).toContain('grayscale');
    expect(f.length).toBeGreaterThan(0);
    expect(f.length).toBeLessThan(ALL_FILTERS.length);
  });

  it('full exposes every filter', () => {
    expect([...resolveFilters('full', null)].sort()).toEqual([...ALL_FILTERS].sort());
  });

  it("'all' exposes every filter regardless of mode", () => {
    expect([...resolveFilters('basic', 'all')].sort()).toEqual([...ALL_FILTERS].sort());
  });

  it('an explicit list is used verbatim, in order', () => {
    expect(resolveFilters('advanced', ['sepia', 'invert'])).toEqual(['sepia', 'invert']);
  });

  it('drops unknown filters and de-duplicates an explicit list', () => {
    const list = ['sepia', 'bogus', 'sepia'] as unknown as AspFilter[];
    expect(resolveFilters('advanced', list)).toEqual(['sepia']);
  });

  it('an empty explicit list yields no filters', () => {
    expect(resolveFilters('full', [])).toEqual([]);
  });
});
