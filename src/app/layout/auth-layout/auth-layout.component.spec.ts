import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLayoutComponent } from './auth-layout.component';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TenantService } from '@core/services';
import { TenantStatus } from '@core/enums';
import { Tenant, TenantContext } from '@core/models';
import { TenantAssetsService } from '@core/theming/tenant-assets.service';

describe('AuthLayoutComponent', () => {
  let component: AuthLayoutComponent;
  let fixture: ComponentFixture<AuthLayoutComponent>;
  let tenantSignal: ReturnType<typeof signal<Tenant | null>>;
  let contextSignal: ReturnType<typeof signal<TenantContext>>;

  beforeEach(async () => {
    tenantSignal = signal<Tenant | null>(null);
    contextSignal = signal<TenantContext>({ tenant: null, resolvedFrom: 'unknown' });

    await TestBed.configureTestingModule({
      imports: [AuthLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantService,
          useValue: {
            tenant: tenantSignal.asReadonly(),
            context: contextSignal.asReadonly(),
          },
        },
        {
          provide: TenantAssetsService,
          useValue: {
            loginBgUrl: signal('/branding/default-login-bg.svg').asReadonly(),
            primaryColor: signal(null).asReadonly(),
            fullLogoUrl: signal('/branding/default-logo.svg').asReadonly(),
            markUrl: signal('/branding/default-logo.svg').asReadonly(),
            alt: signal('Logo').asReadonly(),
            initial: signal('E').asReadonly(),
            loginTitle: signal(null).asReadonly(),
            loginDescription: signal(null).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('appName está definido', () => {
    expect(component.appName).toBeDefined();
  });

  it('year es el año actual', () => {
    expect(component.year).toBe(new Date().getFullYear());
  });

  it('sin URL de tenant muestra gate needs-link', () => {
    contextSignal.set({ tenant: null, resolvedFrom: 'default' });
    fixture.detectChanges();
    expect(component.shellState()).toBe('needs-link');
  });

  it('tenantName usa el nombre del tenant hidratado', () => {
    const tenant: Tenant = {
      id: '019ec200-4a00-7000-8001-000000000001',
      slug: 'acme',
      name: 'Mi Escuela',
      status: TenantStatus.Active,
      isActive: true,
    };
    tenantSignal.set(tenant);
    contextSignal.set({ tenant, resolvedFrom: 'path' });
    fixture.detectChanges();
    expect(component.tenantName()).toBe('Mi Escuela');
    expect(component.shellState()).toBe('ready');
  });
});
