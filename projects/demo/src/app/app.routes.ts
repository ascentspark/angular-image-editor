import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/playground/playground').then((m) => m.Playground),
    title: 'Angular Image Editor — themeable, Fabric.js v7 (free, open-source)',
    data: {
      description:
        'Interactive playground for @ascentsparksoftware/angular-image-editor: a standalone, ' +
        'themeable Angular 22 image editor on Fabric.js v7. Crop, filters, draw, text, redact, ' +
        'layers, AI background removal, and PNG/JPEG/WEBP/SVG/PDF export.',
    },
  },
];
