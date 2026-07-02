import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Reports feature routes.
 *
 * <p>Role-gated (TENANT_ADMIN + TEACHER + STAFF) until the security
 * sprint introduces the relacional role↔{@code reports:*} domain:action
 * model — see DEBT-SEC-1. Mirrors the `roles:` list declared in
 * {@code layout/config/navigation.config.ts} so the sidebar and the route
 * guard stay in sync.</p>
 */
export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin, UserRole.Teacher, UserRole.Staff] },
    loadComponent: () =>
      import('./pages/reports-home/reports-home.component').then((m) => m.ReportsHomeComponent),
  },
];
