import { Routes } from '@angular/router';
import { SessionsListComponent } from './pages';

export const SESSIONS_ROUTES: Routes = [
  {
    path: '',
    component: SessionsListComponent,
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/sessions-form/sessions-form.component').then((m) => m.SessionsFormComponent),
  },
  {
    path: ':id',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/sessions-detail/sessions-detail.component').then(
            (m) => m.SessionsDetailComponent,
          ),
      },
      {
        path: 'edit',
        loadComponent: () =>
          import('./pages/sessions-form/sessions-form.component').then(
            (m) => m.SessionsFormComponent,
          ),
      },
    ],
  },
];
