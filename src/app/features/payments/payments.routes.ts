import { Routes } from '@angular/router';

export const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/payments-home/payments-home.component').then((m) => m.PaymentsHomeComponent)
  }
];
