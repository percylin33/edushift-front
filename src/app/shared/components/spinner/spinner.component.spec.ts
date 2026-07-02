import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';

describe('SpinnerComponent', () => {
  let component: SpinnerComponent;
  let fixture: ComponentFixture<SpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('size por defecto es 16', () => {
    expect(component.size).toBe(16);
  });

  it('label por defecto es Cargando…', () => {
    expect(component.label).toBe('Cargando…');
  });

  it('renderiza el span con aria-live', () => {
    const el = fixture.nativeElement.querySelector('[aria-live]');
    expect(el).toBeTruthy();
  });

  it('cambia el tamaño del spinner', () => {
    component.size = 32;
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('.animate-spin');
    expect(span.style.width).toBe('32px');
  });
});
