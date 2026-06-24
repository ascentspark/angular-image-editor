import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AspIcon } from './asp-icon';

@Component({
  imports: [AspIcon],
  template: `<asp-icon [name]="name" [size]="22" />`,
})
class HostComponent {
  name = 'crop';
}

describe('AspIcon', () => {
  it('renders an svg with the icon paths for a known name', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.innerHTML).toContain('path');
  });

  it('accepts a lucide: prefixed name', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name = 'lucide:rotate-cw';
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders an empty svg for an unknown name without throwing', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name = 'definitely-not-an-icon';
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.innerHTML.trim()).toBe('');
  });
});
