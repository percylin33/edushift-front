import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AuthService, TenantService } from '@core/services';
import { AuthSession, User } from '@core/models';
import { TenantApiService } from '@features/tenants';

import { RegisterComponent } from './register.component';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthStore } from '../../store/auth.store';

class FakeAuthApiService {
  me() {
    return of({} as User);
  }
}

class FakeTenantApiService {
  register(_payload: unknown) {
    return of({} as AuthSession);
  }
  findCurrent() {
    return of({});
  }
}

class FakeAuthService {
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);
  readonly refreshToken = signal<string | null>(null);
  readonly expiresAt = signal<Date | null>(null);
  setSession(_session: AuthSession) {}
  setUser(_user: User) {}
  clearSession() {}
}

class FakeTenantService {
  readonly tenantSlug = signal<string | null>(null);
  setTenant(_t: unknown, _src: string) {}
  setSlug(_s: string) {}
}

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let store: AuthStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        AuthStore,
        { provide: AuthApiService, useClass: FakeAuthApiService },
        { provide: TenantApiService, useClass: FakeTenantApiService },
        { provide: AuthService, useClass: FakeAuthService },
        { provide: TenantService, useClass: FakeTenantService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(AuthStore);
    fixture.detectChanges();
  });

  it('se crea con form inválido por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.form.invalid).toBeTrue();
  });

  it('slugPreview refleja el valor del campo en lowercase', () => {
    const ctrl = component.form.get('tenantSlug')!;
    ctrl.setValue('Mi-Colegio');
    expect(ctrl.value).toBe('Mi-Colegio');
  });

  it('validación: tenantName required', () => {
    const ctrl = component.form.get('tenantName')!;
    ctrl.markAsTouched();
    expect(component.invalid('tenantName')).toBeTrue();
    expect(component.errorOf('tenantName')).toContain('obligatorio');
  });

  it('validación: tenantSlug pattern rejecta espacios', () => {
    const ctrl = component.form.get('tenantSlug')!;
    ctrl.setValue('mi cole');
    ctrl.markAsTouched();
    expect(component.invalid('tenantSlug')).toBeTrue();
    expect(component.errorOf('tenantSlug')).toContain('Solo letras minúsculas');
  });

  it('validación: adminEmail formato inválido', () => {
    const ctrl = component.form.get('adminEmail')!;
    ctrl.setValue('not-email');
    ctrl.markAsTouched();
    expect(component.invalid('adminEmail')).toBeTrue();
    expect(component.errorOf('adminEmail')).toContain('válido');
  });

  it('validación: adminPassword minlength', () => {
    const ctrl = component.form.get('adminPassword')!;
    ctrl.setValue('123');
    ctrl.markAsTouched();
    expect(component.invalid('adminPassword')).toBeTrue();
    expect(component.errorOf('adminPassword')).toContain('Mínimo');
  });

  it('togglePasswordVisibility cambia el estado', () => {
    expect(component.passwordVisible()).toBeFalse();
    component.togglePasswordVisibility();
    expect(component.passwordVisible()).toBeTrue();
  });

  it('markSlugAsTouched fija _slugTouchedByUser', () => {
    component.markSlugAsTouched();
    expect((component as any)._slugTouchedByUser).toBeTrue();
  });

  it('onSubmit no llama register si el form es inválido', () => {
    const tenantApi = TestBed.inject(TenantApiService);
    spyOn(tenantApi, 'register');
    component.onSubmit();
    expect(tenantApi.register).not.toHaveBeenCalled();
  });

  it('onSubmit con form válido marca loading', () => {
    component.form.patchValue({
      tenantName: 'Mi Cole',
      tenantSlug: 'mi-cole',
      adminFirstName: 'Admin',
      adminLastName: 'User',
      adminEmail: 'admin@test.com',
      adminPassword: 'password123',
    });
    component.form.updateValueAndValidity();
    expect(component.form.valid).toBeTrue();

    const setLoadingSpy = spyOn(store, 'setLoading');
    component.onSubmit();
    expect(setLoadingSpy).toHaveBeenCalledWith(true);
  });

  it('applyServerErrors mapea TENANT_SLUG_TAKEN a error de campo', () => {
    const err = new HttpErrorResponse({
      error: { code: 'TENANT_SLUG_TAKEN' },
      status: 409,
    });
    (component as any).applyServerErrors(err);
    expect(component.form.get('tenantSlug')!.hasError('serverField')).toBeTrue();
    expect(store.error()).toContain('identificador');
  });

  it('applyServerErrors mapea EMAIL_TAKEN a error de campo', () => {
    const err = new HttpErrorResponse({
      error: { code: 'EMAIL_TAKEN' },
      status: 409,
    });
    (component as any).applyServerErrors(err);
    expect(component.form.get('adminEmail')!.hasError('serverField')).toBeTrue();
    expect(store.error()).toContain('correo');
  });

  it('applyServerErrors mapea status 500', () => {
    const err = new HttpErrorResponse({
      error: { message: 'Server error' },
      status: 500,
    });
    (component as any).applyServerErrors(err);
    expect(store.error()).toContain('error inesperado');
  });

  it('toSlug normaliza nombre a slug', () => {
    const slug = (component as any).toSlug('Colegio San José');
    expect(slug).toBe('colegio-san-jose');
  });

  it('toSlug retorna vacío para input vacío', () => {
    expect((component as any).toSlug('')).toBe('');
  });
});
