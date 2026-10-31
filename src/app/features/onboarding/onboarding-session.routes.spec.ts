import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService, TenantService } from '@core/services';
import { PUBLIC_ROUTES } from '../../app-routing/public.routes';

@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class WizardShell {}
@Component({ standalone: true, template: '<h1>Configurar institución</h1>' })
class SchoolStep {}
@Component({ standalone: true, template: '<h1>Iniciar sesión</h1>' })
class SchoolLogin {}

describe('Onboarding requires a session before showing upload controls', () => {
  let signedIn: boolean;
  beforeEach(() => {
    signedIn = false;
    const wizard = PUBLIC_ROUTES.find((route) => route.path === 'onboarding')!;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => signedIn,
            user: () => ({ mustChangePassword: false }),
          },
        },
        {
          provide: TenantService,
          useValue: { tenant: () => ({ slug: 'colegioqa' }), setTenant: () => undefined },
        },
        provideRouter([
          {
            ...wizard,
            component: WizardShell,
            loadComponent: undefined,
            loadChildren: undefined,
            children: [{ path: 'school', component: SchoolStep }],
          },
          { path: 'auth/login', component: SchoolLogin },
        ]),
      ],
    });
  });
  it('redirects a new origin without a session to login, preserving the onboarding destination', async () => {
    const harness = await RouterTestingHarness.create('/onboarding/school');
    expect(TestBed.inject(Router).url).toContain('/auth/login?');
    expect(TestBed.inject(Router).url).toContain('returnUrl=%2Fonboarding%2Fschool');
    expect(harness.routeNativeElement?.textContent).toContain('Iniciar sesión');
    expect(harness.routeNativeElement?.textContent).not.toContain('Configurar institución');
  });
  it('allows the wizard after the school session is established', async () => {
    signedIn = true;
    const harness = await RouterTestingHarness.create('/onboarding/school');
    expect(TestBed.inject(Router).url).toBe('/onboarding/school');
    expect(harness.routeNativeElement?.textContent).toContain('Configurar institución');
  });
});
