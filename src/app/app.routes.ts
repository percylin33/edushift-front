import { Routes } from '@angular/router';
import { ERROR_ROUTES, PRIVATE_ROUTES, PUBLIC_ROUTES } from './app-routing';
import { PAYMENTS_ROUTES } from './features/payments/payments.routes';

/**
 * Top-level route composition. Three logical areas, each in its own file:
 *
 *   - `PUBLIC_ROUTES`   → `/auth/*`, `/onboarding/*` (no session required)
 *   - `PRIVATE_ROUTES`  → `/dashboard`, `/students`, …  (session + tenant)
 *   - `ERROR_ROUTES`    → `/403`, `/404` + wildcard catch-all
 *
 * Order matters: the empty redirect to `/dashboard` ships first, then the
 * three areas (PUBLIC and PRIVATE both mount on the empty path with their
 * own layout components, Angular Router resolves them by their child paths).
 * `ERROR_ROUTES` must come last because of its `**` wildcard.
 *
 * Sprint 10 / FE-10.1: payments feature is mounted as a top-level
 * lazy-loaded child route. We keep it parallel to the others so the
 * layout components can wrap it consistently.
 *
 * Sprint 15 / FE-15.1–FE-15.7: admin console (super-admin platform
 * management). The login page is a standalone public route; the admin
 * shell (`AdminLayoutComponent`) is role-gated by `roleGuard` with
 * `SUPER_ADMIN`. Both are top-level (not under MainLayoutComponent)
 * because the admin shell has no tenant context and no `X-Tenant-Slug`
 * header.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,
  {
    path: 'payments',
    children: PAYMENTS_ROUTES,
  },
  // Sprint 15 — admin console (top-level, no tenant context).
  {
    path: 'admin/login',
    data: { title: 'Admin - Ingreso' },
    loadComponent: () =>
      import('./features/admin/pages/login/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  // Sprint 17 — Centro de Pruebas (`/help`). Top-level so SUPER_ADMIN
  // can reach it without a tenant context. The route is wrapped in
  // MainLayoutComponent when a tenant is present (handled inside the
  // feature via its own guard); without a tenant, the layout component
  // itself skips tenant-bound chrome. We mount it under the private tree
  // — see below — and ALSO expose it here so SUPER_ADMIN can navigate to
  // `/help` directly. The `canActivateChild: authChildGuard` in
  // `help.routes.ts` ensures the user is logged in.
  {
    path: 'help',
    loadChildren: () => import('./features/help/help.routes').then((m) => m.HELP_ROUTES),
  },
  ...ERROR_ROUTES,
];
