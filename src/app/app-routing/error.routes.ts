import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';

/**
 * Layout-less error pages. Catch-all wildcard at the bottom redirects every
 * unknown URL to `/404` so users never land on a blank screen.
 */
export const ERROR_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    loadComponent: () =>
      import('@layout/blank-layout/blank-layout.component').then((m) => m.BlankLayoutComponent),
    children: [
      {
        canDeactivate: [pendingChangesGuard],
        path: '403',
        data: { title: 'Acceso denegado' },
        loadComponent: () =>
          import('@features/errors/pages/forbidden/forbidden.component').then(
            (m) => m.ForbiddenComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
        path: '404',
        data: { title: 'Página no encontrada' },
        loadComponent: () =>
          import('@features/errors/pages/not-found/not-found.component').then(
            (m) => m.NotFoundComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '404' },
];
