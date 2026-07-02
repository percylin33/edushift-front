import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';

describe('roleGuard', () => {
  let router: Router;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['hasRole', 'hasPermission', 'isAuthenticated']);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    });
    router = TestBed.inject(Router);
  });

  it('permite acceso cuando no hay roles definidos', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard({ data: {} } as any));
    expect(result).toBeTrue();
  });

  it('permite acceso cuando el usuario tiene el rol requerido', () => {
    authSpy.hasRole.and.returnValue(true);
    const result = TestBed.runInInjectionContext(() =>
      roleGuard({ data: { roles: [UserRole.TenantAdmin] } } as any),
    );
    expect(result).toBeTrue();
  });

  it('redirige a forbidden cuando el usuario no tiene el rol', () => {
    authSpy.hasRole.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() =>
      roleGuard({ data: { roles: [UserRole.TenantAdmin] } } as any),
    );
    expect(router.isUrlTree(result)).toBeTrue();
  });
});
