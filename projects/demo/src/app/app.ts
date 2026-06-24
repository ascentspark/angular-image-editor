import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AspImageEditor } from '@ascentspark/angular-image-editor';

@Component({
  selector: 'demo-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AspImageEditor],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
