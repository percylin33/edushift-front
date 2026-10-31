import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { authChildGuard } from '@core/guards';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [authChildGuard],
    children: [
      {
        canDeactivate: [pendingChangesGuard],
    path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/profile-page/profile-page.component').then((m) => m.ProfilePageComponent),
      },
    ],
  },
];
