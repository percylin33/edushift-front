import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard, roleGuard } from '@core/guards';
import { Permission, UserRole } from '@core/enums';

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
    canDeactivate: [pendingChangesGuard],
    path: '',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: Permission.StudentsReadGranular,
      title: 'Estudiantes',
    },
    loadComponent: () =>
      import('./pages/students-list/students-list.component').then((m) => m.StudentsListComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'new',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: Permission.StudentsCreateGranular,
      breadcrumb: 'Nuevo',
      title: 'Nuevo estudiante',
    },
    loadComponent: () =>
      import('./pages/student-form/student-form.component').then((m) => m.StudentFormComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: ':id',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: Permission.StudentsReadGranular,
      breadcrumb: 'Detalle',
      title: 'Estudiante',
    },
    loadComponent: () =>
      import('./pages/student-detail/student-detail.component').then(
        (m) => m.StudentDetailComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: ':id/edit',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      permissions: Permission.StudentsUpdateGranular,
      breadcrumb: 'Editar',
      title: 'Editar estudiante',
    },
    loadComponent: () =>
      import('./pages/student-form/student-form.component').then((m) => m.StudentFormComponent),
  },
  {
    /* FE-6.3 — Credencial QR del alumno. TEACHER también, alineado con
     * el endpoint backend que permite hasAnyRole('TENANT_ADMIN','TEACHER').
     * El botón de rotación dentro de la página queda gateado por canRotate
     * (solo TENANT_ADMIN), reflejando el RBAC del POST /attendance-qr/rotate. */
    canDeactivate: [pendingChangesGuard],
    path: ':id/qr',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin, UserRole.Teacher],
      breadcrumb: 'Credencial',
      title: 'Credencial QR',
    },
    loadComponent: () =>
      import('./pages/student-qr/student-qr.component').then((m) => m.StudentQrPageComponent),
  },
];
