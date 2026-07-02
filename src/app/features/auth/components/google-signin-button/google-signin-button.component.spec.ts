import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoogleSigninButtonComponent } from './google-signin-button.component';

describe('GoogleSigninButtonComponent', () => {
  let fixture: ComponentFixture<GoogleSigninButtonComponent>;
  let component: GoogleSigninButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleSigninButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GoogleSigninButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('label por defecto "Continuar con Google"', () => {
    expect((component as any).label()).toBe('Continuar con Google');
  });

  it('label acepta custom input', () => {
    fixture.componentRef.setInput('label', 'Entrar con Google');
    fixture.detectChanges();
    expect((component as any).label()).toBe('Entrar con Google');
  });

  it('ariaLabel cambia cuando loading', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect((component as any).ariaLabel()).toBe('Iniciar sesión con Google');
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect((component as any).ariaLabel()).toContain('procesando');
  });

  it('onClick emite googleSigninClick', () => {
    const emitSpy = jasmine.createSpy('emit');
    component.googleSigninClick.subscribe(emitSpy);
    (component as any).onClick();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('onClick bloqueado si disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const emitSpy = jasmine.createSpy('emit');
    component.googleSigninClick.subscribe(emitSpy);
    (component as any).onClick();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('onClick bloqueado si loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const emitSpy = jasmine.createSpy('emit');
    component.googleSigninClick.subscribe(emitSpy);
    (component as any).onClick();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
