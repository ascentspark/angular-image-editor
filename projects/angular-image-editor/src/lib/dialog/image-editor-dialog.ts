import {
  ApplicationRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
} from '@angular/core';

import { AspImageEditor } from '../ui/image-editor/image-editor';
import type { AspThemeMode } from '../theme/derive-theme';
import type { AspAspectPreset, AspExportFormat } from '../types/editor.types';

/** Options for {@link AspImageEditorDialog.open} / {@link openImageEditor}. */
export interface OpenImageEditorConfig {
  readonly src?: string | Blob | null;
  readonly heading?: string;
  readonly baseColor?: string;
  readonly accentColor?: string;
  readonly themeMode?: AspThemeMode;
  readonly aspectPresets?: AspAspectPreset[];
  readonly exportFormats?: AspExportFormat[];
}

/**
 * Opens the editor's `basic` layout in a modal overlay and resolves with the
 * saved image Blob, or `null` if the user cancels (close button, scrim click,
 * or Escape). Implemented without @angular/cdk so the package stays dependency-light.
 */
@Injectable({ providedIn: 'root' })
export class AspImageEditorDialog {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  open(config: OpenImageEditorConfig = {}): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      const scrim = document.createElement('div');
      scrim.setAttribute('role', 'dialog');
      scrim.setAttribute('aria-modal', 'true');
      Object.assign(scrim.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
      } satisfies Partial<CSSStyleDeclaration>);

      const card = document.createElement('div');
      card.style.width = '520px';
      card.style.maxWidth = '100%';
      card.style.maxHeight = 'calc(100vh - 48px)';
      card.style.boxShadow = '0 30px 80px rgba(0, 0, 0, 0.4)';
      card.style.borderRadius = '14px';
      card.style.overflow = 'hidden';
      scrim.appendChild(card);
      document.body.appendChild(scrim);

      const ref = createComponent(AspImageEditor, {
        environmentInjector: this.environmentInjector,
        hostElement: card,
      });
      ref.setInput('mode', 'basic');
      ref.setInput('src', config.src ?? null);
      ref.setInput('heading', config.heading ?? 'Edit image');
      ref.setInput('baseColor', config.baseColor ?? '#f4f6f9');
      ref.setInput('accentColor', config.accentColor ?? '#1f6feb');
      ref.setInput('themeMode', config.themeMode ?? 'light');
      if (config.aspectPresets) {
        ref.setInput('aspectPresets', config.aspectPresets);
      }
      if (config.exportFormats) {
        ref.setInput('exportFormats', config.exportFormats);
      }

      this.appRef.attachView(ref.hostView);

      let settled = false;
      const subscriptions: { unsubscribe(): void }[] = [];
      const finish = (result: Blob | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        for (const sub of subscriptions) {
          sub.unsubscribe();
        }
        document.removeEventListener('keydown', onKeydown);
        this.appRef.detachView(ref.hostView);
        ref.destroy();
        scrim.remove();
        resolve(result);
      };

      const onKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          finish(null);
        }
      };
      scrim.addEventListener('mousedown', (event) => {
        if (event.target === scrim) {
          finish(null);
        }
      });
      document.addEventListener('keydown', onKeydown);

      subscriptions.push(ref.instance.saved.subscribe((blob: Blob) => finish(blob)));
      subscriptions.push(ref.instance.canceled.subscribe(() => finish(null)));
    });
  }
}
