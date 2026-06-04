import { Routes } from '@angular/router';
import { BlankLayoutComponent } from '@layout/index';

/**
 * Layout-less error pages. Catch-all wildcard at the bottom redirects every
 * unknown URL to `/404` so users never land on a blank screen.
 */
export const ERROR_ROUTES: Routes = [
  {
    path: '',
    component: BlankLayoutComponent,
    children: [
      {
        path: '403',
        data: { title: 'Acceso denegado' },
        loadComponent: () =>
          import('@features/errors/pages/forbidden/forbidden.component').then(
            (m) => m.ForbiddenComponent
          )
      },
      {
        path: '404',
        data: { title: 'Página no encontrada' },
        loadComponent: () =>
          import('@features/errors/pages/not-found/not-found.component').then(
            (m) => m.NotFoundComponent
          )
      }
    ]
  },
  { path: '**', redirectTo: '404' }
];
