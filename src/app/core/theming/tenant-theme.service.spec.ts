import { TestBed } from '@angular/core/testing';
import { TenantThemeService } from './tenant-theme.service';

describe('TenantThemeService', () => {
  let service: TenantThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TenantThemeService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('apply con null resetea estilos', () => {
    expect(() => service.apply(null)).not.toThrow();
  });

  it('reset no lanza error', () => {
    expect(() => service.reset()).not.toThrow();
  });

  it('apply con tenant establece data attributes', () => {
    const tenant = { id: 'tenant-1', slug: 'test-tenant', name: 'Test', branding: {} } as any;
    service.apply(tenant);
    expect(document.documentElement.dataset['tenant']).toBe('test-tenant');
    expect(document.documentElement.dataset['tenantId']).toBe('tenant-1');
  });
});
