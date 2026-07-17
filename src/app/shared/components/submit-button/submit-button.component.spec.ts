import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubmitButtonComponent } from './submit-button.component';

describe('SubmitButtonComponent', () => {
  let fixture: ComponentFixture<SubmitButtonComponent>;
  let component: SubmitButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmitButtonComponent],
    }).compileComponents();
  });

  function create(loading = false): void {
    fixture = TestBed.createComponent(SubmitButtonComponent);
    component = fixture.componentInstance;
    component.loading = loading;
    component.label = 'Iniciar sesión';
    component.loadingLabel = 'Verificando…';
    fixture.detectChanges();
  }

  it('se crea correctamente', () => {
    create();
    expect(component).toBeTruthy();
  });

  it('renderiza el label cuando loading=false', () => {
    create(false);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Iniciar sesión');
  });

  it('renderiza loadingLabel cuando loading=true', () => {
    create(true);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Verificando…');
    expect(text).not.toContain('Iniciar sesión');
  });

  it('el botón está disabled cuando loading=true', () => {
    create(true);
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBeTrue();
  });

  it('el botón está disabled cuando disabled=true', () => {
    create(false);
    component.disabled = true;
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBeTrue();
  });

  it('oculta la flecha cuando showArrow=false', () => {
    create(false);
    component.showArrow = false;
    fixture.detectChanges();
    const icons = fixture.nativeElement.querySelectorAll('app-icon');
    expect(icons.length).toBe(0);
  });

  it('muestra la flecha por defecto', () => {
    create(false);
    const icons = fixture.nativeElement.querySelectorAll('app-icon');
    expect(icons.length).toBe(1);
  });

  it('theme=dark no rompe el render', () => {
    create(false);
    component.theme = 'dark';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });
});