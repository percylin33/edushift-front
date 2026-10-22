import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';
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
 *   <li>TENANT_ADMIN / payment staff → {@code /payments/admin/invoices}
 *       (admin invoice listing, gated by granular payment permissions).</li>
 *   <li>STUDENT / PARENT    → {@code /payments/invoices}
 *       (guardian listing).</li>
 * </ul>
 */
export const PAYMENTS_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    pathMatch: 'full',
    component: PaymentsRoleRedirectComponent,
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'invoices',
    loadComponent: () =>
      import('./pages/invoices-page/invoices-page.component').then((m) => m.InvoicesPageComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'invoices/:publicUuid',
    loadComponent: () =>
      import('./pages/invoice-detail-page/invoice-detail-page.component').then(
        (m) => m.InvoiceDetailPageComponent,
      ),
  },
  // -------------------------------------------------------------------------
  // Finance staff can reach operational payment pages through granular
  // authorities; subscription and policy configuration stays administrative.
  // `permissionGuard` uses the JWT's `permissions` array. The values in
  // `Permission` match the authorities emitted by the backend.
  // -------------------------------------------------------------------------
  {
    path: 'admin',
    canMatch: [permissionGuard],
    data: {
      refreshPermissions: true,
      permissions: [
        Permission.LmsPaymentAdmin,
        Permission.PaymentsReadGranular,
        Permission.PaymentsReceive,
        Permission.PaymentsReconcile,
        Permission.PaymentsRefund,
        Permission.PaymentsIssue,
        Permission.PaymentConceptsManage,
      ],
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'invoices',
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'payments',
        canMatch: [permissionGuard],
        data: {
          permissions: [Permission.LmsPaymentAdmin, Permission.PaymentsReadGranular],
        },
        loadComponent: () =>
          import('./pages/admin-payments-page/admin-payments-page.component').then(
            (m) => m.AdminPaymentsPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'invoices',
        canMatch: [permissionGuard],
        data: {
          collectionsTab: 'payments',
          permissions: [
            Permission.LmsPaymentAdmin,
            Permission.PaymentsReadGranular,
            Permission.PaymentsReconcile,
          ],
        },
        loadComponent: () =>
          import('./pages/admin-collections-page/admin-collections-page.component').then(
            (m) => m.AdminCollectionsPageComponent,
          ),
      },
      {
        // Sprint cierre-C / F14 — payment concepts catalog.
        canDeactivate: [pendingChangesGuard],
    path: 'concepts',
        canMatch: [permissionGuard],
        data: { permissions: [Permission.PaymentConceptsManage, Permission.LmsPaymentAdmin] },
        loadComponent: () =>
          import('./pages/payment-concepts-page/payment-concepts-page.component').then(
            (m) => m.PaymentConceptsPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'emit',
        canMatch: [permissionGuard],
        data: {
          collectionsTab: 'generate',
          permissions: [Permission.PaymentsIssue, Permission.LmsPaymentAdmin],
        },
        loadComponent: () =>
          import('./pages/admin-collections-page/admin-collections-page.component').then(
            (m) => m.AdminCollectionsPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'plans',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsPaymentAdmin },
        loadComponent: () =>
          import('./pages/admin-plans-page/admin-plans-page.component').then(
            (m) => m.AdminPlansPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'policy',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsPaymentAdmin },
        loadComponent: () =>
          import('./pages/admin-payment-policy-page/admin-payment-policy-page.component').then(
            (m) => m.AdminPaymentPolicyPageComponent,
          ),
      },
      {
        // Tenant payment methods (bank transfer / Yape / Plin) — the data
        // guardians read to pay an invoice.
        canDeactivate: [pendingChangesGuard],
    path: 'methods',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsPaymentAdmin },
        loadComponent: () =>
          import('./pages/admin-payment-methods-page/admin-payment-methods-page.component').then(
            (m) => m.AdminPaymentMethodsPageComponent,
          ),
      },
    ],
  },
];
