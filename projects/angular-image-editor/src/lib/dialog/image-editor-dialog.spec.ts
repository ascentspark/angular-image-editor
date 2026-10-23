import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AspImageEditor } from '../ui/image-editor/image-editor';
import {
  AspImageEditorDialog,
  DIALOG_FORWARDED_INPUTS,
  resolveDialogInputs,
  type OpenImageEditorConfig,
} from './image-editor-dialog';

/**
 * A config with EVERY forwardable key set. `Required<>` makes adding a key to
 * the config type without adding it here a compile error, so the test below
 * can never silently skip a new input.
 */
const FULL_CONFIG: Required<Omit<OpenImageEditorConfig, 'width' | 'maxWidth' | 'height'>> = {
  src: 'data:image/png;base64,',
  mode: 'advanced',
  chrome: 'dialog',
  tools: ['crop', 'rotate'],
  disabledTools: ['rotate'],
  filters: ['brightness'],
  heading: 'Pick a logo',
  baseColor: '#ffffff',
  accentColor: '#ff4806',
  themeMode: 'dark',
  aspectPresets: ['1:1'],
  initialAspect: '1:1',
  aspectRatios: [{ label: 'Wide', ratio: 3 }],
  fitMode: 'contain',
  exportFormats: ['png'],
  exportQuality: 80,
  exportTarget: { width: 512, height: 512 },
  exportBackground: '#ffffff',
  commitLabel: 'Use this logo',
  showCommit: true,
  showDownload: false,
  showHistory: false,
  keyboardEnabled: false,
  fonts: [{ label: 'Inter', value: 'Inter' }],
};

describe('resolveDialogInputs', () => {
  it('dialog_forwards_every_declared_input', () => {
    const forwarded = new Map(resolveDialogInputs(FULL_CONFIG));
    for (const key of Object.keys(FULL_CONFIG) as (keyof typeof FULL_CONFIG)[]) {
      expect(forwarded.get(key), `config.${key} must reach the editor`).toEqual(FULL_CONFIG[key]);
    }
    expect(DIALOG_FORWARDED_INPUTS).toHaveLength(Object.keys(FULL_CONFIG).length);
  });

  it('defaults to the basic crop dialog with the stock theme when nothing is set', () => {
    const forwarded = new Map(resolveDialogInputs({}));
    expect(forwarded.get('mode')).toBe('basic');
    expect(forwarded.get('heading')).toBe('Edit image');
    expect(forwarded.get('themeMode')).toBe('light');
    expect(forwarded.has('fitMode')).toBe(false);
    expect(forwarded.has('chrome')).toBe(false);
  });

  it('forwards an explicit null (e.g. chrome: null) but skips undefined', () => {
    const forwarded = new Map(resolveDialogInputs({ chrome: null, exportTarget: undefined }));
    expect(forwarded.has('chrome')).toBe(true);
    expect(forwarded.get('chrome')).toBeNull();
    expect(forwarded.has('exportTarget')).toBe(false);
  });

  it('every forwarded name is a real input of AspImageEditor', async () => {
    await TestBed.configureTestingModule({ imports: [AspImageEditor] }).compileComponents();
    const fixture = TestBed.createComponent(AspImageEditor);
    // setInput throws NG0303 for a name the component does not declare.
    for (const [name, value] of resolveDialogInputs(FULL_CONFIG)) {
      expect(() => fixture.componentRef.setInput(name, value), name).not.toThrow();
    }
    fixture.destroy();
  });
});

describe('AspImageEditorDialog', () => {
  let opener: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('labels the modal, traps focus inside it, and restores focus to the opener on Escape', async () => {
    const dialog = TestBed.inject(AspImageEditorDialog);
    const result = dialog.open({ heading: 'Crop avatar' });
    const scrim = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(scrim).not.toBeNull();
    expect(scrim?.getAttribute('aria-modal')).toBe('true');
    expect(scrim?.getAttribute('aria-label')).toBe('Crop avatar');
    // Focus moved off the opener and into the modal.
    expect(document.activeElement).not.toBe(opener);
    expect(scrim?.contains(document.activeElement)).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(result).resolves.toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('sizes the card for the chrome it opens: hugging card for the dialog, roomy for the workspace', async () => {
    const dialog = TestBed.inject(AspImageEditorDialog);
    const basic = dialog.open({});
    const basicCard = document.querySelector<HTMLElement>('[role="dialog"] > div');
    expect(basicCard?.style.width).toBe('520px');
    expect(basicCard?.style.height).toBe('auto');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await basic;

    const workspace = dialog.open({ mode: 'advanced', width: 900, height: '80vh' });
    const wsCard = document.querySelector<HTMLElement>('[role="dialog"] > div');
    expect(wsCard?.style.width).toBe('900px');
    expect(wsCard?.style.height).toBe('80vh');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await workspace;
  });
});
