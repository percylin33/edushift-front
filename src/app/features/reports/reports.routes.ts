import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permissions: [Permission.ReportsRead] },
    loadComponent: () =>
      import('./pages/reports-home/reports-home.component').then((m) => m.ReportsHomeComponent)
  }
];
