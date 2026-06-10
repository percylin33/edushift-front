import { environment } from '@env/environment';

const BASE = `${environment.apiUrl}/${environment.apiVersion}`;

export const API = {
  BASE,
  AUTH: {
    ROOT: `${BASE}/auth`,
    LOGIN: `${BASE}/auth/login`,
    LOGOUT: `${BASE}/auth/logout`,
    REFRESH: `${BASE}/auth/refresh`,
    ME: `${BASE}/auth/me`,
    FORGOT_PASSWORD: `${BASE}/auth/forgot-password`,
    RESET_PASSWORD: `${BASE}/auth/reset-password`
  },
  TENANTS: {
    ROOT: `${BASE}/tenants`,
    /** Authenticated `GET` returns the caller's tenant; `PATCH` updates it (TENANT_ADMIN). */
    ME: `${BASE}/tenants/me`,
    /** Public lookup used by the login screen to fetch branding before authentication. */
    BY_SLUG: (slug: string) => `${BASE}/tenants/by-slug/${encodeURIComponent(slug)}`,
    /** Public self-signup: creates a tenant + admin and returns an auth session. */
    REGISTER: `${BASE}/tenants/register`,
    /** Onboarding lifecycle hop PENDING → ACTIVE. Idempotent on already-ACTIVE tenants. */
    ACTIVATE: `${BASE}/tenants/me/activate`
  },
  DASHBOARD: {
    ROOT: `${BASE}/dashboard`,
    METRICS: `${BASE}/dashboard/metrics`,
    WIDGETS: `${BASE}/dashboard/widgets`
  },
  USERS: {
    ROOT: `${BASE}/users`,
    /** Detail / patch endpoint for a specific user. */
    BY_ID: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}`,
    /** Wholesale-replace the user's role set (TENANT_ADMIN). */
    ROLES: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}/roles`,
    /** Lifecycle: SUSPENDED → ACTIVE. */
    DISABLE: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}/disable`,
    /** Lifecycle: ACTIVE → SUSPENDED (with last-admin + self-lockout guards). */
    ENABLE: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}/enable`,
    /** Trigger an admin-driven password reset (202 Accepted, async delivery). */
    RESET_PASSWORD: (publicUuid: string) =>
      `${BASE}/users/${encodeURIComponent(publicUuid)}/reset-password`
  },
  INVITATIONS: {
    /** Admin: create + list under {@code /v1/users/invitations}. */
    ROOT: `${BASE}/users/invitations`,
    /** Admin: cancel a pending invitation by publicUuid. */
    BY_ID: (publicUuid: string) =>
      `${BASE}/users/invitations/${encodeURIComponent(publicUuid)}`,
    /** Public: preflight an invitation token (renders the accept page header). */
    BY_TOKEN: (token: string) =>
      `${BASE}/users/invitations/by-token/${encodeURIComponent(token)}`,
    /** Public: accept an invitation token (returns an auth session). */
    ACCEPT: `${BASE}/users/invitations/accept`
  },
  TEACHERS: {
    /** {@code GET|POST /v1/teachers}. {@code GET} acepta {@code ?search&employmentStatus&hasUserAccount} + paginación Spring. */
    ROOT: `${BASE}/teachers`,
    /** {@code GET|PUT|DELETE /v1/teachers/{publicUuid}}. */
    BY_ID: (publicUuid: string) =>
      `${BASE}/teachers/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/teachers/{publicUuid}/link-user} — vincula a un User existente con rol TEACHER. */
    LINK_USER: (publicUuid: string) =>
      `${BASE}/teachers/${encodeURIComponent(publicUuid)}/link-user`,
    /** {@code POST /v1/teachers/{publicUuid}/invite} — crea invitación con metadata.teacherId. */
    INVITE: (publicUuid: string) =>
      `${BASE}/teachers/${encodeURIComponent(publicUuid)}/invite`,
    /**
     * {@code GET|POST /v1/teachers/{publicUuid}/assignments} (BE-4.7).
     * {@code GET} acepta {@code ?periodId&active=true|false}.
     */
    ASSIGNMENTS: (publicUuid: string) =>
      `${BASE}/teachers/${encodeURIComponent(publicUuid)}/assignments`
  },
  TEACHER_ASSIGNMENTS: {
    /** {@code GET /v1/teacher-assignments} — lista asignaciones con filtros. */
    ROOT: `${BASE}/teacher-assignments`,
    /** {@code GET|PUT|DELETE /v1/teacher-assignments/{publicUuid}}. */
    BY_ID: (publicUuid: string) =>
      `${BASE}/teacher-assignments/${encodeURIComponent(publicUuid)}`
  },
  ASSIGNMENTS: {
    /** {@code DELETE /v1/assignments/{publicUuid}} — soft-end de assignment (BE-4.7). */
    BY_ID: (publicUuid: string) =>
      `${BASE}/assignments/${encodeURIComponent(publicUuid)}`
  },
  ENROLLMENTS: {
    /** {@code POST /v1/enrollments/{publicUuid}/withdraw} — soft-end de enrollment (BE-4.8). */
    WITHDRAW: (publicUuid: string) =>
      `${BASE}/enrollments/${encodeURIComponent(publicUuid)}/withdraw`
  },
  STUDENTS: {
    ROOT: `${BASE}/students`,
    /** {@code GET|PUT|DELETE /v1/students/{publicUuid}}. */
    BY_ID: (publicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(publicUuid)}`,
    BULK_IMPORT: {
      /** {@code POST /v1/students/bulk-import} (multipart). */
      ROOT: `${BASE}/students/bulk-import`,
      /** {@code GET /v1/students/bulk-import/template} (binary .xlsx). */
      TEMPLATE: `${BASE}/students/bulk-import/template`,
      /** {@code GET /v1/students/bulk-import/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/students/bulk-import/${encodeURIComponent(publicUuid)}`
    },
    /** {@code GET|POST /v1/students/{publicUuid}/guardians}. */
    GUARDIANS: (studentPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians`,
    /** {@code PUT|DELETE /v1/students/{studentUuid}/guardians/{guardianUuid}}. */
    GUARDIAN_BY_ID: (studentPublicUuid: string, guardianPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians/${encodeURIComponent(guardianPublicUuid)}`,
    /** {@code GET|POST /v1/students/{publicUuid}/enrollments} (BE-4.8). */
    ENROLLMENTS: (studentPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/enrollments`
  },
  ACADEMIC: {
    ROOT: `${BASE}/academic`,
    YEARS: {
      /** {@code GET|POST /v1/academic/years}. */
      ROOT: `${BASE}/academic/years`,
      /** {@code GET|PUT|DELETE /v1/academic/years/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/years/${encodeURIComponent(publicUuid)}`,
      /** {@code POST /v1/academic/years/{publicUuid}/activate}. Cierra el ACTIVE previo en la misma tx. */
      ACTIVATE: (publicUuid: string) =>
        `${BASE}/academic/years/${encodeURIComponent(publicUuid)}/activate`
    },
    LEVELS: {
      /** {@code GET|POST /v1/academic/levels}. {@code GET} retorna lista plana (no envelope). */
      ROOT: `${BASE}/academic/levels`,
      /** {@code GET|PUT|DELETE /v1/academic/levels/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(publicUuid)}`,
      /** {@code GET|POST /v1/academic/levels/{levelUuid}/grades}. */
      GRADES: (levelUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(levelUuid)}/grades`,
      /** {@code PUT|DELETE /v1/academic/levels/{levelUuid}/grades/{gradeUuid}}. */
      GRADE_BY_ID: (levelUuid: string, gradeUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(levelUuid)}/grades/${encodeURIComponent(gradeUuid)}`,
      /** {@code PATCH /v1/academic/levels/{levelUuid}/grades/reorder}. */
      GRADES_REORDER: (levelUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(levelUuid)}/grades/reorder`
    },
    SECTIONS: {
      /** {@code GET|POST /v1/academic/sections}. {@code GET} acepta filtros {@code ?academicYearId&gradeId&levelId}. */
      ROOT: `${BASE}/academic/sections`,
      /** {@code GET|PUT|DELETE /v1/academic/sections/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(publicUuid)}`,
      /** {@code GET /v1/academic/sections/{publicUuid}/teachers} (BE-4.7). Acepta {@code ?periodId}. */
      TEACHERS: (sectionPublicUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionPublicUuid)}/teachers`,
      /** {@code GET /v1/academic/sections/{publicUuid}/students} (BE-4.8) — roster activo. */
      STUDENTS: (sectionPublicUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionPublicUuid)}/students`
    },
    COURSES: {
      /** {@code GET|POST /v1/academic/courses}. {@code GET} acepta filtros {@code ?levelId&isActive}. */
      ROOT: `${BASE}/academic/courses`,
      /** {@code GET|PUT|DELETE /v1/academic/courses/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(publicUuid)}`,
      /** {@code POST /v1/academic/courses/{publicUuid}/levels} — replace semantics. */
      LEVELS: (publicUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(publicUuid)}/levels`,
      /** {@code GET|POST /v1/academic/courses/{courseUuid}/units} (BE-5A.1). */
      UNITS: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/units`,
      /** {@code PATCH /v1/academic/courses/{courseUuid}/units/reorder} (BE-5A.1). */
      UNITS_REORDER: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/units/reorder`,
      /** {@code GET|POST /v1/academic/courses/{courseUuid}/competencies} (BE-5A.2). */
      COMPETENCIES: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/competencies`,
      /** {@code PATCH /v1/academic/courses/{courseUuid}/competencies/reorder} (BE-5A.2). */
      COMPETENCIES_REORDER: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/competencies/reorder`,
      /** {@code POST /v1/academic/courses/{courseUuid}/competencies/seed-defaults} (BE-5A.2). */
      COMPETENCIES_SEED: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/competencies/seed-defaults`
    },
    UNITS: {
      /** {@code GET|PUT|DELETE /v1/academic/units/{publicUuid}} (BE-5A.1). */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/units/${encodeURIComponent(publicUuid)}`
    },
    COMPETENCIES: {
      /** {@code GET|PUT|DELETE /v1/academic/competencies/{publicUuid}} (BE-5A.2). */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(publicUuid)}`,
      /** {@code GET|POST /v1/academic/competencies/{competencyUuid}/capacities} (BE-5A.2). */
      CAPACITIES: (competencyUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(competencyUuid)}/capacities`,
      /** {@code PATCH /v1/academic/competencies/{competencyUuid}/capacities/reorder} (BE-5A.2). */
      CAPACITIES_REORDER: (competencyUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(competencyUuid)}/capacities/reorder`
    },
    CAPACITIES: {
      /** {@code GET|PUT|DELETE /v1/academic/capacities/{publicUuid}} (BE-5A.2). */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/capacities/${encodeURIComponent(publicUuid)}`
    },
    SCHEDULE: {
      /** {@code GET /v1/teachers/{teacherUuid}/schedule?periodId=<uuid>} (BE-5A.3). */
      TEACHER_SCHEDULE: (teacherUuid: string) =>
        `${BASE}/teachers/${encodeURIComponent(teacherUuid)}/schedule`,
      /** {@code GET /v1/academic/sections/{sectionUuid}/schedule?periodId=<uuid>} (BE-5A.3). */
      SECTION_SCHEDULE: (sectionUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionUuid)}/schedule`
    },
    TIME_SLOTS: {
      /** {@code GET|POST /v1/teacher-assignments/{assignmentUuid}/time-slots} (BE-5A.3). */
      BY_ASSIGNMENT: (assignmentUuid: string) =>
        `${BASE}/teacher-assignments/${encodeURIComponent(assignmentUuid)}/time-slots`,
      /** {@code GET|PUT|DELETE /v1/time-slots/{publicUuid}} (BE-5A.3). */
      BY_ID: (publicUuid: string) =>
        `${BASE}/time-slots/${encodeURIComponent(publicUuid)}`
    },
    PERIODS: {
      /** {@code GET|POST /v1/academic/periods}. {@code GET} acepta {@code ?academicYearId&periodType}. */
      ROOT: `${BASE}/academic/periods`,
      /** {@code GET|PUT|DELETE /v1/academic/periods/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/periods/${encodeURIComponent(publicUuid)}`
    }
  },
  PAYMENTS: {
    ROOT: `${BASE}/payments`,
    INVOICES: `${BASE}/payments/invoices`,
    TRANSACTIONS: `${BASE}/payments/transactions`
  },
  SESSIONS: {
    ROOT: `${BASE}/learning-sessions`,
    /** {@code GET|PUT|DELETE /v1/learning-sessions/{publicUuid}} (BE-5A.4). */
    BY_ID: (publicUuid: string) => `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/learning-sessions/{publicUuid}/start} (BE-5A.4). */
    START: (publicUuid: string) => `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/start`,
    /** {@code POST /v1/learning-sessions/{publicUuid}/complete} (BE-5A.4). */
    COMPLETE: (publicUuid: string) => `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/complete`,
    /** {@code POST /v1/learning-sessions/{publicUuid}/cancel} (BE-5A.4). */
    CANCEL: (publicUuid: string) => `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/cancel`,
    /** {@code GET /v1/teacher-assignments/{assignmentUuid}/sessions} (BE-5A.4). */
    BY_ASSIGNMENT: (assignmentUuid: string) => `${BASE}/teacher-assignments/${encodeURIComponent(assignmentUuid)}/sessions`,
    /** {@code GET /v1/academic/units/{unitUuid}/sessions} (BE-5A.4). */
    BY_UNIT: (unitUuid: string) => `${BASE}/academic/units/${encodeURIComponent(unitUuid)}/sessions`
  },
  AI: {
    ROOT: `${BASE}/ai`,
    CHAT: `${BASE}/ai/chat`,
    INSIGHTS: `${BASE}/ai/insights`
  },
  REPORTS: {
    ROOT: `${BASE}/reports`,
    EXPORT: `${BASE}/reports/export`
  },
  NOTIFICATIONS: {
    ROOT: `${BASE}/notifications`,
    PREFERENCES: `${BASE}/notifications/preferences`
  }
} as const;
