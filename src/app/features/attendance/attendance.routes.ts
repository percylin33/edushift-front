import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission, UserRole } from '@core/enums';

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
 *   <li>Routes accept TENANT_ADMIN / TEACHER or a matching staff
 *       permission. This matches the sidebar
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
    canDeactivate: [pendingChangesGuard],
    path: 'scanner',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.Teacher, UserRole.TenantAdmin],
      permissions: Permission.AttendanceRegister,
    },
    loadComponent: () =>
      import('./pages/attendance-scanner/attendance-scanner.page').then(
        (m) => m.AttendanceScannerPageComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'hub',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.Teacher, UserRole.TenantAdmin],
      permissions: Permission.AttendanceReadGranular,
    },
    loadComponent: () =>
      import('./pages/attendance-home/attendance-home.component').then(
        (m) => m.AttendanceHomeComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'sessions',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.Teacher, UserRole.TenantAdmin],
      permissions: Permission.AttendanceReadGranular,
    },
    loadComponent: () =>
      import('./pages/attendance-sessions-list/attendance-sessions-list.page').then(
        (m) => m.AttendanceSessionsListPageComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'sessions/:uuid',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.Teacher, UserRole.TenantAdmin],
      permissions: Permission.AttendanceReadGranular,
    },
    loadComponent: () =>
      import('./pages/attendance-session-detail/attendance-session-detail.page').then(
        (m) => m.AttendanceSessionDetailPageComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'reports',
    canMatch: [permissionGuard],
    data: {
      roles: [UserRole.Teacher, UserRole.TenantAdmin],
      permissions: [Permission.AttendanceReadGranular, Permission.ReportsReadGranular],
    },
    loadComponent: () =>
      import('./pages/attendance-reports/attendance-reports.page').then(
        (m) => m.AttendanceReportsPageComponent,
      ),
  },
];
