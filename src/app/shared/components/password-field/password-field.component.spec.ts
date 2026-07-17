import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { PasswordFieldComponent } from './password-field.component';

describe('PasswordFieldComponent', () => {
  let fixture: ComponentFixture<PasswordFieldComponent>;
  let component: PasswordFieldComponent;
  let control: FormControl<string>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordFieldComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    control = new FormControl<string>('', { nonNullable: true });
    fixture = TestBed.createComponent(PasswordFieldComponent);
    component = fixture.componentInstance;
    component.id = 'password';
    component.control = control;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('input arranca con type=password', () => {
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('type')).toBe('password');
  });

  it('toggle cambia el tipo a text y viceversa', () => {
    component.toggle();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').getAttribute('type')).toBe('text');
    expect(component.visible()).toBeTrue();

    component.toggle();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').getAttribute('type')).toBe('password');
    expect(component.visible()).toBeFalse();
  });

  it('el botón de toggle tiene aria-label dinámico', () => {
    let btn = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-label')).toBe('Mostrar contraseña');

    component.toggle();
    fixture.detectChanges();
    btn = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-label')).toBe('Ocultar contraseña');
  });

  it('renderiza el label cuando se provee', () => {
    component.label = 'Contraseña';
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('label');
    expect(label.textContent).toContain('Contraseña');
    expect(label.getAttribute('for')).toBe('password');
  });

  it('muestra error en lugar de hint cuando hay error', () => {
    component.error = 'Requerido';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[id="password-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[id="password-hint"]')).toBeFalsy();
  });

  it('muestra hint cuando no hay error', () => {
    component.hint = 'Mínimo 8 caracteres';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[id="password-hint"]')).toBeTruthy();
  });

  it('aria-invalid se aplica cuando hay error', () => {
    component.error = 'mal';
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('theme=dark no rompe el render', () => {
    component.theme = 'dark';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input')).toBeTruthy();
  });
});