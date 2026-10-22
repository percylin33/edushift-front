import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';
import { AdminLayoutComponent } from './layouts';

export const ADMIN_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    component: AdminLayoutComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.SuperAdmin] },
    children: [
      {
        canDeactivate: [pendingChangesGuard],
    path: 'dashboard',
        data: { title: 'Admin - Dashboard', breadcrumb: 'Dashboard' },
        loadComponent: () =>
          import('./pages/dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'tenants',
        data: { title: 'Admin - Instituciones', breadcrumb: 'Instituciones' },
        loadComponent: () =>
          import('./pages/tenants/admin-tenants.component').then((m) => m.AdminTenantsComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'tenants/:uuid',
        data: { title: 'Admin - Institución', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/tenants/admin-tenant-detail.component').then((m) => m.AdminTenantDetailComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'plans',
        data: { title: 'Admin - Planes', breadcrumb: 'Planes' },
        loadComponent: () =>
          import('./pages/plans/admin-plans.component').then((m) => m.AdminPlansComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'ai/global-sources',
        data: { title: 'Admin - Fuentes RAG EduShift', breadcrumb: 'Fuentes RAG' },
        loadComponent: () =>
          import('./pages/ai-global-sources/admin-ai-global-sources.component')
            .then((m) => m.AdminAiGlobalSourcesComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'plans/new',
        data: { title: 'Admin - Nuevo Plan', breadcrumb: 'Nuevo' },
        loadComponent: () =>
          import('./pages/plans/admin-plans.component').then((m) => m.AdminPlansComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'plans/:uuid',
        data: { title: 'Admin - Plan', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/plans/admin-plans.component').then((m) => m.AdminPlansComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'invoices',
        data: { title: 'Admin - Facturas', breadcrumb: 'Facturas' },
        loadComponent: () =>
          import('./pages/invoices/admin-invoices.component').then((m) => m.AdminInvoicesComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'invoices/:uuid',
        data: { title: 'Admin - Factura', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/invoices/admin-invoices.component').then((m) => m.AdminInvoicesComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'payments',
        data: { title: 'Admin - Pagos', breadcrumb: 'Pagos' },
        loadComponent: () =>
          import('./pages/payments/admin-payments.component').then((m) => m.AdminPaymentsComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'metrics',
        data: { title: 'Admin - Métricas', breadcrumb: 'Métricas' },
        loadComponent: () =>
          import('./pages/metrics/admin-metrics.component').then((m) => m.AdminMetricsComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'metrics/:uuid',
        data: { title: 'Admin - Métricas', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/metrics/admin-metrics.component').then((m) => m.AdminMetricsComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'audit',
        data: { title: 'Admin - Auditoría', breadcrumb: 'Auditoría' },
        loadComponent: () =>
          import('./pages/audit/admin-audit.component').then((m) => m.AdminAuditComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'super-admins',
        data: { title: 'Admin - Cuentas de plataforma', breadcrumb: 'Cuentas de plataforma' },
        loadComponent: () =>
          import('./pages/super-admins/admin-super-admins.component').then((m) => m.AdminSuperAdminsComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'support',
        data: { title: 'Admin - Soporte', breadcrumb: 'Soporte' },
        loadComponent: () =>
          import('./pages/support/admin-support.component').then((m) => m.AdminSupportComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'claims',
        data: { title: 'Admin - Reclamos', breadcrumb: 'Reclamos' },
        loadComponent: () =>
          import('./pages/claims/admin-claims.component').then((m) => m.AdminClaimsComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
];
