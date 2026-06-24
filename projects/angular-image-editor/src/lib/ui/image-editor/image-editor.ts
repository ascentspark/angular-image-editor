import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';

import { applyTheme } from '../../theme/apply-theme';
import { deriveTheme, type AspThemeMode } from '../../theme/derive-theme';

const FALLBACK_BASE = '#f4f6f9';
const FALLBACK_ACCENT = '#1f6feb';

/**
 * Root entry component for the image editor (`<asp-image-editor>`).
 *
 * Phase 1 wires the three theming inputs through {@link deriveTheme} and applies
 * the resulting `--asp-*` tokens to the host element. The body is still a
 * temporary palette preview — the rail/canvas/panel UI and the full
 * inputs/outputs contract land in later phases (see docs/plans/00-master-plan.md).
 */
@Component({
  selector: 'asp-image-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.css',
})
export class AspImageEditor {
  /** Neutral anchor color (hex). Surfaces, ink, and lines are tinted toward it. */
  readonly baseColor = input<string>(FALLBACK_BASE);
  /** Interactive accent color (hex). Drives buttons, active tool, focus ring. */
  readonly accentColor = input<string>(FALLBACK_ACCENT);
  /** `'light'` or `'dark'` derivation. */
  readonly themeMode = input<AspThemeMode>('light');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * The resolved theme. Invalid hex inputs are a developer error; rather than
   * throwing and breaking the host app, we fall back to the default palette
   * (keeping the requested mode) and warn once.
   */
  protected readonly theme = computed(() => {
    try {
      return deriveTheme(this.baseColor(), this.accentColor(), this.themeMode());
    } catch (error) {
      console.warn('[asp-image-editor] invalid theme color, using defaults:', error);
      return deriveTheme(FALLBACK_BASE, FALLBACK_ACCENT, this.themeMode());
    }
  });

  constructor() {
    effect(() => applyTheme(this.host.nativeElement, this.theme()));
  }
}
