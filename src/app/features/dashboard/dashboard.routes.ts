import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    loadComponent: () =>
      import('./pages/dashboard-home/dashboard-home.component').then(
        (m) => m.DashboardHomeComponent,
      ),
  },
];
