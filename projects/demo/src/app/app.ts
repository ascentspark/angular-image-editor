import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AspImageEditor, type AspMode, type AspThemeMode } from '@ascentspark/angular-image-editor';

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

  protected readonly base = signal(this.presets[0].base);
  protected readonly accent = signal(this.presets[0].accent);
  protected readonly themeMode = signal<AspThemeMode>('light');
  protected readonly editorMode = signal<AspMode>('advanced');

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
