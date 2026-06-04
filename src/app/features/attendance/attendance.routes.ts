import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permissions: [Permission.AttendanceRead] },
    loadComponent: () =>
      import('./pages/attendance-home/attendance-home.component').then(
        (m) => m.AttendanceHomeComponent
      )
  }
];
