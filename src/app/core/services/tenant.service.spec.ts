import { TestBed } from '@angular/core/testing';
import { TenantService } from './tenant.service';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';
import { STORAGE_KEYS } from '@core/constants';
import { Tenant } from '@core/models';
import { TenantStatus, Theme } from '@core/enums';
import { environment } from '@env/environment';

class FakeThemeService {
  applyTenantDefault(_theme?: string) {}
}

describe('TenantService', () => {
  let service: TenantService;
  let storage: jasmine.SpyObj<StorageService>;

  const mockTenant: Tenant = {
    id: 't-1',
    slug: 'acme',
    name: 'Acme School',
    status: TenantStatus.Active,
    isActive: true,
    branding: {
      primaryColor: '#2563eb',
      defaultTheme: Theme.Light,
    },
  };

  beforeEach(() => {
    storage = jasmine.createSpyObj<StorageService>('StorageService', ['get', 'set', 'remove']);
    storage.get.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        { provide: StorageService, useValue: storage },
        { provide: ThemeService, useClass: FakeThemeService },
      ],
    });

    // By default, TenantThemeService is used by TenantService.
    // We provide a minimal mock via the useFactory approach.
    service = TestBed.inject(TenantService);
  });

  it('inicia sin tenant', () => {
    expect(service.tenant()).toBeNull();
    expect(service.tenantId()).toBeNull();
    expect(service.tenantSlug()).toBeNull();
  });

  it('setTenant actualiza el contexto y persiste slug', () => {
    service.setTenant(mockTenant, 'header');

    expect(service.tenant()?.slug).toBe('acme');
    expect(service.tenantId()).toBe('t-1');
    expect(service.tenantSlug()).toBe('acme');
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_TENANT, 'acme');
  });

  it('setTenant con persist: false no persiste slug', () => {
    service.setTenant(mockTenant, 'default', { persist: false });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('setTenant con null remueve slug', () => {
    service.setTenant(null);
    expect(service.tenant()).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_TENANT);
  });

  it('setSlug fija un tenant placeholder y persiste slug', () => {
    service.setSlug('  Mi-Cole  ');

    expect(service.tenantSlug()).toBe('mi-cole');
    expect(service.tenant()?.name).toBe('mi-cole');
    expect(service.tenant()?.status).toBe(TenantStatus.Active);
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_TENANT, 'mi-cole');
  });

  it('setSlug con string vacío no hace nada', () => {
    service.setSlug('  ');
    expect(service.tenant()).toBeNull();
  });

  it('clear resetea todo', () => {
    service.setTenant(mockTenant);
    service.clear();

    expect(service.tenant()).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_TENANT);
  });

  it('resolveSlug retorna defaultTenant cuando multiTenant está deshabilitado', () => {
    const result = service.resolveSlug();
    if (!environment.multiTenant.enabled) {
      expect(result.slug).toBe(environment.multiTenant.defaultTenant);
      expect(result.resolvedFrom).toBe('default');
    }
  });

  it('resolveSlug usa cached slug cuando no hay override', () => {
    if (!environment.multiTenant.enabled) return;

    storage.get.and.callFake(<T>(key: string, _engine?: any) => {
      if (key === STORAGE_KEYS.CURRENT_TENANT) return 'cached-school' as T;
      return null;
    });

    const result = service.resolveSlug();
    expect(result.slug).toBe('cached-school');
    expect(result.resolvedFrom).toBe('default');
  });
});
