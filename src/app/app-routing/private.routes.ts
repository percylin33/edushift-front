import { Routes } from '@angular/router';
import { MainLayoutComponent } from '@layout/index';
import { authChildGuard, featureFlagGuard, tenantGuard } from '@core/guards';
import { FeatureKey } from '@core/enums';

/**
 * Authenticated app area. Every child route:
 *   - lives under `MainLayoutComponent` (sidebar + navbar shell)
 *   - is gated by `tenantGuard` (tenant must be resolved before entering)
 *   - is gated by `authChildGuard` (session must be valid)
 *   - declares a `feature` flag so `featureFlagGuard` can block disabled modules
 *
 * Per-feature finer-grained permission checks live inside each feature's own
 * routes file (e.g. `students.routes.ts`) using `permissionGuard`.
 */
export const PRIVATE_ROUTES: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [tenantGuard],
    canActivateChild: [authChildGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Dashboard, breadcrumb: 'Dashboard', title: 'Dashboard' },
        loadChildren: () =>
          import('@features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
      },
      {
        path: 'users',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Users, breadcrumb: 'Usuarios', title: 'Usuarios' },
        loadChildren: () =>
          import('@features/users/users.routes').then((m) => m.USERS_ROUTES)
      },
      {
        path: 'students',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Students, breadcrumb: 'Estudiantes', title: 'Estudiantes' },
        loadChildren: () =>
          import('@features/students/students.routes').then((m) => m.STUDENTS_ROUTES)
      },
      {
        path: 'teachers',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Teachers, breadcrumb: 'Docentes', title: 'Docentes' },
        loadChildren: () =>
          import('@features/teachers/teachers.routes').then((m) => m.TEACHERS_ROUTES)
      },
      {
        path: 'academic',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Academic, breadcrumb: 'Académico', title: 'Académico' },
        loadChildren: () =>
          import('@features/academic/academic.routes').then((m) => m.ACADEMIC_ROUTES)
      },
      {
        path: 'learning-sessions',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Sessions, breadcrumb: 'Sesiones', title: 'Sesiones de Aprendizaje' },
        loadChildren: () =>
          import('@features/sessions/sessions.routes').then((m) => m.SESSIONS_ROUTES)
      },
      {
        path: 'attendance',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Attendance, breadcrumb: 'Asistencia', title: 'Asistencia' },
        loadChildren: () =>
          import('@features/attendance/attendance.routes').then((m) => m.ATTENDANCE_ROUTES)
      },
      {
        path: 'payments',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Payments, breadcrumb: 'Pagos', title: 'Pagos' },
        loadChildren: () =>
          import('@features/payments/payments.routes').then((m) => m.PAYMENTS_ROUTES)
      },
      {
        path: 'ai',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Ai, breadcrumb: 'Asistente IA', title: 'Asistente IA' },
        loadChildren: () => import('@features/ai/ai.routes').then((m) => m.AI_ROUTES)
      },
      {
        path: 'reports',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Reports, breadcrumb: 'Reportes', title: 'Reportes' },
        loadChildren: () =>
          import('@features/reports/reports.routes').then((m) => m.REPORTS_ROUTES)
      },
      {
        path: 'notifications',
        canActivate: [featureFlagGuard],
        data: {
          feature: FeatureKey.Notifications,
          breadcrumb: 'Notificaciones',
          title: 'Notificaciones'
        },
        loadChildren: () =>
          import('@features/notifications/notifications.routes').then(
            (m) => m.NOTIFICATIONS_ROUTES
          )
      },
      {
        path: 'settings',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Settings, breadcrumb: 'Configuración', title: 'Configuración' },
        loadChildren: () =>
          import('@features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES)
      }
    ]
  }
];
