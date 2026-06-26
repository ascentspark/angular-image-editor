import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AspImageEditor,
  AspImageEditorDialog,
  aspectOption,
  type AspAspectOption,
  type AspExportFormat,
  type AspMode,
  type AspThemeMode,
  type AspTool,
} from '@ascentsparksoftware/angular-image-editor';

const CUSTOM_RAIL: AspTool[] = ['crop', 'rotate', 'text', 'filters'];
const DISABLED_SET: AspTool[] = ['filters', 'frame', 'redact'];

interface ThemePreset {
  readonly label: string;
  readonly base: string;
  readonly accent: string;
}

/**
 * The landing page: an interactive playground for the editor. Live controls drive
 * the editor's mode, theme, size and tool set, and a "Show code" modal mirrors the
 * exact component snippet. The editor itself mounts on the client (`@defer`) so the
 * route still prerenders to clean HTML.
 */
@Component({
  selector: 'demo-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspImageEditor, RouterLink],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  protected readonly presets: readonly ThemePreset[] = [
    { label: 'Default blue', base: '#f4f6f9', accent: '#1f6feb' },
    { label: 'Wazure navy', base: '#f4f6f9', accent: '#02375e' },
    { label: 'Warm orange', base: '#fff7ed', accent: '#ea580c' },
    { label: 'Forest green', base: '#f0fdf4', accent: '#16a34a' },
    { label: 'Royal purple', base: '#faf5ff', accent: '#7c3aed' },
  ];

  protected readonly editorModes: readonly AspMode[] = ['viewer', 'basic', 'advanced', 'full'];
  protected readonly allFormats: AspExportFormat[] = ['png', 'jpeg', 'webp', 'svg', 'pdf', 'json'];

  protected readonly sizePresets: readonly { label: string; value: string }[] = [
    { label: '70vh', value: '70vh' },
    { label: '600px', value: '600px' },
    { label: '520px', value: '520px' },
    { label: '460px (min)', value: '460px' },
  ];

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
  protected readonly editorHeight = signal('600px');

  protected readonly codeOpen = signal(false);
  protected readonly codeCopied = signal(false);

  protected toggleCustomRail(): void {
    this.customTools.update((t) => (t ? null : [...CUSTOM_RAIL]));
  }

  protected toggleDisabled(): void {
    this.disabled.update((d) => (d.length ? [] : [...DISABLED_SET]));
  }

  protected setHeight(value: string): void {
    this.editorHeight.set(value);
  }

  protected toggleCode(): void {
    this.codeOpen.update((v) => !v);
    this.codeCopied.set(false);
  }

  /** Live Angular snippet that renders the editor with the current demo options. */
  protected readonly codeSnippet = computed(() => {
    const tools = this.customTools();
    const disabled = this.disabled();
    const arr = (xs: readonly string[]): string => `[${xs.map((x) => `'${x}'`).join(', ')}]`;

    const attrs: string[] = [
      `  mode="${this.editorMode()}"`,
      `  baseColor="${this.base()}"`,
      `  accentColor="${this.accent()}"`,
      `  themeMode="${this.themeMode()}"`,
      `  height="${this.editorHeight()}"`,
      `  [exportFormats]="${arr(this.allFormats)}"`,
    ];
    if (tools) {
      attrs.push(`  [tools]="${arr(tools)}"`);
    }
    if (disabled.length) {
      attrs.push(`  [disabledTools]="${arr(disabled)}"`);
    }
    attrs.push(`  (saved)="onSaved($event)"`);

    return [
      `// Use it in a standalone component`,
      `import { Component } from '@angular/core';`,
      `import { AspImageEditor } from '@ascentsparksoftware/angular-image-editor';`,
      ``,
      `@Component({`,
      `  selector: 'app-editor',`,
      `  imports: [AspImageEditor],`,
      `  template: \``,
      `    <asp-image-editor`,
      ...attrs.map((a) => `    ${a}`),
      `    />\`,`,
      `})`,
      `export class EditorComponent {`,
      `  onSaved(blob: Blob) {`,
      `    // the edited image — upload it, preview it, etc.`,
      `    console.log('saved', blob.type, blob.size);`,
      `  }`,
      `}`,
    ].join('\n');
  });

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codeSnippet());
      this.codeCopied.set(true);
    } catch {
      this.codeCopied.set(false);
    }
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
    this.lastResult.set(`saved ${blob.type} (${blob.size} bytes)`);
  }
}
