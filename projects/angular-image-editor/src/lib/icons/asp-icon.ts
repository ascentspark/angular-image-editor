import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

import { LUCIDE_ICONS } from './lucide-icons';

/**
 * Renders one of the baked-in Lucide icons as an inline SVG.
 *
 * The icon name may be given bare (`'crop'`) or prefixed (`'lucide:crop'`, as the
 * tool registry stores it). The inner markup comes only from {@link LUCIDE_ICONS}
 * — a closed set of trusted constants, never user input — so passing it through
 * the sanitizer's bypass is safe and Trusted-Types compatible. Unknown names
 * render nothing (and warn in dev) rather than throwing.
 */
@Component({
  selector: 'asp-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    [innerHTML]="inner()"
  ></svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
    `,
  ],
})
export class AspIcon {
  /** Lucide icon name, with or without a `lucide:` prefix. */
  readonly name = input.required<string>();
  /** Rendered width/height in px. */
  readonly size = input<number>(20);

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly inner = computed<SafeHtml>(() => {
    const key = this.name().replace(/^lucide:/, '');
    const markup = LUCIDE_ICONS[key];
    if (markup === undefined) {
      console.warn(`[asp-image-editor] unknown icon: "${key}"`);
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    return this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
