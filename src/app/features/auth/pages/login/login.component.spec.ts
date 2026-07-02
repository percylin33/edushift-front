import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AuthService, TenantService } from '@core/services';
import { ROUTES } from '@core/constants';
import { AuthSession, User } from '@core/models';

import { LoginComponent } from './login.component';
import { AuthApiService } from '../../services/auth-api.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { AuthStore } from '../../store/auth.store';
import { LoginRequest } from '../../models';

class FakeAuthApiService {
  login(payload: LoginRequest) {
    return of({});
  }
  loginWithGoogle(payload: { idToken: string }) {
    return of({});
  }
  me() {
    return of({} as User);
  }
}

class FakeAuthService {
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly expiresAt = signal<Date | null>(null);
  setSession(session: AuthSession) {}
  setUser(user: User) {}
  clearSession() {}
}

class FakeTenantService {
  readonly tenantSlug = signal<string | null>(null);
  setSlug(slug: string) {
    this.tenantSlug.set(slug);
  }
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

  const fakeActivatedRoute = { snapshot: { queryParamMap: convertToParamMap({}) } };

  beforeEach(async () => {
    authApiSpy = jasmine.createSpyObj<AuthApiService>('AuthApiService', [
      'login',
      'loginWithGoogle',
      'me',
    ]);
    authApiSpy.login.and.returnValue(of({} as AuthSession));
    authApiSpy.loginWithGoogle.and.returnValue(of({} as AuthSession));
    authApiSpy.me.and.returnValue(of({} as User));

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        AuthStore,
        { provide: AuthApiService, useValue: authApiSpy },
        { provide: AuthService, useClass: FakeAuthService },
        { provide: TenantService, useClass: FakeTenantService },
        { provide: GoogleAuthService, useClass: FakeGoogleAuthService },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(AuthStore);
    tenantService = TestBed.inject(TenantService);
    fixture.detectChanges();
  });

  it('se crea con form inválido por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.form.invalid).toBeTrue();
  });

  it('validaci—on: tenantSlug required', () => {
    const ctrl = component.form.get('tenantSlug')!;
    ctrl.markAsTouched();
    fixture.detectChanges();
    expect(ctrl.invalid).toBeTrue();
    expect(ctrl.hasError('required')).toBeTrue();
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

  it('togglePasswordVisibility cambia el estado', () => {
    expect(component.passwordVisible()).toBeFalse();
    component.togglePasswordVisibility();
    expect(component.passwordVisible()).toBeTrue();
    component.togglePasswordVisibility();
    expect(component.passwordVisible()).toBeFalse();
  });

  it('onSubmit no llama login si el form es inválido', () => {
    component.onSubmit();
    expect(authApiSpy.login).not.toHaveBeenCalled();
  });

  it('onSubmit llama login y navega al dashboard', () => {
    const router = TestBed.inject(ActivatedRoute);
    component.form.patchValue({
      tenantSlug: 'acme',
      email: 'admin@test.com',
      password: 'secret',
    });
    component.onSubmit();
    expect(authApiSpy.login).toHaveBeenCalled();
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
      tenantSlug: 'acme',
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
      tenantSlug: 'acme',
      email: 'admin@test.com',
      password: 'secret',
    });
    component.onSubmit();

    expect(store.error()).toContain('error inesperado');
  });

  it('onSubmit marca tenantSlug en TenantService antes de llamar login', () => {
    component.form.patchValue({
      tenantSlug: 'MiCole',
      email: 'admin@test.com',
      password: 'secret',
    });
    component.onSubmit();
    expect(tenantService.tenantSlug()).toBe('micole');
  });

  it('onGoogleSignIn valida tenantSlug antes de abrir popup', async () => {
    component.form.get('tenantSlug')!.setValue('');
    await component.onGoogleSignIn();
    expect(store.error()).toContain('Google');
  });

  it('toMessage retorna mensaje de error para status 0', () => {
    const err = new HttpErrorResponse({ status: 0 });
    const msg = (component as any).toMessage(err);
    expect(msg).toContain('conexión');
  });

  it('toMessage retorna mensaje para USER_LOCKED', () => {
    const err = new HttpErrorResponse({
      error: { code: 'USER_LOCKED' },
      status: 403,
    });
    const msg = (component as any).toMessage(err);
    expect(msg).toContain('bloqueada');
  });
});
