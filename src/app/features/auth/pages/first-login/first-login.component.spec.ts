import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services';
import { AuthApiService } from '../../services/auth-api.service';
import { FirstLoginComponent } from './first-login.component';

describe('FirstLoginComponent', () => {
  const completeOnboarding = jasmine.createSpy('completeOnboarding').and.returnValue(of({}));

  beforeEach(async () => {
    completeOnboarding.calls.reset();
    await TestBed.configureTestingModule({
      imports: [FirstLoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: () => null, setUser: jasmine.createSpy() } },
        { provide: AuthApiService, useValue: {
          getOnboarding: () => of({ role: 'STUDENT', mustChangePassword: true, requiredFields: ['newPassword'] }),
          completeOnboarding,
        } },
      ],
    }).compileComponents();
  });

  it('renders only new password and confirmation and submits without the temporary password', async () => {
    const fixture = TestBed.createComponent(FirstLoginComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('input[type="password"]').length).toBe(2);
    expect(element.querySelector('#currentPassword')).toBeNull();
    component['form'].patchValue({ newPassword: 'NewPersonal2026!', confirmPassword: 'NewPersonal2026!' });
    await component['submit']();
    const payload = completeOnboarding.calls.mostRecent().args[0] as Record<string, unknown>;
    expect(payload['newPassword']).toBe('NewPersonal2026!');
    expect(payload['currentPassword']).toBeUndefined();
  });

  it('does not submit mismatched confirmation', async () => {
    const component = TestBed.createComponent(FirstLoginComponent).componentInstance;
    component['form'].patchValue({ newPassword: 'NewPersonal2026!', confirmPassword: 'Another2026!' });
    await component['submit']();
    expect(completeOnboarding).not.toHaveBeenCalled();
    expect(component['errorMessage']()).toContain('no coincide');
  });
});
