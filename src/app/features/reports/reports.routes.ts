import { pendingChangesGuard } from '@shared/services/form-protection.service';
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
    canDeactivate: [pendingChangesGuard],
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin, UserRole.Teacher, UserRole.Staff] },
    loadComponent: () =>
      import('./pages/reports-home/reports-home.component').then((m) => m.ReportsHomeComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'wizard',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin, UserRole.Teacher, UserRole.Staff] },
    loadComponent: () =>
      import('./pages/reports-wizard-page/reports-wizard-page.component').then(
        (m) => m.ReportsWizardPageComponent,
      ),
  },
  /*
   * Sprint cierre-C / F12 — report catalog (admin-only).
   * Shows every report_job in the tenant + a placeholder card for the
   * per-template cron scheduler arriving in cierre-C / B12.
   */
  {
    canDeactivate: [pendingChangesGuard],
    path: 'catalog',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin] },
    loadComponent: () =>
      import('./pages/report-catalog-page/report-catalog-page.component').then(
        (m) => m.ReportCatalogPageComponent,
      ),
  },
];
