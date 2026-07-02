import { FeatureKey, Permission, UserRole } from '@core/enums';
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
        feature: FeatureKey.Dashboard,
      },
      {
        /*
         * Sprint 3 keeps the students module role-gated (TENANT_ADMIN
         * only) — same trade-off as the users entry, see
         * docs/product/sprints/sprint-03-users-students.md. Fine-grained
         * `students:*` permissions land with the security sprint.
         */
        id: 'students',
        label: 'Estudiantes',
        icon: 'graduation-cap',
        route: ROUTES.STUDENTS.ROOT,
        feature: FeatureKey.Students,
        roles: [UserRole.TenantAdmin],
      },
      {
        /*
         * Sprint 4 (FE-4.6) — padrón de docentes. Mismo trade-off
         * de role-gating (TENANT_ADMIN) hasta que la security sprint
         * agregue `teachers:*` permissions.
         */
        id: 'teachers',
        label: 'Docentes',
        icon: 'users',
        route: ROUTES.TEACHERS.ROOT,
        feature: FeatureKey.Teachers,
        roles: [UserRole.TenantAdmin],
      },
      {
        /*
         * Sprint 4 reescribe la taxonomía académica: el módulo expone
         * cinco sub-módulos (años, niveles, secciones, cursos,
         * periodos). FE-4.1..4.5 los entregan navegables todos.
         *
         * Role-gating en lugar de permission-gating mientras la
         * security sprint no popule el array `User.permissions`
         * (hoy el backend solo emite roles — ver UserRole.java).
         * Mismo trade-off que students/teachers/users; el guard de
         * `academic.routes.ts` ya enforce TENANT_ADMIN, así que esto
         * es solo UX hint para que el item aparezca en el sidebar.
         */
        id: 'academic',
        label: 'Académico',
        icon: 'book-open',
        route: ROUTES.ACADEMIC.ROOT,
        feature: FeatureKey.Academic,
        roles: [UserRole.TenantAdmin],
        children: [
          {
            id: 'academic-years',
            label: 'Años académicos',
            route: ROUTES.ACADEMIC.YEARS.LIST,
            roles: [UserRole.TenantAdmin],
          },
          {
            id: 'academic-levels',
            label: 'Niveles y grados',
            route: ROUTES.ACADEMIC.LEVELS.LIST,
            roles: [UserRole.TenantAdmin],
          },
          {
            id: 'academic-sections',
            label: 'Secciones',
            route: ROUTES.ACADEMIC.SECTIONS.LIST,
            roles: [UserRole.TenantAdmin],
          },
          {
            id: 'academic-courses',
            label: 'Cursos',
            route: ROUTES.ACADEMIC.COURSES.LIST,
            roles: [UserRole.TenantAdmin],
          },
          {
            id: 'academic-periods',
            label: 'Periodos',
            route: ROUTES.ACADEMIC.PERIODS.LIST,
            roles: [UserRole.TenantAdmin],
          },
        ],
      },
      {
        /*
         * Sprint 5B (FE-5B.2) — catálogo de rúbricas. El listing global
         * lo merece (las evaluations cuelgan de assignment, pero las
         * rúbricas son tenant-wide y pre-existentes a la creación de
         * cualquier evaluation). Mismo trade-off de role-gating.
         */
        id: 'rubrics',
        label: 'Rúbricas',
        icon: 'layers',
        route: ROUTES.RUBRICS.ROOT,
        feature: FeatureKey.Rubrics,
        roles: [UserRole.TenantAdmin, UserRole.Teacher],
      },
      {
        /*
         * Sprint 6 — el sidebar usa role-gating (mismo trade-off que
         * students/teachers/academic) porque el backend aún no popula
         * `User.permissions`. Las sub-rutas reales son
         * `/attendance/sessions` y `/attendance/scanner`; los paths
         * `/attendance/daily|history|reports` declarados en
         * ROUTES.ATTENDANCE no tienen entrada en attendance.routes.ts
         * todavía, así que no se exponen como children hasta que las
         * pantallas existan (FE-6.4 dashboard / reportes).
         */
        id: 'attendance',
        label: 'Asistencia',
        icon: 'calendar-check',
        route: ROUTES.ATTENDANCE.SESSIONS,
        feature: FeatureKey.Attendance,
        roles: [UserRole.TenantAdmin, UserRole.Teacher],
        children: [
          {
            id: 'attendance-sessions',
            label: 'Sesiones',
            route: ROUTES.ATTENDANCE.SESSIONS,
            roles: [UserRole.TenantAdmin, UserRole.Teacher],
          },
          {
            id: 'attendance-scanner',
            label: 'Escáner QR',
            route: ROUTES.ATTENDANCE.SCANNER,
            roles: [UserRole.TenantAdmin, UserRole.Teacher],
          },
        ],
      },
      {
        id: 'payments',
        label: 'Pagos',
        icon: 'credit-card',
        route: ROUTES.PAYMENTS.ROOT,
        feature: FeatureKey.Payments,
        roles: [UserRole.TenantAdmin, UserRole.Staff, UserRole.Student, UserRole.Guardian],
        children: [
          {
            /*
             * Sprint 11 / FE-11.3 — admin power tools (reconcile /
             * refund / mark-paid-cash). Gated by `LMS_PAYMENT_ADMIN`
             * (TENANT_ADMIN + STAFF per `LmsRoleAuthorityMapper`).
             * The authority string is passed verbatim to match the
             * `LMS_*` convention used by every other LMS guard — the
             * `permissions` array in `permission.enum.ts` is the
             * authoritative listing.
             */
            id: 'payments-admin',
            label: 'Conciliación',
            icon: 'shield-check',
            route: ROUTES.PAYMENTS.ADMIN.ROOT,
            permissions: [Permission.LmsPaymentAdmin],
          },
        ],
      },
    ],
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
        roles: [UserRole.TenantAdmin, UserRole.Teacher],
      },
      {
        id: 'reports',
        label: 'Reportes',
        icon: 'bar-chart',
        route: ROUTES.REPORTS.ROOT,
        feature: FeatureKey.Reports,
        roles: [UserRole.TenantAdmin, UserRole.Teacher, UserRole.Staff],
      },
    ],
  },
  {
    id: 'system',
    label: 'Sistema',
    items: [
      /*
       * Sprint 3 keeps user management role-gated (TENANT_ADMIN only).
       * Fine-grained `users:*` permissions land with the security
       * sprint — see docs/product/sprints/sprint-03-users-students.md.
       */
      {
        id: 'users',
        label: 'Usuarios',
        icon: 'users',
        route: ROUTES.USERS.ROOT,
        feature: FeatureKey.Users,
        roles: [UserRole.TenantAdmin],
      },
      {
        id: 'settings',
        label: 'Configuración',
        icon: 'settings',
        route: ROUTES.SETTINGS.ROOT,
        feature: FeatureKey.Settings,
        roles: [UserRole.TenantAdmin],
      },
    ],
  },
];
