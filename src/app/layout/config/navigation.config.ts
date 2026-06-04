import { FeatureKey, Permission } from '@core/enums';
import { ROUTES } from '@core/constants';
import { NavigationGroup } from '../models';

/**
 * Source of truth for the sidebar navigation.
 *
 * Every item declares its own visibility constraints (`feature` / `roles` /
 * `permissions`). `NavigationService` filters the tree at render time and
 * prunes empty groups.
 *
 * Adding a new module is a one-liner here — no template changes required.
 *
 * Nested items (`children`) expand inline in the sidebar. Use them sparingly
 * for sub-sections of a module (Academic → Cursos, Clases, Notas…), never as
 * deep trees: two levels max for navigation hygiene.
 */
export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'home',
        route: ROUTES.DASHBOARD.ROOT,
        exactMatch: true,
        feature: FeatureKey.Dashboard
      },
      {
        id: 'students',
        label: 'Estudiantes',
        icon: 'users',
        route: ROUTES.STUDENTS.ROOT,
        feature: FeatureKey.Students,
        permissions: [Permission.StudentsRead]
      },
      {
        id: 'academic',
        label: 'Académico',
        icon: 'book-open',
        route: ROUTES.ACADEMIC.ROOT,
        feature: FeatureKey.Academic,
        permissions: [Permission.AcademicRead],
        children: [
          {
            id: 'academic-courses',
            label: 'Cursos',
            route: ROUTES.ACADEMIC.COURSES,
            permissions: [Permission.AcademicRead]
          },
          {
            id: 'academic-classes',
            label: 'Clases',
            route: ROUTES.ACADEMIC.CLASSES,
            permissions: [Permission.AcademicRead]
          },
          {
            id: 'academic-grades',
            label: 'Notas',
            route: ROUTES.ACADEMIC.GRADES,
            permissions: [Permission.AcademicRead]
          },
          {
            id: 'academic-schedule',
            label: 'Horario',
            route: ROUTES.ACADEMIC.SCHEDULE,
            permissions: [Permission.AcademicRead]
          }
        ]
      },
      {
        id: 'attendance',
        label: 'Asistencia',
        icon: 'calendar-check',
        route: ROUTES.ATTENDANCE.ROOT,
        feature: FeatureKey.Attendance,
        permissions: [Permission.AttendanceRead],
        children: [
          {
            id: 'attendance-daily',
            label: 'Hoy',
            route: ROUTES.ATTENDANCE.DAILY,
            permissions: [Permission.AttendanceRead]
          },
          {
            id: 'attendance-history',
            label: 'Historial',
            route: ROUTES.ATTENDANCE.HISTORY,
            permissions: [Permission.AttendanceRead]
          },
          {
            id: 'attendance-reports',
            label: 'Reportes',
            route: ROUTES.ATTENDANCE.REPORTS,
            permissions: [Permission.AttendanceRead]
          }
        ]
      },
      {
        id: 'payments',
        label: 'Pagos',
        icon: 'credit-card',
        route: ROUTES.PAYMENTS.ROOT,
        feature: FeatureKey.Payments,
        permissions: [Permission.PaymentsRead]
      }
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        id: 'ai',
        label: 'Asistente IA',
        icon: 'sparkles',
        route: ROUTES.AI.ROOT,
        badge: 'Beta',
        feature: FeatureKey.Ai,
        permissions: [Permission.AiUse]
      },
      {
        id: 'reports',
        label: 'Reportes',
        icon: 'bar-chart',
        route: ROUTES.REPORTS.ROOT,
        feature: FeatureKey.Reports,
        permissions: [Permission.ReportsRead]
      }
    ]
  },
  {
    id: 'system',
    label: 'Sistema',
    items: [
      {
        id: 'settings',
        label: 'Configuración',
        icon: 'settings',
        route: ROUTES.SETTINGS.ROOT,
        feature: FeatureKey.Settings,
        permissions: [Permission.SettingsRead, Permission.SettingsManage]
      }
    ]
  }
];
