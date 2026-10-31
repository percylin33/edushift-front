import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { SessionsListComponent } from './pages';

export const SESSIONS_ROUTES: Routes = [
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    component: SessionsListComponent,
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'new',
    loadComponent: () =>
      import('./pages/sessions-form/sessions-form.component').then((m) => m.SessionsFormComponent),
  },
  {
    path: ':id',
    children: [
      {
        canDeactivate: [pendingChangesGuard],
    path: '',
        loadComponent: () =>
          import('./pages/sessions-detail/sessions-detail.component').then(
            (m) => m.SessionsDetailComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'edit',
        loadComponent: () =>
          import('./pages/sessions-form/sessions-form.component').then(
            (m) => m.SessionsFormComponent,
          ),
      },
    ],
  },
];
