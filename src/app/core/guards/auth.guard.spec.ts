import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { authGuard, authChildGuard } from './auth.guard';
import { AuthService } from '@core/services';

describe('authGuard', () => {
  let router: Router;
  let authSpy: jasmine.SpyObj<AuthService>;

  const configure = (isAuthenticated: boolean) => {
    authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'hasRole', 'hasPermission'], {
      isAuthenticated: () => isAuthenticated,
      user: () => null,
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    });
    router = TestBed.inject(Router);
  };

  it('permite acceso cuando está autenticado', () => {
    configure(true);
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('redirige a login cuando no está autenticado', () => {
    configure(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/dashboard', root: {} as any } as any),
    );
    expect(result instanceof UrlTree).toBeTrue();
  });
});

describe('authChildGuard', () => {
  let router: Router;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'hasRole', 'hasPermission'], {
      isAuthenticated: () => true,
      user: () => null,
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    });
    router = TestBed.inject(Router);
  });

  it('permite acceso cuando está autenticado', () => {
    const result = TestBed.runInInjectionContext(() => authChildGuard({} as any, {} as any));
    expect(result).toBeTrue();
  });
});
