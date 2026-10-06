import { TestBed } from '@angular/core/testing';
import {
  TenantAssetsService,
  toSameOriginAssetUrl,
  PLATFORM_DEFAULT_LOGO_URL,
  PLATFORM_DEFAULT_MARK_URL,
  PLATFORM_DEFAULT_LOGIN_BG_URL,
} from './tenant-assets.service';
import { TenantService } from '@core/services/tenant.service';
import { ThemeService } from '@core/services/theme.service';

describe('TenantAssetsService', () => {
  let service: TenantAssetsService;
  let currentTenant: { name?: string; branding?: Record<string, unknown> } | null;

  beforeEach(() => {
    currentTenant = null;
    TestBed.configureTestingModule({
      providers: [
        TenantAssetsService,
        {
          provide: TenantService,
          useValue: { tenant: () => currentTenant },
        },
        {
          provide: ThemeService,
          useValue: { isDark: () => false },
        },
      ],
    });
    service = TestBed.inject(TenantAssetsService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('fullLogoUrl usa el logo genérico sin tenant', () => {
    expect(service.fullLogoUrl()).toBe(PLATFORM_DEFAULT_LOGO_URL);
  });

  it('markUrl usa el isotipo de plataforma sin tenant', () => {
    expect(service.markUrl()).toBe(PLATFORM_DEFAULT_MARK_URL);
  });

  it('alt retorna Logo por defecto', () => {
    expect(service.alt()).toBe('Logo');
  });

  it('initial retorna E por defecto', () => {
    expect(service.initial()).toBe('E');
  });

  it('initial usa la primera letra del tenant', () => {
    currentTenant = { name: 'Acme School' };
    expect(service.initial()).toBe('A');
  });

  it('loginBgUrl usa el fondo genérico sin tenant', () => {
    expect(service.loginBgUrl()).toBe(PLATFORM_DEFAULT_LOGIN_BG_URL);
  });

  it('respeta logo y fondo personalizados del tenant', () => {
    currentTenant = {
      name: 'Acme School',
      branding: {
        logo: { light: 'https://cdn.example/logo.png' },
        loginBgUrl: 'https://cdn.example/campus.jpg',
      },
    };
    expect(service.fullLogoUrl()).toBe('https://cdn.example/logo.png');
    expect(service.markUrl()).toBe('https://cdn.example/logo.png');
    expect(service.loginBgUrl()).toBe('https://cdn.example/campus.jpg');
    expect(service.hasCustomLogo()).toBeTrue();
    expect(service.hasCustomLoginBg()).toBeTrue();
  });

  it('toSameOriginAssetUrl reescribe URLs del API a path relativo', () => {
    expect(
      toSameOriginAssetUrl(
        'http://localhost:8081/api/v1/files/public/0a8c3cb7-f02a-418c-8b14-0c99656d913f',
      ),
    ).toBe('/api/v1/files/public/0a8c3cb7-f02a-418c-8b14-0c99656d913f');
  });

  it('toSameOriginAssetUrl deja URLs externas intactas', () => {
    const unsplash = 'https://images.unsplash.com/photo-x';
    expect(toSameOriginAssetUrl(unsplash)).toBe(unsplash);
  });

  it('primaryColor es null sin tenant', () => {
    expect(service.primaryColor()).toBeNull();
  });
});
