import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards';
import { UserRole } from '@core/enums';

/**
 * Routes for the {@code attendance} module (Sprint 6).
 *
 * <h3>Layout</h3>
 * Primary landing is the gate scanner (`/attendance` → redirect to
 * {@code scanner}). Sessions list remains the by-section / review
 * flow. Detail is {@code sessions/:uuid}.
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
    pathMatch: 'full',
    redirectTo: 'scanner',
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
    path: 'hub',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Teacher, UserRole.TenantAdmin] },
    loadComponent: () =>
      import('./pages/attendance-home/attendance-home.component').then(
        (m) => m.AttendanceHomeComponent,
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
  {
    path: 'reports',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Teacher, UserRole.TenantAdmin, UserRole.Staff] },
    loadComponent: () =>
      import('./pages/attendance-reports/attendance-reports.page').then(
        (m) => m.AttendanceReportsPageComponent,
      ),
  },
];
