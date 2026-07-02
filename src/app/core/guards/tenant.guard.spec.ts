import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantService } from '@core/services';

describe('tenantGuard', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], { tenantSlug: () => 'test-tenant' }),
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('permite acceso cuando hay tenant slug', () => {
    const result = TestBed.runInInjectionContext(() => tenantGuard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('redirige a not-found cuando no hay tenant slug', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], { tenantSlug: () => null }),
        },
      ],
    });
    router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() => tenantGuard({} as any, {} as any));
    expect(router.isUrlTree(result)).toBeTrue();
  });
});
