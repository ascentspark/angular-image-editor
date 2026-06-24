import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Root entry component for the image editor (`<asp-image-editor>`).
 *
 * Phase 0 placeholder. The full public contract — `src`, `mode`, `tools`,
 * `disabledTools`, `filters`, theming inputs, and `saved`/`canceled` outputs —
 * plus theming and mode switching land in later phases (see
 * `docs/plans/00-master-plan.md`). Kept minimal here only to prove the
 * library → demo wiring end to end and to lock the public selector/class name.
 */
@Component({
  selector: 'asp-image-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="asp-scaffold">asp-image-editor (scaffold)</p>`,
})
export class AspImageEditor {}
