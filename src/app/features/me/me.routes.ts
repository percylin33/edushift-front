import { Routes } from '@angular/router';
import { permissionGuard, roleGuard } from '@core/guards';
import { Permission, UserRole } from '@core/enums';
import { MeRoleRedirectComponent } from './pages/me-role-redirect/me-role-redirect.component';

/**
 * Personal workspace routes. Identity is JWT-only; never pass studentPublicUuid.
 */
export const ME_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: MeRoleRedirectComponent,
  },
  {
    path: 'profile',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeRead },
    loadComponent: () =>
      import('./pages/profile/me-profile.page').then((m) => m.MeProfilePageComponent),
  },
  {
    path: 'courses',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeRead },
    loadComponent: () =>
      import('./pages/courses/me-courses.page').then((m) => m.MeCoursesPageComponent),
  },
  {
    path: 'courses/:sectionPublicUuid',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeRead },
    loadComponent: () =>
      import('./pages/courses/me-course-detail.page').then(
        (m) => m.MeCourseDetailPageComponent,
      ),
  },
  {
    path: 'grades',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeRead },
    loadComponent: () =>
      import('./pages/grades/me-grades.page').then((m) => m.MeGradesPageComponent),
  },
  {
    path: 'attendance',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeAttendanceRead },
    loadComponent: () =>
      import('./pages/attendance/me-attendance.page').then(
        (m) => m.MeAttendancePageComponent,
      ),
  },
  {
    path: 'qr',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeQrRead },
    loadComponent: () => import('./pages/qr/me-qr.page').then((m) => m.MeQrPageComponent),
  },
  {
    path: 'payments',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MePaymentsRead },
    loadComponent: () =>
      import('./pages/payments/me-payments.page').then((m) => m.MePaymentsPageComponent),
  },
  {
    path: 'schedule',
    canMatch: [roleGuard, permissionGuard],
    data: { roles: [UserRole.Student], permissions: Permission.MeRead },
    loadComponent: () =>
      import('./pages/schedule/me-schedule.page').then((m) => m.MeSchedulePageComponent),
  },
];
