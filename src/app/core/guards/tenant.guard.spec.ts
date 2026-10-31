import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantService } from '@core/services';

describe('tenantGuard', () => {
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
    const result = TestBed.runInInjectionContext(() => tenantGuard({} as any, {} as any));
    expect(result instanceof UrlTree).toBeTrue();
  });
});
