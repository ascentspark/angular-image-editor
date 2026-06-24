/**
 * Resolve the visible tool and filter sets from the public inputs.
 *
 * Tools:   `tools` (explicit allowlist) ?? default-for-`mode`, then minus `disabledTools`.
 * Filters: `filters` (`'all'` | explicit list) ?? default-for-`mode`.
 *
 * In all cases the output is de-duplicated and restricted to known catalog
 * members, so a stray or misspelled entry can never crash the UI or render a
 * phantom control. Explicit lists preserve their given order; an explicit empty
 * list is honored as "show nothing" (it is an override, not a fall-through).
 */

import { ALL_FILTERS, ALL_TOOLS, type AspFilter, type AspMode, type AspTool } from '../types/editor.types';
import { DEFAULT_FILTERS, DEFAULT_TOOLS } from './tool-registry';

const TOOL_SET = new Set<AspTool>(ALL_TOOLS);
const FILTER_SET = new Set<AspFilter>(ALL_FILTERS);

/** Keep only known members, de-duplicating while preserving first-seen order. */
function sanitize<T>(items: readonly T[], known: ReadonlySet<T>): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (known.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/**
 * Resolve the ordered set of enabled tools.
 *
 * @param mode baseline preset.
 * @param tools explicit allowlist, or `null` to use the mode default.
 * @param disabledTools tools to subtract from the resolved set.
 */
export function resolveTools(
  mode: AspMode,
  tools: readonly AspTool[] | null,
  disabledTools: readonly AspTool[],
): AspTool[] {
  const source = tools === null ? DEFAULT_TOOLS[mode] : tools;
  const allowed = sanitize(source, TOOL_SET);
  const disabled = new Set(sanitize(disabledTools, TOOL_SET));
  return allowed.filter((tool) => !disabled.has(tool));
}

/**
 * Resolve the ordered set of enabled filters.
 *
 * @param mode baseline preset.
 * @param filters explicit list, the literal `'all'`, or `null` for the mode default.
 */
export function resolveFilters(
  mode: AspMode,
  filters: readonly AspFilter[] | 'all' | null,
): AspFilter[] {
  if (filters === 'all') {
    return [...ALL_FILTERS];
  }
  const source = filters === null ? DEFAULT_FILTERS[mode] : filters;
  if (source === 'all') {
    return [...ALL_FILTERS];
  }
  return sanitize(source, FILTER_SET);
}
