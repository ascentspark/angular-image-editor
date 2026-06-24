import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AspColorField } from './color-field';

@Component({
  imports: [AspColorField],
  template: `<asp-color-field [colors]="colors" [value]="value()" (colorChange)="picked.set($event)" />`,
})
class HostComponent {
  colors = ['#f1416c', '#009ef6', '#ffffff'];
  value = signal('#009ef6');
  picked = signal('');
}

describe('AspColorField', () => {
  it('emits the preset color on swatch click', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const swatches = fixture.nativeElement.querySelectorAll('.asp-cf__swatch') as NodeListOf<HTMLButtonElement>;
    swatches[0].click();
    expect(fixture.componentInstance.picked()).toBe('#f1416c');
  });

  it('emits the chosen color from the custom picker', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('.asp-cf__custom input') as HTMLInputElement;
    input.value = '#123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.picked()).toBe('#123456');
  });

  it('falls back to black in the native picker for non-hex values', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set('transparent');
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('.asp-cf__custom input') as HTMLInputElement;
    expect(input.value).toBe('#000000');
  });
});
