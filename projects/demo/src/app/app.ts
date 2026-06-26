import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { NAV } from './nav';
import { AscGlyph } from './shared/asc-glyph';

/**
 * The docs-site shell: a branded header (with a light/dark toggle), a grouped
 * sidebar navigation, and the routed page outlet. The interactive editor and all
 * documentation live in the routed pages.
 */
@Component({
  selector: 'demo-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AscGlyph],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly nav = NAV;
  protected readonly dark = signal(false);

  constructor() {
    if (this.isBrowser) {
      const stored = localStorage.getItem('aie-docs-theme');
      this.setDark(stored === 'dark');
    }
  }

  protected toggleDark(): void {
    this.setDark(!this.dark());
  }

  private setDark(value: boolean): void {
    this.dark.set(value);
    this.doc.documentElement.classList.toggle('dark', value);
    if (this.isBrowser) {
      localStorage.setItem('aie-docs-theme', value ? 'dark' : 'light');
    }
  }
}
