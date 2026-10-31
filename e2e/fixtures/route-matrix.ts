import {
  PARENT_STORAGE_STATE,
  STAFF_STORAGE_STATE,
  STUDENT_STORAGE_STATE,
  SUPER_ADMIN_STORAGE_STATE,
  TEACHER_STORAGE_STATE,
  TENANT_ADMIN_STORAGE_STATE,
} from './storage-state-paths';

/**
 * Route × role expectation matrix for Playwright UI smoke.
 *
 * Derived from:
 * - `app.routes.ts`, `private.routes.ts`, `public.routes.ts`, `error.routes.ts`
 * - feature `*.routes.ts` + `roleGuard` / `permissionGuard` / `authChildGuard` / `guestGuard` / `tenantGuard`
 * - BE defaults in `LmsRoleAuthorityMapper` (LMS_* and ME_* authorities)
 *
 * SmokeExpectation:
 * - ok        → page stays on route (SPA 200), not bounced to login/403
 * - forbidden → lands on /403 (role/permission) OR /404 via tenantGuard (no tenant slug)
 * - login     → redirected to /auth/login
 * - redirect  → intentional client redirect to another allowed area
 */
export type SmokeExpectation = 'ok' | 'forbidden' | 'login' | 'redirect';
export type SmokeRole =
  | 'anonymous'
  | 'tenant-admin'
  | 'teacher'
  | 'staff'
  | 'student'
  | 'parent'
  | 'super-admin';

export interface RouteSmokeEntry {
  path: string;
  /** short label */
  id: string;
  expectations: Partial<Record<SmokeRole, SmokeExpectation>>;
  /** redirect target or guard caveat */
  note?: string;
}

/** Private tenant shell: anonymous→login; SUPER_ADMIN without tenantSlug→tenantGuard /404. */
const PRIV: Partial<Record<SmokeRole, SmokeExpectation>> = {
  anonymous: 'login',
  'super-admin': 'forbidden', // default; override per-route when SA can enter (JWT has edushift-system + LMS_*)
};

export const ROUTE_SMOKE_MATRIX: RouteSmokeEntry[] = [
  // ── Public / auth ──────────────────────────────────────────────────────────
  {
    path: '/auth/login',
    id: 'auth-login',
    note: 'guestGuard → /dashboard when authenticated. SUPER_ADMIN may stay if MFA setup skipped (no storage).',
    expectations: {
      anonymous: 'ok',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'redirect',
      student: 'redirect',
      parent: 'redirect',
      'super-admin': 'redirect', // often no valid SA storageState when MFA bypass unavailable
    },
  },
  {
    path: '/auth/register',
    id: 'auth-register',
    note: 'guestGuard → /dashboard when authenticated',
    expectations: {
      anonymous: 'ok',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'redirect',
      student: 'redirect',
      parent: 'redirect',
      'super-admin': 'redirect',
    },
  },
  {
    path: '/auth/forgot-password',
    id: 'auth-forgot',
    note: 'Authenticated users are bounced to /dashboard (auth shell / guest redirect)',
    expectations: {
      anonymous: 'ok',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'redirect',
      student: 'redirect',
      parent: 'redirect',
      'super-admin': 'redirect',
    },
  },
  {
    path: '/onboarding',
    id: 'onboarding',
    note: 'Redirects to /onboarding/welcome; no auth gate',
    expectations: {
      anonymous: 'redirect',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'redirect',
      student: 'redirect',
      parent: 'redirect',
      'super-admin': 'redirect',
    },
  },
  {
    path: '/admin/login',
    id: 'admin-login',
    note: 'Public; no guestGuard',
    expectations: {
      anonymous: 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
      'super-admin': 'ok',
    },
  },
  {
    path: '/403',
    id: 'error-403',
    expectations: {
      anonymous: 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
      'super-admin': 'ok',
    },
  },
  {
    path: '/404',
    id: 'error-404',
    expectations: {
      anonymous: 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
      'super-admin': 'ok',
    },
  },

  // ── Platform admin (roleGuard SUPER_ADMIN only; anonymous → /403 not login) ─
  {
    path: '/admin',
    id: 'admin-root',
    note: 'redirect → /admin/dashboard',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'redirect',
    },
  },
  {
    path: '/admin/dashboard',
    id: 'admin-dashboard',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },
  {
    path: '/admin/tenants',
    id: 'admin-tenants',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },
  {
    path: '/admin/plans',
    id: 'admin-plans',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },
  {
    path: '/admin/invoices',
    id: 'admin-invoices',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },
  {
    path: '/admin/payments',
    id: 'admin-platform-payments',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },
  {
    path: '/admin/metrics',
    id: 'admin-metrics',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },
  {
    path: '/admin/audit',
    id: 'admin-audit',
    expectations: {
      anonymous: 'forbidden',
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
      'super-admin': 'ok',
    },
  },

  // ── Help (top-level; authChildGuard only — no tenantGuard) ─────────────────
  {
    path: '/help',
    id: 'help',
    expectations: {
      anonymous: 'login',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
      'super-admin': 'ok',
    },
  },

  // ── Workspace (private + tenant) ───────────────────────────────────────────
  {
    path: '/dashboard',
    id: 'dashboard',
    note: 'No role/permission guard',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/users',
    id: 'users',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/students',
    id: 'students',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/students/new',
    id: 'students-new',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/teachers',
    id: 'teachers',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/teachers/new',
    id: 'teachers-new',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic',
    id: 'academic',
    note: 'roleGuard TENANT_ADMIN; child redirect → /academic/years',
    expectations: {
      ...PRIV,
      'tenant-admin': 'redirect',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic/years',
    id: 'academic-years',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic/levels',
    id: 'academic-levels',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic/sections',
    id: 'academic-sections',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic/courses',
    id: 'academic-courses',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic/periods',
    id: 'academic-periods',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/academic/classrooms',
    id: 'academic-classrooms',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/learning-sessions',
    id: 'learning-sessions',
    note: 'No FE roleGuard (nav hides non-admin). BE may still 403 list APIs.',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/learning-sessions/new',
    id: 'learning-sessions-new',
    note: 'No FE roleGuard — same caveat as list',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/evaluations',
    id: 'evaluations',
    note: 'roleGuard TENANT_ADMIN | TEACHER',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/rubrics',
    id: 'rubrics',
    note: 'roleGuard TENANT_ADMIN | TEACHER',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/rubrics/new',
    id: 'rubrics-new',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/attendance',
    id: 'attendance',
    note: 'redirect → /attendance/scanner; roleGuard TEACHER | TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/attendance/scanner',
    id: 'attendance-scanner',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/attendance/sessions',
    id: 'attendance-sessions',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },

  // ── Payments ───────────────────────────────────────────────────────────────
  {
    path: '/payments',
    id: 'payments',
    note:
      'PaymentsRoleRedirect: TA/STAFF→/payments/admin/payments; STUDENT/PARENT→/invoices; TEACHER→/dashboard',
    expectations: {
      ...PRIV,
      'super-admin': 'redirect',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'redirect',
      student: 'redirect',
      parent: 'redirect',
    },
  },
  {
    path: '/payments/invoices',
    id: 'payments-invoices',
    note: 'No permissionGuard — guardian screen; TA/STAFF can open but UX is wrong',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/payments/admin',
    id: 'payments-admin',
    note: 'permissionGuard LMS_PAYMENT_ADMIN (TA + STAFF defaults)',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'ok',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/payments/admin/payments',
    id: 'payments-admin-payments',
    note: 'permissionGuard LMS_PAYMENT_ADMIN',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'ok',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/payments/admin/concepts',
    id: 'payments-admin-concepts',
    note: 'permissionGuard LMS_PAYMENT_ADMIN',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'ok',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },

  // ── AI ─────────────────────────────────────────────────────────────────────
  {
    path: '/ai',
    id: 'ai',
    note: 'permissionGuard LMS_AI_GENERATE (TA + TEACHER defaults)',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/ai/chat',
    id: 'ai-chat',
    note: 'permissionGuard LMS_AI_GENERATE',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/ai/usage',
    id: 'ai-usage',
    note: 'permissionGuard LMS_AI_USAGE — TA only among tenant roles (not TEACHER)',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },

  // ── Reports / notifications / announcements / settings ─────────────────────
  {
    path: '/reports',
    id: 'reports',
    note: 'roleGuard TENANT_ADMIN | TEACHER | STAFF',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/reports/wizard',
    id: 'reports-wizard',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/reports/catalog',
    id: 'reports-catalog',
    note: 'roleGuard TENANT_ADMIN only',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/notifications',
    id: 'notifications',
    note: 'No role/permission guard on list (nav omits STAFF — FE still allows)',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/notifications/preferences',
    id: 'notifications-preferences',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/notifications/templates',
    id: 'notifications-templates',
    note:
      'permissionGuard LMS_NOTIFICATIONS_MANAGE — seed TA currently lands /403 (authority not in default mapper)',
    expectations: {
      ...PRIV,
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/announcements',
    id: 'announcements',
    note: 'No FE roleGuard — prefer ok; BE publish may still 403',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/announcements/new',
    id: 'announcements-new',
    note: 'No FE role/permission guard — composer route is open to any authenticated role',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/settings',
    id: 'settings',
    note: 'Shell + account overview — no role gate on root',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/settings/security',
    id: 'settings-security',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/settings/tenant',
    id: 'settings-tenant',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/settings/permissions',
    id: 'settings-permissions',
    note: 'roleGuard TENANT_ADMIN',
    expectations: {
      ...PRIV,
      'tenant-admin': 'ok',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },

  // ── LMS / family / me / profile / schedule ─────────────────────────────────
  {
    path: '/lms',
    id: 'lms',
    note:
      'Landing: STUDENT→/me/courses; PARENT→/family; TA/TEACHER→first section; STAFF stays on landing (no LMS_TASK_READ sections)',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'ok',
      student: 'redirect',
      parent: 'redirect',
    },
  },
  {
    path: '/lms/assignments/new',
    id: 'lms-assignment-new',
    note:
      'LMS_TASK_CREATE — without ?section= the page redirects to first section assignments list',
    expectations: {
      ...PRIV,
      'super-admin': 'redirect',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'forbidden',
    },
  },
  {
    path: '/family',
    id: 'family',
    note: 'permissionGuard LMS_FAMILY_READ (PARENT default)',
    expectations: {
      ...PRIV,
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'forbidden',
      parent: 'ok',
    },
  },
  {
    path: '/me',
    id: 'me',
    note: 'MeRoleRedirect: STUDENT→/me/profile; others→/profile',
    expectations: {
      ...PRIV,
      'super-admin': 'redirect',
      'tenant-admin': 'redirect',
      teacher: 'redirect',
      staff: 'redirect',
      student: 'redirect',
      parent: 'redirect',
    },
  },
  {
    path: '/me/profile',
    id: 'me-profile',
    note: 'roleGuard STUDENT + permission MeRead',
    expectations: {
      ...PRIV,
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'ok',
      parent: 'forbidden',
    },
  },
  {
    path: '/me/courses',
    id: 'me-courses',
    note: 'roleGuard STUDENT + MeRead',
    expectations: {
      ...PRIV,
      'tenant-admin': 'forbidden',
      teacher: 'forbidden',
      staff: 'forbidden',
      student: 'ok',
      parent: 'forbidden',
    },
  },
  {
    path: '/profile',
    id: 'profile',
    note: 'Global self-service profile — any authenticated tenant user',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/schedule',
    id: 'schedule',
    note: 'No roleGuard on schedule.routes',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
  {
    path: '/schedule/me',
    id: 'schedule-me',
    expectations: {
      ...PRIV,
      'super-admin': 'ok',
      'tenant-admin': 'ok',
      teacher: 'ok',
      staff: 'ok',
      student: 'ok',
      parent: 'ok',
    },
  },
];

export const STORAGE_BY_ROLE: Record<Exclude<SmokeRole, 'anonymous'>, string> = {
  'tenant-admin': TENANT_ADMIN_STORAGE_STATE,
  teacher: TEACHER_STORAGE_STATE,
  staff: STAFF_STORAGE_STATE,
  student: STUDENT_STORAGE_STATE,
  parent: PARENT_STORAGE_STATE,
  'super-admin': SUPER_ADMIN_STORAGE_STATE,
};

/** Sprint A roles — expand to ALL_SMOKE_ROLES in Sprint B */
export const SPRINT_A_ROLES: SmokeRole[] = ['anonymous', 'tenant-admin', 'teacher'];

export const ALL_SMOKE_ROLES: SmokeRole[] = [
  'anonymous',
  'tenant-admin',
  'teacher',
  'staff',
  'student',
  'parent',
  'super-admin',
];

export function expectationsFor(
  entry: RouteSmokeEntry,
  role: SmokeRole,
): SmokeExpectation | undefined {
  return entry.expectations[role];
}

