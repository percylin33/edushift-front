import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<FormFieldComponent>;
  let component: FormFieldComponent;
  let control: FormControl<string>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormFieldComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    control = new FormControl<string>('', { nonNullable: true });
    fixture = TestBed.createComponent(FormFieldComponent);
    component = fixture.componentInstance;
    component.id = 'email';
    component.control = control;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('renderiza el label', () => {
    component.label = 'Correo';
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('label');
    expect(label.textContent).toContain('Correo');
    expect(label.getAttribute('for')).toBe('email');
  });

  it('no renderiza label cuando no se provee', () => {
    const labels = fixture.nativeElement.querySelectorAll('label');
    expect(labels.length).toBe(0);
  });

  it('pasa formControl al input', () => {
    control.setValue('hola@test.com');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('hola@test.com');
  });

  it('muestra error cuando error tiene valor', () => {
    component.error = 'Campo obligatorio';
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Campo obligatorio');
    expect(text).toContain('Campo obligatorio');
    const errorP = fixture.nativeElement.querySelector('[id="email-error"]');
    expect(errorP).toBeTruthy();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('muestra hint cuando no hay error', () => {
    component.hint = 'Te enviaremos un correo';
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Te enviaremos un correo');
    const hintP = fixture.nativeElement.querySelector('[id="email-hint"]');
    expect(hintP).toBeTruthy();
  });

  it('error toma precedencia sobre hint', () => {
    component.error = 'Requerido';
    component.hint = 'ayuda';
    fixture.detectChanges();
    const errorP = fixture.nativeElement.querySelector('[id="email-error"]');
    const hintP = fixture.nativeElement.querySelector('[id="email-hint"]');
    expect(errorP).toBeTruthy();
    expect(hintP).toBeFalsy();
  });

  it('describedBy retorna el id-error cuando hay error', () => {
    component.error = 'x';
    expect(component.describedBy()).toBe('email-error');
  });

  it('describedBy retorna el id-hint cuando hay hint sin error', () => {
    component.hint = 'help';
    expect(component.describedBy()).toBe('email-hint');
  });

  it('describedBy retorna null sin error ni hint', () => {
    expect(component.describedBy()).toBeNull();
  });

  it('hasError refleja el input error', () => {
    expect(component.hasError()).toBeFalse();
    component.error = 'algo';
    expect(component.hasError()).toBeTrue();
  });

  it('renderiza el icon cuando se provee', () => {
    component.icon = 'mail';
    fixture.detectChanges();
    const icons = fixture.nativeElement.querySelectorAll('app-icon');
    expect(icons.length).toBe(1);
  });

  it('theme=dark no rompe el render', () => {
    component.theme = 'dark';
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input).toBeTruthy();
  });
});