import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AspImageEditor, type AspThemeMode } from '@ascentspark/angular-image-editor';
import { EngineHarness } from './engine-harness/engine-harness';

interface ThemePreset {
  readonly label: string;
  readonly base: string;
  readonly accent: string;
}

type DemoView = 'theme' | 'engine';

@Component({
  selector: 'demo-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspImageEditor, EngineHarness],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly view = signal<DemoView>('theme');

  protected setView(view: DemoView): void {
    this.view.set(view);
  }

  protected readonly presets: readonly ThemePreset[] = [
    { label: 'Default blue', base: '#f4f6f9', accent: '#1f6feb' },
    { label: 'Wazure navy', base: '#f4f6f9', accent: '#02375e' },
    { label: 'Warm orange', base: '#fff7ed', accent: '#ea580c' },
    { label: 'Forest green', base: '#f0fdf4', accent: '#16a34a' },
    { label: 'Royal purple', base: '#faf5ff', accent: '#7c3aed' },
  ];

  protected readonly base = signal(this.presets[0].base);
  protected readonly accent = signal(this.presets[0].accent);
  protected readonly mode = signal<AspThemeMode>('light');

  protected applyPreset(preset: ThemePreset): void {
    this.base.set(preset.base);
    this.accent.set(preset.accent);
  }

  protected toggleMode(): void {
    this.mode.update((m) => (m === 'light' ? 'dark' : 'light'));
  }

  protected onBaseInput(event: Event): void {
    this.base.set((event.target as HTMLInputElement).value);
  }

  protected onAccentInput(event: Event): void {
    this.accent.set((event.target as HTMLInputElement).value);
  }
}
