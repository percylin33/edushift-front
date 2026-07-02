import { TestBed } from '@angular/core/testing';
import { TenantAssetsService } from './tenant-assets.service';
import { TenantService } from '@core/services/tenant.service';
import { ThemeService } from '@core/services/theme.service';

describe('TenantAssetsService', () => {
  let service: TenantAssetsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TenantAssetsService,
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], { tenant: () => null }),
        },
        {
          provide: ThemeService,
          useValue: jasmine.createSpyObj('ThemeService', [], { isDark: () => false }),
        },
      ],
    });
    service = TestBed.inject(TenantAssetsService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('fullLogoUrl es null sin tenant', () => {
    expect(service.fullLogoUrl()).toBeNull();
  });

  it('markUrl es null sin tenant', () => {
    expect(service.markUrl()).toBeNull();
  });

  it('alt retorna Logo por defecto', () => {
    expect(service.alt()).toBe('Logo');
  });

  it('initial retorna E por defecto', () => {
    expect(service.initial()).toBe('E');
  });

  it('initial usa la primera letra del tenant', () => {
    const tenantService = TestBed.inject(TenantService);
    (tenantService.tenant as unknown as jasmine.Spy).and.returnValue({ name: 'Acme School' });
    expect(service.initial()).toBe('A');
  });
});
