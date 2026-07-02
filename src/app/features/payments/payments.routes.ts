import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';

/**
 * Payments feature routes (Sprint 10 / FE-10.1 + Sprint 11 / FE-11.1).
 *
 * <p>Lazy-loaded; the parent route in {@code app.routes.ts} should
 * wire {@code loadChildren: () => import('./payments/payments.routes').then(m => m.PAYMENTS_ROUTES)}
 * under the {@code /payments} path.</p>
 */
export const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'invoices',
  },
  {
    path: 'invoices',
    loadComponent: () =>
      import('./pages/invoices-page/invoices-page.component').then((m) => m.InvoicesPageComponent),
  },
  {
    path: 'invoices/:publicUuid',
    loadComponent: () =>
      import('./pages/invoice-detail-page/invoice-detail-page.component').then(
        (m) => m.InvoiceDetailPageComponent,
      ),
  },
  // -------------------------------------------------------------------------
  // Admin surface (Sprint 11 / FE-11.1). Gated by `LMS_PAYMENT_ADMIN`,
  // matching the backend's `@PreAuthorize` on `AdminPaymentController`.
  // `permissionGuard` uses the JWT's `permissions` array populated by
  // `LmsRoleAuthorityMapper` (BE-7a.3) → (BE-11.7). Note: the authority
  // string is passed as a literal (matching the backend), not the
  // `Permission` enum, because `LMS_*` authorities are emitted as
  // verbatim strings by the backend — see `permission.enum.ts` for
  // the rationale.
  // -------------------------------------------------------------------------
  {
    path: 'admin',
    canMatch: [permissionGuard],
    data: { permissions: 'LMS_PAYMENT_ADMIN' },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/admin-payments-page/admin-payments-page.component').then(
            (m) => m.AdminPaymentsPageComponent,
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/admin-payments-page/admin-payments-page.component').then(
            (m) => m.AdminPaymentsPageComponent,
          ),
      },
    ],
  },
];
