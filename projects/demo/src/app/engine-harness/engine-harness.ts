import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { EditorEngine } from '@ascentsparksoftware/angular-image-editor';

/**
 * Phase 3 verification harness — exercises the EditorEngine directly so its
 * Fabric integration can be eyeballed via screenshots. This lives only in the
 * demo; the production UI (rail/panel/canvas) arrives in Phase 4.
 */
@Component({
  selector: 'demo-engine-harness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="harness">
      <div class="toolbar">
        <button type="button" (click)="rotate()">Rotate 90°</button>
        <button type="button" (click)="flip()">Flip H</button>
        <button type="button" (click)="zoom(25)">Zoom +</button>
        <button type="button" (click)="zoom(-25)">Zoom −</button>
        <button type="button" (click)="grayscale()">B&amp;W</button>
        <button type="button" (click)="sepia()">Sepia</button>
        <button type="button" (click)="brighten()">Brighten</button>
        <button type="button" (click)="crop()">Crop 1:1</button>
        <button type="button" (click)="addText()">Add text</button>
        <button type="button" (click)="addRect()">Add rect</button>
        <button type="button" (click)="undo()" [disabled]="!canUndo()">Undo</button>
        <button type="button" (click)="redo()" [disabled]="!canRedo()">Redo</button>
        <button type="button" (click)="reset()">Reset</button>
        <button type="button" (click)="exportPng()">Export PNG</button>
      </div>
      <div class="stage">
        <canvas #cv></canvas>
      </div>
      <p class="status">{{ status() }}</p>
    </div>
  `,
  styles: [
    `
      .harness {
        border: 1px solid #d0d5dd;
        border-radius: 12px;
        padding: 14px;
        background: #f8fafc;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .toolbar button {
        height: 32px;
        padding: 0 12px;
        border: 1px solid #98a2b3;
        background: #fff;
        border-radius: 7px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .toolbar button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .stage {
        display: flex;
        justify-content: center;
        background: repeating-conic-gradient(#e2e8f0 0% 25%, #f1f5f9 0% 50%) 50% / 22px 22px;
        border-radius: 8px;
        padding: 16px;
      }
      .status {
        font-size: 12px;
        color: #475467;
        margin: 10px 0 0;
        font-family: ui-monospace, monospace;
      }
    `,
  ],
})
export class EngineHarness implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private engine: EditorEngine | null = null;

  protected readonly status = signal('initializing…');
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);

  async ngAfterViewInit(): Promise<void> {
    this.engine = await EditorEngine.create(this.canvasRef().nativeElement, {
      width: 520,
      height: 360,
    });
    await this.engine.loadImage(sampleImage());
    this.refresh('loaded sample image');
  }

  async ngOnDestroy(): Promise<void> {
    await this.engine?.destroy();
  }

  protected rotate(): void {
    this.engine?.rotateBy(90);
    this.refresh('rotated 90°');
  }
  protected flip(): void {
    this.engine?.flip('h');
    this.refresh('flipped horizontally');
  }
  protected zoom(delta: number): void {
    this.engine?.zoomBy(delta);
    this.refresh(`zoom ${this.engine?.zoom}%`);
  }
  protected grayscale(): void {
    this.engine?.toggleLook('grayscale');
    this.refresh('toggled B&W');
  }
  protected sepia(): void {
    this.engine?.toggleLook('sepia');
    this.refresh('toggled sepia');
  }
  protected brighten(): void {
    this.engine?.setAdjustments({ brightness: 30 }, true);
    this.refresh('brightness +30');
  }
  protected crop(): void {
    this.engine?.applyCrop('1:1');
    this.refresh('cropped 1:1');
  }
  protected addText(): void {
    this.engine?.addText('Sample', { color: '#f1416c', fontSize: 36 });
    this.refresh('added text');
  }
  protected addRect(): void {
    this.engine?.addShape('rect', { color: '#1f6feb', strokeWidth: 4 });
    this.refresh('added rect');
  }
  protected async undo(): Promise<void> {
    await this.engine?.undo();
    this.refresh('undo');
  }
  protected async redo(): Promise<void> {
    await this.engine?.redo();
    this.refresh('redo');
  }
  protected async reset(): Promise<void> {
    await this.engine?.reset();
    this.refresh('reset');
  }
  protected async exportPng(): Promise<void> {
    const blob = await this.engine?.exportImage('png', 90, ['png', 'jpeg', 'webp']);
    this.refresh(`exported PNG (${blob ? blob.size : 0} bytes)`);
  }

  private refresh(message: string): void {
    this.status.set(message);
    this.canUndo.set(this.engine?.canUndo ?? false);
    this.canRedo.set(this.engine?.canRedo ?? false);
  }
}

/** A self-contained sample image (gradient + shapes) as a same-origin data URL. */
function sampleImage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 600, 400);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(180, 150, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,0,0.9)';
    ctx.fillRect(330, 220, 180, 120);
  }
  return canvas.toDataURL('image/png');
}
