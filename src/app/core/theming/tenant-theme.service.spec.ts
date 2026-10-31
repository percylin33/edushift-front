import { Tenant } from '@core/models';
import { TenantStatus } from '@core/enums';
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

describe('Primary action contrast', () => {
  const root = document.documentElement;
  const service = new TenantThemeService();
  afterEach(() => service.reset());
  for (const primaryColor of ['#ffff00', '#00ff00', '#ffffff', '#000000', '#0f62fe', '#818cf8']) {
    it(`keeps white button text readable for ${primaryColor}`, () => {
      const tenant: Tenant = { id: 'qa', slug: 'qa', name: 'QA', status: TenantStatus.Active,
        isActive: true, branding: { primaryColor } };
      service.apply(tenant);
      for (const token of ['--color-action-primary', '--color-action-primary-hover']) {
        const channels = root.style.getPropertyValue(token).trim().split(' ').map(Number).map(value => {
          const c = value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
      service.reset();
      expect(root.style.getPropertyValue('--color-action-primary')).toBe('');
    });
  }
});
