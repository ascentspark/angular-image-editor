import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AspImageEditor } from './image-editor';

describe('AspImageEditor', () => {
  let component: AspImageEditor;
  let fixture: ComponentFixture<AspImageEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AspImageEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(AspImageEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
