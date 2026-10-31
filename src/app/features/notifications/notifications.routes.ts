import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { authChildGuard, permissionGuard } from '@core/guards';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    loadComponent: () =>
      import('./pages/notifications-home/notifications-home.component').then(
        (m) => m.NotificationsHomeComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'preferences',
    canActivate: [authChildGuard],
    loadComponent: () =>
      import('./pages/preferences-page/preferences-page.component').then(
        (m) => m.NotificationPreferencesPageComponent,
      ),
  },
  {
    // Sprint cierre-C / F11 — admin templates editor.
    // Gated by LMS_NOTIFICATIONS_MANAGE (matches @PreAuthorize on the BE).
    canDeactivate: [pendingChangesGuard],
    path: 'templates',
    canMatch: [permissionGuard],
    data: { permissions: 'LMS_NOTIFICATIONS_MANAGE' },
    loadComponent: () =>
      import('./pages/notification-templates-page/notification-templates-page.component').then(
        (m) => m.NotificationTemplatesPageComponent,
      ),
  },
];
