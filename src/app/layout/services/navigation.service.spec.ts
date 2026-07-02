import { TestBed } from '@angular/core/testing';
import { NavigationService } from './navigation.service';
import { AuthService, TenantService } from '@core/services';

describe('NavigationService', () => {
  let service: NavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NavigationService,
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj(
            'AuthService',
            ['hasRole', 'hasPermission', 'isAuthenticated'],
            {
              user: () => ({ roles: ['TENANT_ADMIN'] }),
            },
          ),
        },
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], {
            tenant: () => ({ enabledFeatures: [] }),
          }),
        },
      ],
    });
    service = TestBed.inject(NavigationService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('groups es un array computado', () => {
    expect(Array.isArray(service.groups())).toBeTrue();
  });

  it('isVisible retorna booleano', () => {
    const result = service.isVisible({ id: 'test', label: 'Test', route: '/test' });
    expect(typeof result).toBe('boolean');
  });
});
