import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'demo-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Playground</h1>`,
})
export class Playground {}
