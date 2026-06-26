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
  {
    path: 'getting-started',
    loadComponent: () =>
      import('./pages/getting-started/getting-started').then((m) => m.GettingStarted),
    title: 'Getting started — Angular Image Editor',
    data: {
      description:
        'Install @ascentsparksoftware/angular-image-editor, use the standalone AspImageEditor ' +
        'component, and choose a mode (viewer, basic, advanced, full). Free, Angular 22, Fabric.js v7.',
    },
  },
  {
    path: 'configuration',
    loadComponent: () => import('./pages/configuration/configuration').then((m) => m.Configuration),
    title: 'Configuration — tools, filters, theming & sizing',
    data: {
      description:
        'Configure the Angular Image Editor: choose tools and filters, theme the whole UI from ' +
        'three colors with guaranteed AA contrast, and control the canvas size responsively.',
    },
  },
  {
    path: 'editing-tools',
    loadComponent: () => import('./pages/editing-tools/editing-tools').then((m) => m.EditingTools),
    title: 'Editing tools — crop, draw, text, shapes, AI & more',
    data: {
      description:
        'Every editing tool of the Angular Image Editor: interactive crop, adjust & filters, draw, ' +
        'text with web fonts, shapes, redact, magic wand, in-browser AI background removal, background & frames.',
    },
  },
  {
    path: 'workflow',
    loadComponent: () => import('./pages/workflow/workflow').then((m) => m.Workflow),
    title: 'Canvas & workflow — layers, guides, artboard, import',
    data: {
      description:
        'Layers, rulers/guides/snapping, artboard output size, re-editable templates, robust ' +
        'large-image and HEIC import, and keyboard shortcuts in the Angular Image Editor.',
    },
  },
  {
    path: 'export',
    loadComponent: () => import('./pages/export/export-page').then((m) => m.ExportPage),
    title: 'Export — PNG, JPEG, WEBP, SVG (fonts), PDF, JSON',
    data: {
      description:
        'Export from the Angular Image Editor to PNG, JPEG, WEBP, font-embedded SVG, PDF, or a ' +
        're-editable JSON scene, with quality control and exact-pixel artboard/crop export.',
    },
  },
  {
    path: 'reference',
    loadComponent: () => import('./pages/reference/reference').then((m) => m.Reference),
    title: 'Integration & API reference — Angular Image Editor',
    data: {
      description:
        'Modal dialog, headless EditorEngine, events, the full AspImageEditor input/output API, ' +
        'accessibility and security notes for @ascentsparksoftware/angular-image-editor.',
    },
  },
];
