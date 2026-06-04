import { Routes } from '@angular/router';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/notifications-home/notifications-home.component').then(
        (m) => m.NotificationsHomeComponent
      )
  }
];
