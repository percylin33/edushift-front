import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes for the {@code users} management module. Two pages:
 *
 * <ul>
 *   <li>{@code /users} → list with filters & pagination.</li>
 *   <li>{@code /users/:id} → detail with profile / roles / lifecycle.</li>
 * </ul>
 *
 * <h3>Why role-based gates instead of permissions</h3>
 * Sprint 3 deliberately keeps user management tied to the
 * {@code TENANT_ADMIN} role until the fine-grained permission catalog
 * lands in a dedicated security sprint. The decision is recorded in
 * {@code docs/product/sprints/sprint-03-users-students.md}; the same
 * gate is enforced server-side via {@code @PreAuthorize} so this is
 * a UX hint, not the security perimeter.
 */
export const USERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.TenantAdmin], title: 'Usuarios' },
    loadComponent: () =>
      import('./pages/users-list/users-list.component').then((m) => m.UsersListComponent)
  },
  {
    path: ':id',
    canActivate: [roleGuard],
    data: {
      roles: [UserRole.TenantAdmin],
      breadcrumb: 'Detalle',
      title: 'Detalle de usuario'
    },
    loadComponent: () =>
      import('./pages/user-detail/user-detail.component').then((m) => m.UserDetailComponent)
  }
];
