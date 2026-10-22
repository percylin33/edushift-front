import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService, TenantService } from '@core/services';
import { tenantGuard } from '@core/guards';
import { PUBLIC_ROUTES } from '../../app-routing/public.routes';
import { AUTH_ROUTES } from './auth.routes';

@Component({ standalone: true, template: '<h1>Configura tu institución</h1>' })
class SetupPage {}
@Component({ standalone: true, template: '<h1>Panel del colegio</h1>' })
class DashboardPage {}
@Component({ standalone: true, template: '<h1>404</h1>' })
class NotFoundPage {}

// Exercise the real guards and public auth mount, without unrelated layout dependencies.
describe('School setup invitation routing', () => {
  let signedIn: boolean;
  let tenantSlug: string | null;
  beforeEach(() => {
    signedIn = false;
    tenantSlug = null;
    const authMount = PUBLIC_ROUTES.find(route => route.children?.some(child => child.path === 'auth'))!
      .children!.find(route => route.path === 'auth')!;
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { isAuthenticated: () => signedIn } },
      { provide: TenantService, useValue: { tenantSlug: () => tenantSlug } },
      provideRouter([
        { ...authMount, loadChildren: async () => AUTH_ROUTES.map(route => route.loadComponent ? { ...route, loadComponent: async () => SetupPage } : route) },
        { path: 'dashboard', canActivate: [tenantGuard], component: DashboardPage },
        { path: '404', component: NotFoundPage },
      ]),
    ] });
  });
  for (const path of ['setup-school', 'register']) {
    it(`${path} keeps the invitation accessible to a signed-in platform administrator`, async () => {
      signedIn = true;
      const url = `/auth/${path}?token=synthetic-invitation-token`;
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe(url);
      expect(harness.routeNativeElement?.textContent).toContain('Configura tu institución');
    });
    it(`${path} keeps the invitation accessible with an existing school session`, async () => {
      signedIn = true;
      tenantSlug = 'existing-school';
      const url = `/auth/${path}?token=synthetic-invitation-token`;
      await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe(url);
    });
    it(`${path} remains accessible without a session`, async () => {
      const url = `/auth/${path}?token=synthetic-invitation-token`;
      await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe(url);
    });
  }
});
