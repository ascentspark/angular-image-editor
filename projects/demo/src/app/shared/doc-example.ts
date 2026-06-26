import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** A single source snippet shown in the example's code panel. */
export interface ExampleSource {
  label: string;
  code: string;
  lang?: 'ts' | 'html' | 'bash' | 'scss';
}

/**
 * Reusable doc example: a titled section with a live demo (projected content) and
 * a tabbed, copy-to-clipboard source panel, so the result and its exact source
 * sit together. `anchor` sets the section id for the page's "on this page" links.
 */
@Component({
  selector: 'demo-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ex" [id]="anchor()">
      <header class="ex__head">
        <div class="ex__titlerow">
          <h2 class="ex__title">{{ title() }}</h2>
          @if (docsUrl()) {
            <a class="ex__docs" [href]="docsUrl()" target="_blank" rel="noopener">Docs ↗</a>
          }
        </div>
        @if (description()) {
          <p class="ex__desc">{{ description() }}</p>
        }
      </header>

      <div class="ex__live">
        <ng-content />
      </div>

      @if (sources().length) {
        <div class="ex__code">
          <div class="ex__tabs" role="tablist">
            @for (s of sources(); track s.label; let i = $index) {
              <button
                type="button"
                role="tab"
                class="ex__tab"
                [class.ex__tab--active]="active() === i"
                [attr.aria-selected]="active() === i"
                (click)="active.set(i)"
              >
                {{ s.label }}
              </button>
            }
            <button type="button" class="ex__copy" (click)="copy()">
              {{ copied() ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <pre
            class="ex__pre"
          ><code [attr.data-lang]="current().lang">{{ current().code }}</code></pre>
        </div>
      }
    </section>
  `,
  styles: `
    .ex {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-xs);
      margin-bottom: 1.8rem;
      scroll-margin-top: 70px;
    }
    .ex__head {
      padding: 1.2rem 1.4rem 0.4rem;
    }
    .ex__titlerow {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .ex__title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .ex__docs {
      flex: none;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--accent);
      text-decoration: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      padding: 0.22rem 0.7rem;
      white-space: nowrap;
    }
    .ex__docs:hover {
      border-color: var(--accent);
    }
    .ex__desc {
      margin: 0.4rem 0 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .ex__live {
      padding: 1.2rem 1.4rem 1.4rem;
    }
    .ex__code {
      border-top: 1px solid var(--border);
      background: var(--footer-black);
    }
    .ex__tabs {
      display: flex;
      gap: 0.25rem;
      padding: 0.55rem 0.85rem 0;
      align-items: center;
    }
    .ex__tab {
      background: transparent;
      color: rgba(255, 255, 255, 0.55);
      border: none;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      padding: 0.4rem 0.85rem;
      font-size: 0.78rem;
      cursor: pointer;
      font-family: var(--font-mono);
    }
    .ex__tab:hover {
      color: #fff;
    }
    .ex__tab--active {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    .ex__tab--active::after {
      content: '';
      display: block;
      height: 2px;
      margin-top: 0.4rem;
      background: var(--accent);
    }
    .ex__copy {
      margin-left: auto;
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: var(--radius-pill);
      padding: 0.3rem 0.85rem;
      font-family: var(--font-primary);
      font-size: 0.72rem;
      cursor: pointer;
    }
    .ex__copy:hover {
      border-color: var(--accent);
      color: #fff;
    }
    .ex__pre {
      margin: 0;
      padding: 1.1rem 1.4rem;
      overflow-x: auto;
      color: #e6e6e6;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      line-height: 1.6;
    }
    .ex__pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: inherit;
    }
  `,
})
export class DocExample {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly sources = input<ExampleSource[]>([]);
  readonly docsUrl = input<string>('');
  readonly anchor = input<string>('');

  protected readonly active = signal(0);
  protected readonly copied = signal(false);
  protected readonly current = computed(
    () => this.sources()[this.active()] ?? { label: '', code: '', lang: undefined },
  );

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.current().code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context). Ignore silently.
    }
  }
}
