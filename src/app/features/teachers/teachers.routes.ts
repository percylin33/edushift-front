import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes for the {@code teachers} module (FE-4.6).
 *
 * <ul>
 *   <li>{@code /teachers}             → list, filtros, padrón.</li>
 *   <li>{@code /teachers/new}         → form (alta).</li>
 *   <li>{@code /teachers/:id}         → detail con tabs.</li>
 *   <li>{@code /teachers/:id/edit}    → form (edición).</li>
 * </ul>
 *
 * <p>Mismo trade-off que students/users: el Sprint 4 mantiene el
 * módulo gateado por rol ({@code TENANT_ADMIN}). Las permissions
 * fine-grained {@code teachers:*} llegan con la security sprint.
 * El backend ya enforce {@code @PreAuthorize("hasRole('TENANT_ADMIN')")}
 * en cada endpoint, así que el guard es UX hint (evitar pintar la
 * pantalla a quien no le sirve), no perímetro.</p>
 */
export const TEACHERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin], title: 'Docentes' },
    loadComponent: () =>
      import('./pages/teachers-list/teachers-list.component').then(
        (m) => m.TeachersListComponent
      )
  },
  {
    path: 'new',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Nuevo',
      title: 'Nuevo docente'
    },
    loadComponent: () =>
      import('./pages/teacher-form/teacher-form.component').then(
        (m) => m.TeacherFormComponent
      )
  },
  {
    path: ':id',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Detalle',
      title: 'Docente'
    },
    loadComponent: () =>
      import('./pages/teacher-detail/teacher-detail.component').then(
        (m) => m.TeacherDetailComponent
      )
  },
  {
    path: ':id/edit',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Editar',
      title: 'Editar docente'
    },
    loadComponent: () =>
      import('./pages/teacher-form/teacher-form.component').then(
        (m) => m.TeacherFormComponent
      )
  }
];
