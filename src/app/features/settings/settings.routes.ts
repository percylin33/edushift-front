import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permissions: [Permission.SettingsRead, Permission.SettingsManage] },
    loadComponent: () =>
      import('./pages/settings-home/settings-home.component').then(
        (m) => m.SettingsHomeComponent
      )
  }
];
