/*
 * Public API surface of @ascentspark/angular-image-editor
 *
 * Only symbols re-exported here are part of the package's semver contract.
 * Additional components, the dialog service, and the tool types are added by
 * later phases (see docs/plans/00-master-plan.md).
 */

export { AspImageEditor } from './lib/ui/image-editor/image-editor';

// Modal dialog — open the basic editor and await a Blob (or null on cancel).
export {
  AspImageEditorDialog,
  type OpenImageEditorConfig,
} from './lib/dialog/image-editor-dialog';

// Core type contract.
export {
  ALL_TOOLS,
  ALL_FILTERS,
  aspectOption,
  type AspMode,
  type AspTool,
  type AspFilter,
  type AspExportFormat,
  type AspAspectPreset,
  type AspAspectOption,
  type AspEditorError,
} from './lib/types/editor.types';

// Tool/filter catalog + resolution (mode → tools allowlist → minus disabledTools; filters).
export {
  TOOL_REGISTRY,
  FILTER_REGISTRY,
  DEFAULT_TOOLS,
  DEFAULT_FILTERS,
  type ToolMeta,
  type FilterMeta,
  type AspToolGroup,
  type FilterKind,
} from './lib/registry/tool-registry';
export { resolveTools, resolveFilters } from './lib/registry/resolve-tools';

// Engine — advanced/headless access to the Fabric-backed editing surface.
export {
  EditorEngine,
  type EngineOptions,
  type ShapeKind,
  type RedactMode,
  type AnnotationStyle,
  type TextStyle,
  type SelectionStyleInfo,
  type LayerInfo,
  type ArtboardSize,
  type ManualGuide,
  type Viewport,
} from './lib/engine/editor-engine';
export { EditHistory, type HistoryEntry } from './lib/engine/history';
export { DeltaHistory, type HistoryStep } from './lib/engine/delta-history';

// Theming — derive and apply the editor's --asp-* palette from 3 inputs.
export { deriveTheme, type AspThemeMode } from './lib/theme/derive-theme';
export { applyTheme } from './lib/theme/apply-theme';

// Text fonts — default set + type for customizing the font picker.
export { DEFAULT_FONTS, type FontOption } from './lib/ui/image-editor/fonts';
export {
  THEME_TOKEN_NAMES,
  COLOR_TOKEN_NAMES,
  STATIC_TOKEN_NAMES,
  type AspThemeTokens,
  type ThemeTokenName,
} from './lib/theme/tokens';
