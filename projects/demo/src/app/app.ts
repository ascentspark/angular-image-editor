import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AspImageEditor,
  AspImageEditorDialog,
  aspectOption,
  type AspAspectOption,
  type AspExportFormat,
  type AspMode,
  type AspThemeMode,
  type AspTool,
} from '@ascentspark/angular-image-editor';

const CUSTOM_RAIL: AspTool[] = ['crop', 'rotate', 'text', 'filters'];
const DISABLED_SET: AspTool[] = ['filters', 'frame', 'redact'];

interface ThemePreset {
  readonly label: string;
  readonly base: string;
  readonly accent: string;
}

@Component({
  selector: 'demo-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspImageEditor],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly presets: readonly ThemePreset[] = [
    { label: 'Default blue', base: '#f4f6f9', accent: '#1f6feb' },
    { label: 'Wazure navy', base: '#f4f6f9', accent: '#02375e' },
    { label: 'Warm orange', base: '#fff7ed', accent: '#ea580c' },
    { label: 'Forest green', base: '#f0fdf4', accent: '#16a34a' },
    { label: 'Royal purple', base: '#faf5ff', accent: '#7c3aed' },
  ];

  protected readonly editorModes: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];
  protected readonly allFormats: AspExportFormat[] = ['png', 'jpeg', 'webp', 'svg', 'pdf', 'json'];

  // CMS-style custom crop targets, built from exact pixel dimensions.
  protected readonly cmsAspects: AspAspectOption[] = [
    aspectOption(1200, 630, 'OG 1200×630'),
    aspectOption(1080, 1080, 'Square 1080'),
    aspectOption(1920, 1080, 'HD 16:9'),
  ];

  private readonly dialog = inject(AspImageEditorDialog);

  protected readonly base = signal(this.presets[0].base);
  protected readonly accent = signal(this.presets[0].accent);
  protected readonly themeMode = signal<AspThemeMode>('light');
  protected readonly editorMode = signal<AspMode>('advanced');
  protected readonly lastResult = signal('');
  protected readonly customTools = signal<AspTool[] | null>(null);
  protected readonly disabled = signal<AspTool[]>([]);

  protected toggleCustomRail(): void {
    this.customTools.update((t) => (t ? null : [...CUSTOM_RAIL]));
  }

  protected toggleDisabled(): void {
    this.disabled.update((d) => (d.length ? [] : [...DISABLED_SET]));
  }

  protected async openDialog(): Promise<void> {
    const blob = await this.dialog.open({
      heading: 'Update profile photo',
      baseColor: this.base(),
      accentColor: this.accent(),
      themeMode: this.themeMode(),
      aspectPresets: ['1:1', '4:3', 'free'],
    });
    this.lastResult.set(blob ? `saved ${blob.type} (${blob.size} bytes)` : 'canceled');
  }

  protected applyPreset(preset: ThemePreset): void {
    this.base.set(preset.base);
    this.accent.set(preset.accent);
  }

  protected toggleMode(): void {
    this.themeMode.update((m) => (m === 'light' ? 'dark' : 'light'));
  }

  protected setEditorMode(mode: AspMode): void {
    this.editorMode.set(mode);
  }

  protected onBaseInput(event: Event): void {
    this.base.set((event.target as HTMLInputElement).value);
  }

  protected onAccentInput(event: Event): void {
    this.accent.set((event.target as HTMLInputElement).value);
  }

  protected onSaved(blob: Blob): void {
    console.info('[demo] saved blob', blob.type, blob.size, 'bytes');
  }
}
