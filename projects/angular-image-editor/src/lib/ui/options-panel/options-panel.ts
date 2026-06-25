import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { AspIcon } from '../../icons/asp-icon';
import { AspColorField } from '../controls/color-field';
import type { ArtboardSize, RedactMode, ShapeKind } from '../../engine/editor-engine';
import type { FilterMeta } from '../../registry/tool-registry';
import type { AspAspectOption, AspAspectPreset, AspFilter, AspTool } from '../../types/editor.types';
import type { FontOption } from '../image-editor/fonts';

export type { RedactMode } from '../../engine/editor-engine';

/** Frame styles offered in the frame panel. */
export interface FrameOption {
  readonly key: string;
  readonly label: string;
}

export const FRAME_OPTIONS: readonly FrameOption[] = [
  { key: 'none', label: 'None' },
  { key: 'mat', label: 'Mat' },
  { key: 'line', label: 'Line' },
  { key: 'inset', label: 'Inset' },
  { key: 'hook', label: 'Hook' },
  { key: 'bead', label: 'Bead' },
];

export type PanelKind =
  | 'color'
  | 'transform'
  | 'annotate'
  | 'frame'
  | 'background'
  | 'select'
  | 'none';

/** Background color swatches (`transparent` clears to the checkerboard). */
export const BACKGROUND_COLORS: readonly string[] = [
  'transparent',
  '#ffffff',
  '#000000',
  '#f4f6f9',
  '#1f6feb',
  '#0b0f1a',
];

/** A named artboard / output-size preset. */
export interface ArtboardPreset {
  readonly label: string;
  readonly size: ArtboardSize;
}

/** Common social / CMS output sizes offered in the Canvas panel. */
export const ARTBOARD_PRESETS: readonly ArtboardPreset[] = [
  { label: 'Square 1080', size: { width: 1080, height: 1080 } },
  { label: 'Portrait 4:5', size: { width: 1080, height: 1350 } },
  { label: 'Story 9:16', size: { width: 1080, height: 1920 } },
  { label: 'HD 16:9', size: { width: 1920, height: 1080 } },
  { label: 'OG 1200×630', size: { width: 1200, height: 630 } },
];

/** Named linear-gradient background presets. */
export const BACKGROUND_GRADIENTS: readonly { label: string; colors: string[] }[] = [
  { label: 'Sunset', colors: ['#f59e0b', '#ec4899', '#7c3aed'] },
  { label: 'Ocean', colors: ['#0ea5e9', '#2563eb', '#1e3a8a'] },
  { label: 'Forest', colors: ['#84cc16', '#15803d', '#064e3b'] },
];

export interface AdjustChange {
  readonly key: AspFilter;
  readonly value: number;
}

/** Preset swatch colors offered for annotations (matches the design reference). */
export const ANNOTATION_COLORS: readonly string[] = [
  '#f1416c',
  '#009ef6',
  '#50cd89',
  '#181c32',
  '#ffffff',
];

/**
 * The right-hand contextual options panel. Presentational: it renders the
 * controls for the active tool and emits intent; the container applies changes
 * to the engine. Live slider drags emit `adjustInput`; the final value emits
 * `adjustCommit` (so a drag is one undo step, not dozens).
 */
@Component({
  selector: 'asp-options-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspIcon, AspColorField],
  templateUrl: './options-panel.html',
  styleUrl: './options-panel.css',
})
export class AspOptionsPanel {
  readonly activeTool = input.required<AspTool | null>();
  readonly toolTitle = input<string>('');

  // adjust
  readonly adjustmentDefs = input<readonly FilterMeta[]>([]);
  readonly adjustments = input<Readonly<Record<string, number>>>({});

  // filters (looks)
  readonly lookDefs = input<readonly FilterMeta[]>([]);
  readonly activeLook = input<AspFilter | null>(null);

  // crop
  readonly aspectPresets = input<readonly AspAspectPreset[]>([]);
  readonly activeCrop = input<AspAspectPreset>('free');
  readonly aspectRatios = input<readonly AspAspectOption[]>([]);
  readonly activeAspectLabel = input<string>('');

  // transform
  readonly straighten = input<number>(0);

  // annotate
  readonly annotationColor = input<string>(ANNOTATION_COLORS[0]);
  readonly annotationWidth = input<number>(4);
  readonly fontSize = input<number>(28);
  readonly fonts = input<readonly FontOption[]>([]);
  readonly activeFont = input<string>('');
  /** Google font family names offered as autocomplete in the "add font" box. */
  readonly googleFonts = input<readonly string[]>([]);
  readonly textBold = input<boolean>(false);
  readonly textItalic = input<boolean>(false);
  readonly textUnderline = input<boolean>(false);
  readonly textStrike = input<boolean>(false);
  readonly textAlign = input<string>('left');
  readonly lineHeight = input<number>(1.16);
  readonly letterSpacing = input<number>(0);
  readonly redactMode = input<RedactMode>('pixelate');

  readonly frameOptions = input<readonly FrameOption[]>(FRAME_OPTIONS);
  readonly activeFrame = input<string>('none');

  readonly resetRequested = output<void>();
  readonly adjustInput = output<AdjustChange>();
  readonly adjustCommit = output<AdjustChange>();
  readonly selectLook = output<AspFilter | null>();
  readonly selectCrop = output<AspAspectPreset>();
  readonly selectCustomCrop = output<AspAspectOption>();
  readonly rotate = output<number>();
  readonly flip = output<'h' | 'v'>();
  readonly straightenInput = output<number>();
  readonly straightenCommit = output<number>();
  readonly addShape = output<ShapeKind>();
  readonly addText = output<string>();
  readonly fontChange = output<string>();
  /** Add + apply a custom Google font family by name. */
  readonly addFont = output<string>();
  readonly toggleBold = output<void>();
  readonly toggleItalic = output<void>();
  readonly toggleUnderline = output<void>();
  readonly toggleStrike = output<void>();
  readonly textAlignChange = output<string>();
  readonly lineHeightChange = output<number>();
  readonly letterSpacingChange = output<number>();
  readonly textBgChange = output<string>();
  readonly redactModeChange = output<RedactMode>();
  readonly applyRedaction = output<void>();
  readonly annotationColorChange = output<string>();
  /** Live size change (slider drag) — apply without committing history. */
  readonly sizeInput = output<number>();
  /** Final size change (slider release) — commit to history. */
  readonly sizeCommit = output<number>();
  readonly selectFrame = output<string>();
  /** Switch the Color panel sub-tool (Adjust ⟷ Filters tabs). */
  readonly requestTool = output<AspTool>();
  /** Fill color for the selected shape. */
  readonly fillChange = output<string>();
  readonly setBackgroundColor = output<string>();
  readonly setBackgroundGradient = output<string[]>();
  readonly setBackgroundImageFile = output<File>();
  /** Current artboard size (null = full canvas), and changes to it. */
  readonly artboard = input<ArtboardSize | null>(null);
  readonly artboardChange = output<ArtboardSize | null>();

  protected readonly colors = ANNOTATION_COLORS;
  /** Shape-fill swatches — includes transparent (no fill). */
  protected readonly fillColors: readonly string[] = ['transparent', ...ANNOTATION_COLORS];
  protected readonly backgroundColors = BACKGROUND_COLORS;
  protected readonly backgroundGradients = BACKGROUND_GRADIENTS;
  protected readonly artboardPresets = ARTBOARD_PRESETS;
  protected readonly textValue = signal('Add a label');
  protected readonly customFontValue = signal('');
  protected readonly customW = signal('1080');
  protected readonly customH = signal('1080');

  /** True when the given preset is the active artboard (exact W×H match). */
  protected isArtboardActive(size: ArtboardSize): boolean {
    const a = this.artboard();
    return a !== null && a.width === size.width && a.height === size.height;
  }

  protected onCustomW(event: Event): void {
    this.customW.set((event.target as HTMLInputElement).value);
  }

  protected onCustomH(event: Event): void {
    this.customH.set((event.target as HTMLInputElement).value);
  }

  /** Apply the custom width/height, clamped to a sane 1–10000px range. */
  protected applyCustomArtboard(): void {
    const w = Math.round(Number(this.customW()));
    const h = Math.round(Number(this.customH()));
    if (Number.isFinite(w) && Number.isFinite(h) && w >= 1 && h >= 1 && w <= 10000 && h <= 10000) {
      this.artboardChange.emit({ width: w, height: h });
    }
  }

  protected onTextInput(event: Event): void {
    this.textValue.set((event.target as HTMLInputElement).value);
  }

  protected onCustomFontInput(event: Event): void {
    this.customFontValue.set((event.target as HTMLInputElement).value);
  }

  protected onAddFont(): void {
    const name = this.customFontValue().trim();
    if (name.length > 0) {
      this.addFont.emit(name);
      this.customFontValue.set('');
    }
  }

  protected onAddText(): void {
    const text = this.textValue().trim();
    this.addText.emit(text.length > 0 ? text : 'Text');
  }

  protected readonly kind = computed<PanelKind>(() => {
    const tool = this.activeTool();
    if (tool === null) {
      return 'none';
    }
    switch (tool) {
      case 'adjust':
      case 'filters':
        return 'color';
      case 'crop':
      case 'rotate':
      case 'straighten':
      case 'flip':
      case 'resize':
        return 'transform';
      case 'frame':
        return 'frame';
      case 'background':
        return 'background';
      case 'select':
        return 'select';
      case 'pen':
      case 'highlighter':
      case 'eraser':
      case 'shapes':
      case 'arrow':
      case 'line':
      case 'text':
      case 'sticker':
      case 'redact':
        return 'annotate';
      default:
        return 'none';
    }
  });

  protected readonly isColorFilters = computed(() => this.activeTool() === 'filters');

  protected readonly isText = computed(() => this.activeTool() === 'text');
  protected readonly isShape = computed(() => this.activeTool() === 'shapes');
  protected readonly isRedact = computed(() => this.activeTool() === 'redact');

  protected readonly strokeLabel = computed(() => (this.isText() ? 'Font size' : 'Thickness'));
  protected readonly sizeValue = computed(() => (this.isText() ? this.fontSize() : this.annotationWidth()));
  protected readonly sizeMin = computed(() => (this.isText() ? 8 : 1));
  protected readonly sizeMax = computed(() => (this.isText() ? 120 : 48));

  protected displayValue(def: FilterMeta): string {
    const value = this.adjustments()[def.key] ?? def.defaultValue ?? 0;
    if (def.unit) {
      return `${value}${def.unit}`;
    }
    return String(value);
  }

  protected valueOf(def: FilterMeta): number {
    return this.adjustments()[def.key] ?? def.defaultValue ?? 0;
  }

  protected onAdjustInput(def: FilterMeta, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.adjustInput.emit({ key: def.key, value });
  }

  protected onAdjustCommit(def: FilterMeta, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.adjustCommit.emit({ key: def.key, value });
  }

  protected onStraightenInput(event: Event): void {
    this.straightenInput.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onStraightenCommit(event: Event): void {
    this.straightenCommit.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onFontChange(event: Event): void {
    this.fontChange.emit((event.target as HTMLSelectElement).value);
  }

  protected onLineHeight(event: Event): void {
    this.lineHeightChange.emit(Number((event.target as HTMLInputElement).value) / 100);
  }

  protected onLetterSpacing(event: Event): void {
    this.letterSpacingChange.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onBackgroundImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setBackgroundImageFile.emit(file);
    }
    input.value = '';
  }

  protected onSizeInput(event: Event): void {
    this.sizeInput.emit(Number((event.target as HTMLInputElement).value));
  }

  protected onSizeCommit(event: Event): void {
    this.sizeCommit.emit(Number((event.target as HTMLInputElement).value));
  }
}
