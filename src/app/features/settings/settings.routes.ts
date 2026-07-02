import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Settings feature routes (Sprint 17 / FE-17.4).
 *
 * <p>The shell component owns the left-side navigation and renders the
 * active sub-page via {@code <router-outlet/>}. All sub-pages live
 * under the same TENANT_ADMIN role guard until the security sprint
 * introduces the relacional role↔{@code settings:*} domain:action
 * model — see DEBT-SEC-1. The frontend still keeps the
 * {@code Permission.SettingsRead} / {@code Permission.SettingsManage}
 * enum entries for forward-compat: once the relacional model ships,
 * the route table can swap back to {@code permissionGuard} without
 * changing the public route shape.</p>
 *
 * <h3>Sub-pages</h3>
 * <ul>
 *   <li>{@code /settings}                  — user account overview (FE-17.4)</li>
 *   <li>{@code /settings/security}        — security / MFA / password (FE-17.4)</li>
 *   <li>{@code /settings/tenant}         — tenant branding (TENANT_ADMIN, FE-17.4)</li>
 * </ul>
 *
 * The shell itself is hidden for non-ADMIN, but the home page
 * (account overview) is harmless to show anyone. Each sub-page
 * independently enforces its own role/permission rules.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    // Auth check is provided by `authChildGuard` in `private.routes.ts`
    // (the feature-flag guard is the outer route gate). The inner
    // tenant sub-route applies the role guard.
    loadComponent: () =>
      import('./pages/settings-shell/settings-shell.component').then(
        (m) => m.SettingsShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/user-settings/user-settings.component').then(
            (m) => m.UserSettingsComponent,
          ),
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./pages/security-settings/security-settings.component').then(
            (m) => m.SecuritySettingsComponent,
          ),
      },
      {
        path: 'tenant',
        canActivate: [roleGuard],
        data: { roles: [UserRole.TenantAdmin] },
        loadComponent: () =>
          import('./pages/tenant-settings/tenant-settings.component').then(
            (m) => m.TenantSettingsComponent,
          ),
      },
    ],
  },
];
