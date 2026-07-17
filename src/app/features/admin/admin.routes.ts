import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';
import { AdminLayoutComponent } from './layouts';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.SuperAdmin] },
    children: [
      {
        path: 'dashboard',
        data: { title: 'Admin - Dashboard', breadcrumb: 'Dashboard' },
        loadComponent: () =>
          import('./pages/dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'tenants',
        data: { title: 'Admin - Instituciones', breadcrumb: 'Instituciones' },
        loadComponent: () =>
          import('./pages/tenants/admin-tenants.component').then((m) => m.AdminTenantsComponent),
      },
      {
        path: 'tenants/:uuid',
        data: { title: 'Admin - Institución', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/tenants/admin-tenant-detail.component').then((m) => m.AdminTenantDetailComponent),
      },
      {
        path: 'plans',
        data: { title: 'Admin - Planes', breadcrumb: 'Planes' },
        loadComponent: () =>
          import('./pages/plans/admin-plans.component').then((m) => m.AdminPlansComponent),
      },
      {
        path: 'plans/new',
        data: { title: 'Admin - Nuevo Plan', breadcrumb: 'Nuevo' },
        loadComponent: () =>
          import('./pages/plans/admin-plans.component').then((m) => m.AdminPlansComponent),
      },
      {
        path: 'plans/:uuid',
        data: { title: 'Admin - Plan', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/plans/admin-plans.component').then((m) => m.AdminPlansComponent),
      },
      {
        path: 'invoices',
        data: { title: 'Admin - Facturas', breadcrumb: 'Facturas' },
        loadComponent: () =>
          import('./pages/invoices/admin-invoices.component').then((m) => m.AdminInvoicesComponent),
      },
      {
        path: 'invoices/:uuid',
        data: { title: 'Admin - Factura', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/invoices/admin-invoices.component').then((m) => m.AdminInvoicesComponent),
      },
      {
        path: 'payments',
        data: { title: 'Admin - Pagos', breadcrumb: 'Pagos' },
        loadComponent: () =>
          import('./pages/payments/admin-payments.component').then((m) => m.AdminPaymentsComponent),
      },
      {
        path: 'metrics',
        data: { title: 'Admin - Métricas', breadcrumb: 'Métricas' },
        loadComponent: () =>
          import('./pages/metrics/admin-metrics.component').then((m) => m.AdminMetricsComponent),
      },
      {
        path: 'metrics/:uuid',
        data: { title: 'Admin - Métricas', breadcrumb: 'Detalle' },
        loadComponent: () =>
          import('./pages/metrics/admin-metrics.component').then((m) => m.AdminMetricsComponent),
      },
      {
        path: 'audit',
        data: { title: 'Admin - Auditoría', breadcrumb: 'Auditoría' },
        loadComponent: () =>
          import('./pages/audit/admin-audit.component').then((m) => m.AdminAuditComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
];
