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

  it('expone los valores iniciales del stub', () => {
    expect(component.busy).toBeFalse();
    expect(component.label).toBe('');
    expect(component.loadingLabel).toBe('');
  });

  it('acepta los inputs declarados por el stub', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.componentRef.setInput('label', 'Entrar con Google');
    fixture.componentRef.setInput('loadingLabel', 'Conectando…');
    fixture.detectChanges();

    expect(component.busy).toBeTrue();
    expect(component.label).toBe('Entrar con Google');
    expect(component.loadingLabel).toBe('Conectando…');
  });

  it('expone el evento signinClick', () => {
    const emitSpy = jasmine.createSpy('emit');
    component.signinClick.subscribe(emitSpy);

    component.signinClick.emit();

    expect(emitSpy).toHaveBeenCalled();
  });
});
