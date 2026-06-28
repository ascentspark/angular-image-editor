import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideAspBackgroundRemoval,
  provideAspHeicDecoder,
} from '@ascentsparksoftware/angular-image-editor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    // The demo opts into the optional heavy features so the playground can show
    // AI background removal + HEIC import. The dynamic import() lives HERE, in the
    // consumer, so the WASM/ML graph is the demo's cost — not the core library's.
    provideAspBackgroundRemoval(() => import('@imgly/background-removal')),
    provideAspHeicDecoder(() => import('heic2any')),
  ],
};
