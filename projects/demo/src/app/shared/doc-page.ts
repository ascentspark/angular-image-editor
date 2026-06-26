import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One entry in a page's "on this page" anchor list. */
export interface PageSection {
  id: string;
  label: string;
}

/**
 * Shared chrome for a documentation page: the single `<h1>`, a lead paragraph, an
 * "on this page" anchor list, and the projected content (the page's doc-example
 * blocks). Keeps every section page visually consistent.
 */
@Component({
  selector: 'demo-doc-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dp">
      <header class="dp__head">
        <h1 class="dp__title">{{ heading() }}</h1>
        <p class="dp__lead">{{ lead() }}</p>
      </header>

      @if (sections().length) {
        <nav class="dp__toc" aria-label="On this page">
          <span class="dp__toc-label">On this page</span>
          <ul>
            @for (s of sections(); track s.id) {
              <li><a [href]="'#' + s.id">{{ s.label }}</a></li>
            }
          </ul>
        </nav>
      }

      <div class="dp__body">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .dp__head {
      margin-bottom: 1rem;
    }
    .dp__title {
      margin: 0 0 0.5rem;
      font-size: clamp(1.8rem, 3.5vw, 2.3rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .dp__lead {
      margin: 0;
      max-width: 65ch;
      color: var(--muted);
      font-size: 1.05rem;
      line-height: 1.6;
    }
    .dp__toc {
      margin: 1.2rem 0 1.8rem;
      padding: 0.9rem 1.1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .dp__toc-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.5rem;
    }
    .dp__toc ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 1rem;
    }
    .dp__toc a {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .dp__toc a:hover {
      text-decoration: underline;
    }
  `,
})
export class DocPage {
  readonly heading = input.required<string>();
  readonly lead = input<string>('');
  readonly sections = input<PageSection[]>([]);
}
