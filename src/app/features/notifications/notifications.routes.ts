import { Routes } from '@angular/router';
import { authChildGuard } from '@core/guards';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/notifications-home/notifications-home.component').then(
        (m) => m.NotificationsHomeComponent,
      ),
  },
  {
    path: 'preferences',
    canActivate: [authChildGuard],
    loadComponent: () =>
      import('./pages/preferences-page/preferences-page.component').then(
        (m) => m.NotificationPreferencesPageComponent,
      ),
  },
];
