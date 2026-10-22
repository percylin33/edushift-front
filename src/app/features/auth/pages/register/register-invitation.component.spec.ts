import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, of, throwError } from 'rxjs';
import { AuthService, TenantService } from '@core/services';
import { TenantApiService } from '@features/tenants';
import { AuthApiService } from '../../services/auth-api.service';
import { RegisterComponent } from './register.component';

describe('School invitation preflight', () => {
  const token = 'synthetic-invitation-token';
  let query: Record<string, string>;
  let preflight: jasmine.Spy;
  let setSession: jasmine.Spy;
  let register: jasmine.Spy;
  beforeEach(async () => {
    query = { token };
    preflight = jasmine.createSpy().and.returnValue(of({ email: 'founder@example.test' }));
    setSession = jasmine.createSpy();
    register = jasmine.createSpy().and.returnValue(EMPTY);
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return convertToParamMap(query); } } } },
        { provide: AuthService, useValue: { setSession } },
        { provide: TenantService, useValue: {} },
        { provide: AuthApiService, useValue: {} },
        { provide: TenantApiService, useValue: { findInvitationPreflight: preflight, register } },
      ],
    }).compileComponents();
  });
  it('validates the token, locks the invited email and renders the school form', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(preflight).toHaveBeenCalledOnceWith(token);
    expect(fixture.componentInstance.adminEmailCtrl.value).toBe('founder@example.test');
    expect(fixture.componentInstance.adminEmailCtrl.disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Configura tu institución');
    expect(setSession).not.toHaveBeenCalled();
  });
  it('without a token explains the invitation requirement instead of creating a school', () => {
    query = {};
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Necesitas una invitación');
    expect(preflight).not.toHaveBeenCalled();
  });
  it('rejects a truncated token before sending preflight', () => {
    query = { token: 'short' };
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.inviteReady()).toBeFalse();
    expect(preflight).not.toHaveBeenCalled();
  });
  for (const status of [404, 410, 503]) {
    it(`shows an invitation error for HTTP ${status} without opening a registration form`, () => {
      preflight.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      const fixture = TestBed.createComponent(RegisterComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Invitación no válida');
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      expect(fixture.componentInstance.inviteReady()).toBeFalse();
      expect(setSession).not.toHaveBeenCalled();
    });
  }
  function filledForm(): RegisterComponent {
    const component = TestBed.createComponent(RegisterComponent).componentInstance;
    component.form.patchValue({ tenantName: 'Colegio QA', tenantSlug: 'colegioqa',
      adminFirstName: 'Admin', adminLastName: 'Prueba', adminPassword: 'SchoolAccess2026!',
      confirmAdminPassword: 'SchoolAccess2026!' });
    return component;
  }
  it('requires password confirmation before sending registration', () => {
    const component = filledForm();
    component.confirmAdminPasswordCtrl.setValue('');
    component.onSubmit();
    expect(register).not.toHaveBeenCalled();
    expect(component.errorOf('confirmAdminPassword')).toContain('obligatorio');
  });
  it('rejects mismatched passwords with an inline message', () => {
    const component = filledForm();
    component.confirmAdminPasswordCtrl.setValue('AnotherAccess2026!');
    component.onSubmit();
    expect(register).not.toHaveBeenCalled();
    expect(component.errorOf('confirmAdminPassword')).toContain('no coinciden');
  });
  it('revalidates confirmation if the original password changes', () => {
    const component = filledForm();
    expect(component.form.valid).toBeTrue();
    component.adminPasswordCtrl.setValue('ChangedAccess2026!');
    component.onSubmit();
    expect(register).not.toHaveBeenCalled();
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
    component.confirmAdminPasswordCtrl.setValue('ChangedAccess2026!');
    expect(component.form.valid).toBeTrue();
  });
  it('submits matching passwords without transmitting the confirmation field', () => {
    const component = filledForm();
    component.onSubmit();
    expect(register).toHaveBeenCalledTimes(1);
    const payload = register.calls.mostRecent().args[0] as Record<string, unknown>;
    expect(payload['adminPassword']).toBe('SchoolAccess2026!');
    expect(payload['confirmAdminPassword']).toBeUndefined();
  });
  it('shows the confirmation field and the safe storage reminder', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#confirmAdminPassword')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Guárdala en un gestor de contraseñas');
  });

});
