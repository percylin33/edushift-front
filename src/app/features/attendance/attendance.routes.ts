import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes for the {@code attendance} module (Sprint 6).
 *
 * <h3>Layout</h3>
 * Flat list of three primary routes — home, scanner, sessions —
 * plus the dynamic sessions/:uuid detail. The list of sessions is
 * the one that introduces URL-synced filters
 * (`?date=…&sectionPublicUuid=…&slot=…&status=…`); sharing a
 * filtered URL reproduces the same view on the recipient's screen
 * (FE-6.2).
 *
 * <h3>Guards</h3>
 * <ul>
 *   <li>{@code roleGuard} on every route — only TEACHER and
 *       TENANT_ADMIN can open attendance. This matches the sidebar
 *       visibility in {@code navigation.config.ts} which is role-gated
 *       (FIX BUG-2026-07-30-06: previously the home also required
 *       {@code AttendanceRead}, which blocked TENANT_ADMIN despite
 *       the sidebar item being visible to them).</li>
 * </ul>
 */
export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Teacher, UserRole.TenantAdmin] },
    loadComponent: () =>
      import('./pages/attendance-home/attendance-home.component').then(
        (m) => m.AttendanceHomeComponent,
      ),
  },
  {
    path: 'scanner',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Teacher, UserRole.TenantAdmin] },
    loadComponent: () =>
      import('./pages/attendance-scanner/attendance-scanner.page').then(
        (m) => m.AttendanceScannerPageComponent,
      ),
  },
  {
    path: 'sessions',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Teacher, UserRole.TenantAdmin] },
    loadComponent: () =>
      import('./pages/attendance-sessions-list/attendance-sessions-list.page').then(
        (m) => m.AttendanceSessionsListPageComponent,
      ),
  },
  {
    path: 'sessions/:uuid',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Teacher, UserRole.TenantAdmin] },
    loadComponent: () =>
      import('./pages/attendance-session-detail/attendance-session-detail.page').then(
        (m) => m.AttendanceSessionDetailPageComponent,
      ),
  },
];
