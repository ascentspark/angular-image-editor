import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/playground/playground').then((m) => m.Playground),
    title: 'Angular Image Editor — themeable, Fabric.js v7 (free, open-source)',
  },
];
