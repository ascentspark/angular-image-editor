import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * A color chooser: preset swatches plus a custom-color control (the native OS
 * picker). Used everywhere a color is set — draw, shapes (stroke + fill), text,
 * arrows, frame, background. Emits the chosen color string on selection.
 */
@Component({
  selector: 'asp-color-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-field.html',
  styleUrl: './color-field.css',
})
export class AspColorField {
  /** Preset swatches. `'transparent'` renders a checker swatch. */
  readonly colors = input.required<readonly string[]>();
  /** Currently selected color. */
  readonly value = input<string>('');
  readonly colorChange = output<string>();

  /** A valid `#rrggbb` for the native picker (falls back to black for non-hex values). */
  protected readonly pickerValue = computed(() => {
    const v = this.value();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000';
  });

  protected onPick(event: Event): void {
    this.colorChange.emit((event.target as HTMLInputElement).value);
  }
}
