import { Routes } from '@angular/router';

/**
 * Payments feature routes (Sprint 10 / FE-10.1).
 *
 * <p>Lazy-loaded; the parent route in {@code app.routes.ts} should
 * wire {@code loadChildren: () => import('./payments/payments.routes').then(m => m.PAYMENTS_ROUTES)}
 * under the {@code /payments} path.</p>
 */
export const PAYMENTS_ROUTES: Routes = [
  {
    path: 'invoices',
    loadComponent: () =>
      import('./pages/invoices-page/invoices-page.component')
        .then((m) => m.InvoicesPageComponent)
  },
  {
    path: 'invoices/:publicUuid',
    loadComponent: () =>
      import('./pages/invoice-detail-page/invoice-detail-page.component')
        .then((m) => m.InvoiceDetailPageComponent)
  }
];
