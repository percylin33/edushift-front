import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'home');
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('renderiza el icono con el nombre dado', () => {
    expect(component.content()).toBeTruthy();
  });

  it('usa size por defecto 20', () => {
    expect(component.size()).toBe(20);
  });

  it('usa strokeWidth por defecto 1.75', () => {
    expect(component.strokeWidth()).toBe(1.75);
  });

  it('renderiza SVG con el tamaño especificado', () => {
    fixture.componentRef.setInput('size', 24);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('24');
  });
});
