import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { PaymentsRoleRedirectComponent } from './pages/payments-role-redirect/payments-role-redirect.component';

/**
 * Payments feature routes (Sprint 10 / FE-10.1 + Sprint 11 / FE-11.1).
 *
 * <p>Lazy-loaded; the parent route in {@code app.routes.ts} should
 * wire {@code loadChildren: () => import('./payments/payments.routes').then(m => m.PAYMENTS_ROUTES)}
 * under the {@code /payments} path.</p>
 *
 * <h3>Entry-point resolver (FIX BUG-2026-07-30-07)</h3>
 * <p>{@code /payments} used to redirect to {@code /payments/invoices}
 * unconditionally. {@code InvoicesPageComponent} is a guardian-facing
 * screen that calls {@code GET /payments/invoices} (the current
 * user's own invoices); for {@code TENANT_ADMIN} that endpoint either
 * fails ("Failed to fetch") or returns an empty list, and the copy
 * ("Mis cuotas") is wrong for the admin. The new resolver picks the
 * right entry-point per role:</p>
 * <ul>
 *   <li>TENANT_ADMIN / STAFF → {@code /payments/admin/payments}
 *       (admin listing, gated by {@code LMS_PAYMENT_ADMIN}).</li>
 *   <li>STUDENT / PARENT    → {@code /payments/invoices}
 *       (guardian listing).</li>
 * </ul>
 */
export const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: PaymentsRoleRedirectComponent,
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
        redirectTo: 'invoices',
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/admin-payments-page/admin-payments-page.component').then(
            (m) => m.AdminPaymentsPageComponent,
          ),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./pages/admin-invoices-page/admin-invoices-page.component').then(
            (m) => m.AdminInvoicesPageComponent,
          ),
      },
      {
        // Sprint cierre-C / F14 — payment concepts catalog.
        path: 'concepts',
        loadComponent: () =>
          import('./pages/payment-concepts-page/payment-concepts-page.component').then(
            (m) => m.PaymentConceptsPageComponent,
          ),
      },
      {
        path: 'emit',
        loadComponent: () =>
          import('./pages/admin-emit-page/admin-emit-page.component').then(
            (m) => m.AdminEmitPageComponent,
          ),
      },
      {
        path: 'plans',
        loadComponent: () =>
          import('./pages/admin-plans-page/admin-plans-page.component').then(
            (m) => m.AdminPlansPageComponent,
          ),
      },
      {
        path: 'policy',
        loadComponent: () =>
          import('./pages/admin-payment-policy-page/admin-payment-policy-page.component').then(
            (m) => m.AdminPaymentPolicyPageComponent,
          ),
      },
    ],
  },
];
