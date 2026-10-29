import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AuthService, TenantService, ThemeService } from '@core/services';
import { TenantThemeService } from '@core/theming';
import { AuthSession, User } from '@core/models';
import { TenantStatus } from '@core/enums';

import { LoginComponent } from './login.component';
import { AuthApiService } from '../../services/auth-api.service';
import { TenantApiService } from '@features/tenants/services/tenant-api.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { AuthStore } from '../../store/auth.store';
import { LoginResult } from '../../models';

class FakeAuthService {
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly expiresAt = signal<Date | null>(null);
  setSession(_session: AuthSession) {}
  setUser(_user: User) {}
  clearSession() {}
}

class FakeGoogleAuthService {
  readonly busy = signal(false);
  signIn() {
    return Promise.resolve({ idToken: 'test-token' });
  }
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authApiSpy: jasmine.SpyObj<AuthApiService>;
  let store: AuthStore;
  let tenantService: TenantService;
  let tenantApiSpy: jasmine.SpyObj<TenantApiService>;

  const fakeActivatedRoute = { snapshot: { queryParamMap: convertToParamMap({}) } };

  beforeEach(async () => {
    authApiSpy = jasmine.createSpyObj<AuthApiService>('AuthApiService', [
      'login',
      'loginWithGoogle',
      'me',
    ]);
    authApiSpy.login.and.returnValue(of({} as LoginResult));
    authApiSpy.loginWithGoogle.and.returnValue(of({} as AuthSession));
    authApiSpy.me.and.returnValue(of({} as User));
    tenantApiSpy = jasmine.createSpyObj<TenantApiService>('TenantApiService', ['findCurrent']);
    tenantApiSpy.findCurrent.and.returnValue(
      of({
        id: '019ec200-4a00-7000-8001-000000000001',
        slug: 'acme',
        name: 'Acme School',
        status: TenantStatus.Active,
        isActive: true,
      }),
    );

    const tenantThemeSpy = jasmine.createSpyObj('TenantThemeService', ['apply', 'reset']);
    const themeSpy = jasmine.createSpyObj('ThemeService', ['applyTenantDefault']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        AuthStore,
        TenantService,
        { provide: AuthApiService, useValue: authApiSpy },
        { provide: TenantApiService, useValue: tenantApiSpy },
        { provide: AuthService, useClass: FakeAuthService },
        { provide: TenantThemeService, useValue: tenantThemeSpy },
        { provide: ThemeService, useValue: themeSpy },
        { provide: GoogleAuthService, useClass: FakeGoogleAuthService },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(AuthStore);
    tenantService = TestBed.inject(TenantService);
    tenantService.setTenant(
      {
        id: '019ec200-4a00-7000-8001-000000000001',
        slug: 'acme',
        name: 'Acme School',
        status: TenantStatus.Active,
        isActive: true,
      },
      'path',
    );
    fixture.detectChanges();
  });

  it('se crea con form inválido por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.form.invalid).toBeTrue();
  });

  it('no expone campo Institución / tenantSlug', () => {
    expect(component.form.get('tenantSlug')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Institución');
  });

  it('validación: email requerido y formato', () => {
    const ctrl = component.form.get('email')!;
    ctrl.markAsTouched();
    fixture.detectChanges();
    expect(ctrl.invalid).toBeTrue();
    expect(ctrl.hasError('required')).toBeTrue();

    ctrl.setValue('not-an-email');
    ctrl.markAsTouched();
    fixture.detectChanges();
    expect(ctrl.hasError('email')).toBeTrue();
  });

  it('validación: password requerido', () => {
    const ctrl = component.form.get('password')!;
    ctrl.markAsTouched();
    fixture.detectChanges();
    expect(ctrl.invalid).toBeTrue();
    expect(ctrl.hasError('required')).toBeTrue();
  });

  it('onSubmit no llama login si el form es inválido', () => {
    component.onSubmit();
    expect(authApiSpy.login).not.toHaveBeenCalled();
  });

  it('onSubmit llama login y usa el slug del TenantService', () => {
    component.form.patchValue({
      email: 'admin@test.com',
      password: 'secret',
    });
    component.onSubmit();
    expect(authApiSpy.login).toHaveBeenCalled();
    expect(tenantService.tenantSlug()).toBe('acme');
    expect(store.loading()).toBeFalse();
  });

  it('onSubmit fallback — error mapea BAD_CREDENTIALS', () => {
    authApiSpy.login.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { code: 'BAD_CREDENTIALS' },
            status: 401,
          }),
      ),
    );

    component.form.patchValue({
      email: 'admin@test.com',
      password: 'wrong',
    });
    component.onSubmit();

    expect(store.error()).toBe('Correo o contraseña incorrectos.');
  });

  it('onSubmit fallback — server error 500', () => {
    authApiSpy.login.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { message: 'Internal error' },
            status: 500,
          }),
      ),
    );

    component.form.patchValue({
      email: 'admin@test.com',
      password: 'secret',
    });
    component.onSubmit();

    expect(store.error()).toContain('error inesperado');
  });

  it('onSubmit no llama login si no hay slug de tenant', () => {
    tenantService.clear();
    component.form.patchValue({
      email: 'admin@test.com',
      password: 'secret',
    });
    component.onSubmit();
    expect(authApiSpy.login).not.toHaveBeenCalled();
  });
});
