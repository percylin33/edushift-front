import { Routes } from '@angular/router';
import { authChildGuard } from '@core/guards';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [authChildGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/profile-page/profile-page.component').then((m) => m.ProfilePageComponent),
      },
    ],
  },
];
