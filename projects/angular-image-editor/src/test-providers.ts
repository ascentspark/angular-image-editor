import { provideZonelessChangeDetection } from '@angular/core';

/**
 * Default providers added to every unit test's TestBed (via the unit-test builder's
 * `providersFile`). The library is zoneless; Angular 22 tests are zoneless by default,
 * but on the Angular 20 line the test environment otherwise requires Zone.js (NG0908).
 */
export default [provideZonelessChangeDetection()];
