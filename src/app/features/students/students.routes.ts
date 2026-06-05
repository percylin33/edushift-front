import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes for the {@code students} module.
 *
 * <ul>
 *   <li>{@code /students}            → list, filters, bulk import.</li>
 *   <li>{@code /students/new}        → create form.</li>
 *   <li>{@code /students/:id}        → read-only detail.</li>
 *   <li>{@code /students/:id/edit}   → edit form (same component as create).</li>
 * </ul>
 *
 * <h3>Why role-based gates instead of permissions</h3>
 * Mirrors the {@code USERS_ROUTES} decision: Sprint 3 keeps the module
 * tied to {@code TENANT_ADMIN}. The fine-grained {@code students:*}
 * permission catalog lands in a dedicated security sprint
 * (see {@code docs/product/sprints/sprint-03-users-students.md}).
 * The backend enforces {@code @PreAuthorize("hasRole('TENANT_ADMIN')")}
 * so this guard is a UX hint, not the perimeter.
 */
export const STUDENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin], title: 'Estudiantes' },
    loadComponent: () =>
      import('./pages/students-list/students-list.component').then(
        (m) => m.StudentsListComponent
      )
  },
  {
    path: 'new',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Nuevo',
      title: 'Nuevo estudiante'
    },
    loadComponent: () =>
      import('./pages/student-form/student-form.component').then(
        (m) => m.StudentFormComponent
      )
  },
  {
    path: ':id',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Detalle',
      title: 'Estudiante'
    },
    loadComponent: () =>
      import('./pages/student-detail/student-detail.component').then(
        (m) => m.StudentDetailComponent
      )
  },
  {
    path: ':id/edit',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Editar',
      title: 'Editar estudiante'
    },
    loadComponent: () =>
      import('./pages/student-form/student-form.component').then(
        (m) => m.StudentFormComponent
      )
  }
];
