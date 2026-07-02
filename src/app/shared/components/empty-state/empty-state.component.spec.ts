import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Sin resultados');
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('title es el input proporcionado', () => {
    expect(component.title()).toBe('Sin resultados');
  });

  it('description es null por defecto', () => {
    expect(component.description()).toBeNull();
  });

  it('icon es null por defecto', () => {
    expect(component.icon()).toBeNull();
  });

  it('renderiza el título en el DOM', () => {
    const h3 = fixture.nativeElement.querySelector('h3');
    expect(h3.textContent).toContain('Sin resultados');
  });
});
