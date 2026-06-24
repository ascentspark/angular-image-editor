/**
 * Built-in sample images for the image picker, generated at runtime as
 * same-origin data URLs (so filters and export are never tainted by CORS).
 */

export interface SampleImage {
  readonly key: string;
  readonly label: string;
  readonly dataUrl: string;
}

interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

const GRADIENTS: readonly { key: string; label: string; stops: readonly GradientStop[] }[] = [
  {
    key: 'sunset',
    label: 'Sunset',
    stops: [
      { offset: 0, color: '#f59e0b' },
      { offset: 0.5, color: '#ec4899' },
      { offset: 1, color: '#7c3aed' },
    ],
  },
  {
    key: 'ocean',
    label: 'Ocean',
    stops: [
      { offset: 0, color: '#0ea5e9' },
      { offset: 0.5, color: '#2563eb' },
      { offset: 1, color: '#1e3a8a' },
    ],
  },
  {
    key: 'forest',
    label: 'Forest',
    stops: [
      { offset: 0, color: '#84cc16' },
      { offset: 0.5, color: '#15803d' },
      { offset: 1, color: '#064e3b' },
    ],
  },
  {
    key: 'dusk',
    label: 'Dusk',
    stops: [
      { offset: 0, color: '#1e293b' },
      { offset: 0.5, color: '#7c3aed' },
      { offset: 1, color: '#db2777' },
    ],
  },
];

function renderGradient(stops: readonly GradientStop[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 900, 600);
    for (const stop of stops) {
      grad.addColorStop(stop.offset, stop.color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 600);
    // A couple of soft shapes so transforms/filters are visible.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(250, 200, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(660, 420, 150, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}

/** Build the sample image set. Call lazily (needs the DOM). */
export function buildSampleImages(): SampleImage[] {
  return GRADIENTS.map((g) => ({ key: g.key, label: g.label, dataUrl: renderGradient(g.stops) }));
}
