import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { guestGuard } from './guest.guard';
import { AuthService } from '@core/services';

describe('guestGuard', () => {
  let router: Router;

  const configure = (isAuthenticated: boolean) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj(
            'AuthService',
            ['isAuthenticated', 'hasRole', 'hasPermission'],
            { isAuthenticated: () => isAuthenticated },
          ),
        },
      ],
    });
    router = TestBed.inject(Router);
  };

  it('permite acceso cuando no está autenticado', () => {
    configure(false);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('redirige a dashboard cuando está autenticado', () => {
    configure(true);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any));
    expect(router.isUrlTree(result)).toBeTrue();
  });
});
