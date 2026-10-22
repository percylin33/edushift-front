import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services';
import { AdminAuthApiService, PasswordChangeRequiredError } from '../../services/admin-auth-api.service';
import { AdminLoginComponent } from './admin-login.component';

describe('AdminLoginComponent initial password change', () => {
  const changeInitialPassword = jasmine.createSpy('changeInitialPassword');
  const startMfaEnrolment = jasmine.createSpy('startMfaEnrolment');
  const raw = { onboardingToken: 'onboarding', expiresInSec: 300, tokenType: 'Bearer', reason: 'PASSWORD_CHANGE_REQUIRED' };

  beforeEach(async () => {
    changeInitialPassword.calls.reset();
    startMfaEnrolment.calls.reset();
    changeInitialPassword.and.returnValue(of({ ...raw, reason: 'MFA_ENROLMENT_REQUIRED' }));
    startMfaEnrolment.and.returnValue(of({ secretBase32: 'secret', qrCodeDataUrl: '' }));
    await TestBed.configureTestingModule({
      imports: [AdminLoginComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: AdminAuthApiService, useValue: {
          login: () => throwError(() => new PasswordChangeRequiredError(raw)),
          changeInitialPassword, startMfaEnrolment,
        } },
      ],
    }).compileComponents();
  });

  it('clears the login password, renders two fields and continues to MFA', () => {
    const fixture = TestBed.createComponent(AdminLoginComponent);
    const component = fixture.componentInstance;
    component.emailCtrl.setValue('super@example.test');
    component.passwordCtrl.setValue('Temporary2026!');
    component.onSubmit();
    fixture.detectChanges();
    expect(component.passwordCtrl.value).toBeFalsy();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('input[type="password"]').length).toBe(2);
    expect(element.querySelector('#temporary-password')).toBeNull();
    component.newPassword = 'NewPersonal2026!';
    component.confirmNewPassword = 'NewPersonal2026!';
    component.changeInitialPassword();
    expect(changeInitialPassword).toHaveBeenCalledOnceWith('onboarding', 'NewPersonal2026!');
    expect(startMfaEnrolment).toHaveBeenCalledOnceWith('onboarding');
    expect(component.newPassword).toBe('');
  });

  it('does not submit mismatched confirmation', () => {
    const component = TestBed.createComponent(AdminLoginComponent).componentInstance;
    component.passwordChangeToken.set('onboarding');
    component.newPassword = 'NewPersonal2026!';
    component.confirmNewPassword = 'Another2026!';
    component.changeInitialPassword();
    expect(changeInitialPassword).not.toHaveBeenCalled();
  });
});
