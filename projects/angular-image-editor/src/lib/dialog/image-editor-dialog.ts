import {
  ApplicationRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
} from '@angular/core';

import { AspImageEditor } from '../ui/image-editor/image-editor';
import type { FontOption } from '../ui/image-editor/fonts';
import type { AspThemeMode } from '../theme/derive-theme';
import {
  defaultChromeFor,
  type AspAspectOption,
  type AspAspectPreset,
  type AspChrome,
  type AspCropFrame,
  type AspExportFormat,
  type AspExportTarget,
  type AspFilter,
  type AspFitMode,
  type AspInitialAspect,
  type AspMode,
  type AspSize,
  type AspTool,
} from '../types/editor.types';
import { createFocusTrap } from './focus-trap';

/**
 * Options for {@link AspImageEditorDialog.open} / {@link openImageEditor}.
 *
 * Every editor input the dialog can meaningfully forward is here under its
 * input's name — `mode` defaults to `'basic'`, everything else to the editor's
 * own default when unset. `width` / `maxWidth` / `height` size the card.
 */
export interface OpenImageEditorConfig {
  readonly src?: string | Blob | null;
  /** Baseline preset. Defaults to `'basic'` (the compact crop dialog). */
  readonly mode?: AspMode;
  /** Chrome override — e.g. `'workspace'` to open the full editor in the modal. */
  readonly chrome?: AspChrome | null;
  readonly tools?: AspTool[] | null;
  readonly disabledTools?: AspTool[];
  readonly filters?: AspFilter[] | 'all' | null;
  readonly heading?: string;
  readonly baseColor?: string;
  readonly accentColor?: string;
  readonly themeMode?: AspThemeMode;
  readonly aspectPresets?: AspAspectPreset[];
  /** Aspect the crop opens constrained to — `'1:1'` for an avatar, or `aspectOption(1200, 630)`. */
  readonly initialAspect?: AspInitialAspect;
  readonly aspectRatios?: AspAspectOption[];
  /** `'movable'` puts the editing crop (drag the frame) in the dialog; `'fixed'` the slot crop anywhere. */
  readonly cropFrame?: AspCropFrame | null;
  /** `'contain'` lets an image of any aspect zoom out to fit the crop frame (logo crop). */
  readonly fitMode?: AspFitMode;
  readonly exportFormats?: AspExportFormat[];
  readonly exportQuality?: number;
  readonly exportTarget?: AspExportTarget | null;
  readonly exportBackground?: string | null;
  /** Label of the commit button, e.g. `'Use this logo'`. */
  readonly commitLabel?: string | null;
  readonly showCommit?: boolean;
  readonly showDownload?: boolean;
  readonly showHistory?: boolean;
  readonly keyboardEnabled?: boolean;
  readonly fonts?: FontOption[];
  /** Card width. Defaults to 520px for the dialog chrome, `min(1100px, 100%)` otherwise. */
  readonly width?: AspSize;
  /** Card max-width. Defaults to `100%` of the scrim's padded area. */
  readonly maxWidth?: AspSize;
  /** Card height. Defaults to content height for the dialog chrome, `min(720px, 100vh - 48px)` otherwise. */
  readonly height?: AspSize;
}

/** Config keys that are forwarded verbatim to the editor input of the same name. */
type ForwardedInput = Exclude<keyof OpenImageEditorConfig, 'width' | 'maxWidth' | 'height'>;

/**
 * Every forwarded input, so the forwarding loop and the test that guards it
 * share one list. `satisfies` keeps the list honest against the config type.
 */
export const DIALOG_FORWARDED_INPUTS = [
  'src',
  'mode',
  'chrome',
  'tools',
  'disabledTools',
  'filters',
  'heading',
  'baseColor',
  'accentColor',
  'themeMode',
  'aspectPresets',
  'initialAspect',
  'aspectRatios',
  'cropFrame',
  'fitMode',
  'exportFormats',
  'exportQuality',
  'exportTarget',
  'exportBackground',
  'commitLabel',
  'showCommit',
  'showDownload',
  'showHistory',
  'keyboardEnabled',
  'fonts',
] as const satisfies readonly ForwardedInput[];

/** Input name → value pairs to set on the editor for `config` (unset keys are skipped). */
export function resolveDialogInputs(
  config: OpenImageEditorConfig,
): readonly (readonly [ForwardedInput, unknown])[] {
  const withDefaults: OpenImageEditorConfig = {
    mode: 'basic',
    heading: 'Edit image',
    baseColor: '#f4f6f9',
    accentColor: '#1f6feb',
    themeMode: 'light',
    ...config,
  };
  return DIALOG_FORWARDED_INPUTS.filter((key) => withDefaults[key] !== undefined).map(
    (key) => [key, withDefaults[key]] as const,
  );
}

/** Resolve a card size: a number is px, a string is a CSS length. */
function cssSize(value: AspSize | undefined, fallback: string): string {
  if (value === undefined || value === '') {
    return fallback;
  }
  return typeof value === 'number' ? `${value}px` : value;
}

/** The chrome the dialog will render, which decides the card's default size. */
function chromeOf(config: OpenImageEditorConfig): AspChrome {
  return config.chrome ?? defaultChromeFor(config.mode ?? 'basic');
}

/**
 * Opens the editor in a modal overlay and resolves with the committed image
 * Blob, or `null` if the user cancels (close button, scrim click, or Escape).
 * The overlay traps Tab focus and returns focus to the opener on close.
 * Implemented without @angular/cdk so the package stays dependency-light.
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
      scrim.setAttribute('aria-label', config.heading ?? 'Edit image');
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

      const isDialogChrome = chromeOf(config) === 'dialog';
      const card = document.createElement('div');
      card.style.width = cssSize(config.width, isDialogChrome ? '520px' : 'min(1100px, 100%)');
      card.style.maxWidth = cssSize(config.maxWidth, '100%');
      card.style.height = cssSize(config.height, isDialogChrome ? 'auto' : 'min(720px, calc(100vh - 48px))');
      card.style.maxHeight = 'calc(100vh - 48px)';
      card.style.boxShadow = '0 30px 80px rgba(0, 0, 0, 0.4)';
      card.style.borderRadius = '14px';
      card.style.overflow = 'hidden';
      card.style.outline = 'none';
      scrim.appendChild(card);
      document.body.appendChild(scrim);

      const ref = createComponent(AspImageEditor, {
        environmentInjector: this.environmentInjector,
        hostElement: card,
      });
      for (const [name, value] of resolveDialogInputs(config)) {
        ref.setInput(name, value);
      }

      this.appRef.attachView(ref.hostView);
      const trap = createFocusTrap(card);
      trap.activate();

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
        trap.deactivate();
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
