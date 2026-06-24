import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { AspIcon } from '../../icons/asp-icon';
import type { RedactMode, ShapeKind } from '../../engine/editor-engine';
import type { FilterMeta } from '../../registry/tool-registry';
import type { AspAspectPreset, AspFilter, AspTool } from '../../types/editor.types';

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
  | 'adjust'
  | 'filters'
  | 'crop'
  | 'transform'
  | 'annotate'
  | 'frame'
  | 'object'
  | 'none';

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
  imports: [AspIcon],
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

  // transform
  readonly straighten = input<number>(0);

  // annotate
  readonly annotationColor = input<string>(ANNOTATION_COLORS[0]);
  readonly annotationWidth = input<number>(4);

  readonly frameOptions = input<readonly FrameOption[]>(FRAME_OPTIONS);
  readonly activeFrame = input<string>('none');

  readonly resetRequested = output<void>();
  readonly adjustInput = output<AdjustChange>();
  readonly adjustCommit = output<AdjustChange>();
  readonly selectLook = output<AspFilter | null>();
  readonly selectCrop = output<AspAspectPreset>();
  readonly rotate = output<number>();
  readonly flip = output<'h' | 'v'>();
  readonly straightenInput = output<number>();
  readonly straightenCommit = output<number>();
  readonly addShape = output<ShapeKind>();
  readonly addText = output<string>();
  readonly addRedaction = output<RedactMode>();
  readonly annotationColorChange = output<string>();
  readonly annotationWidthChange = output<number>();
  readonly selectFrame = output<string>();
  readonly deleteSelection = output<void>();

  protected readonly colors = ANNOTATION_COLORS;
  protected readonly textValue = signal('Add a label');

  protected onTextInput(event: Event): void {
    this.textValue.set((event.target as HTMLInputElement).value);
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
        return 'adjust';
      case 'filters':
        return 'filters';
      case 'crop':
        return 'crop';
      case 'rotate':
      case 'straighten':
      case 'flip':
        return 'transform';
      case 'frame':
      case 'background':
        return 'frame';
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
        return 'object';
    }
  });

  protected readonly isText = computed(() => this.activeTool() === 'text');
  protected readonly isShape = computed(() => this.activeTool() === 'shapes');
  protected readonly isRedact = computed(() => this.activeTool() === 'redact');

  protected readonly strokeLabel = computed(() => (this.isText() ? 'Font size' : 'Thickness'));

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

  protected onWidthInput(event: Event): void {
    this.annotationWidthChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
