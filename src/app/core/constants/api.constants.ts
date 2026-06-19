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
    TRANSACTIONS: `${BASE}/payments/transactions`,
    // Sprint 10 / FE-10.1.
    INVOICE_BY_ID: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}`,
    INVOICE_PAYMENTS: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}/payments`,
    INVOICE_CHECKOUT: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}/checkout`
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
  EVALUATIONS: {
    /** {@code GET|POST /v1/academic/teacher-assignments/{assignmentUuid}/evaluations} (BE-5B.1). */
    BY_ASSIGNMENT: (assignmentUuid: string) =>
      `${BASE}/academic/teacher-assignments/${encodeURIComponent(assignmentUuid)}/evaluations`,
    /** {@code GET|PUT|DELETE /v1/academic/evaluations/{publicUuid}} (BE-5B.1). */
    BY_ID: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/academic/evaluations/{publicUuid}/publish} (BE-5B.1). */
    PUBLISH: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}/publish`,
    /** {@code POST /v1/academic/evaluations/{publicUuid}/close} (BE-5B.1). */
    CLOSE: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}/close`,
    /** {@code POST|GET|DELETE /v1/academic/evaluations/{publicUuid}/rubric} (BE-5B.4). */
    RUBRIC: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}/rubric`
  },
  GRADE_RECORDS: {
    /** {@code GET|POST /v1/academic/evaluations/{evaluationUuid}/grade-records} (BE-5B.3). */
    BY_EVALUATION: (evaluationUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(evaluationUuid)}/grade-records`,
    /** {@code POST /v1/academic/evaluations/{evaluationUuid}/grade-records/bulk} (BE-5B.3). */
    BULK: (evaluationUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(evaluationUuid)}/grade-records/bulk`,
    /** {@code GET|PUT|DELETE /v1/academic/grade-records/{publicUuid}} (BE-5B.3). */
    BY_ID: (publicUuid: string) =>
      `${BASE}/academic/grade-records/${encodeURIComponent(publicUuid)}`
  },
  GRADE_BOOK: {
    /** {@code GET /v1/academic/teacher-assignments/{publicUuid}/gradebook} (BE-5B.4). */
    BY_ASSIGNMENT: (assignmentUuid: string) =>
      `${BASE}/academic/teacher-assignments/${encodeURIComponent(assignmentUuid)}/gradebook`
  },
  RUBRICS: {
    /** {@code GET|POST /v1/academic/rubrics} (BE-5B.2). Acepta {@code ?systemOnly&isActive&q}. */
    ROOT: `${BASE}/academic/rubrics`,
    /** {@code GET /v1/academic/rubrics/system} — seed MINEDU on-demand (BE-5B.2). */
    SYSTEM: `${BASE}/academic/rubrics/system`,
    /** {@code GET|PUT|DELETE /v1/academic/rubrics/{publicUuid}} (BE-5B.2). */
    BY_ID: (publicUuid: string) =>
      `${BASE}/academic/rubrics/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/academic/rubrics/{publicUuid}/fork} (BE-5B.2). */
    FORK: (publicUuid: string) =>
      `${BASE}/academic/rubrics/${encodeURIComponent(publicUuid)}/fork`
  },
  AI: {
    ROOT: `${BASE}/ai`,
    CHAT: `${BASE}/ai/chat`,
    INSIGHTS: `${BASE}/ai/insights`,
    // Sprint 8 / BE-8.1 — generate session outline (MINEDU template, strict JSON)
    GENERATE_SESSION: `${BASE}/ai/generate-session`,
    // Sprint 8 / BE-8.2 — generate rubric criteria (supports seedRubricId fork, ADR-8.3)
    GENERATE_RUBRIC: `${BASE}/ai/generate-rubric`,
    // Sprint 8 / BE-8.4 — usage dashboard (TENANT_ADMIN)
    USAGE_SUMMARY: `${BASE}/ai/usage/summary`,
    USAGE_DAILY: `${BASE}/ai/usage/daily`,
    USAGE_EXPORT_CSV: `${BASE}/ai/usage/export.csv`
  },
  REPORTS: {
    ROOT: `${BASE}/reports`,
    EXPORT: `${BASE}/reports/export`
  },
  NOTIFICATIONS: {
    ROOT: `${BASE}/notifications`,
    PREFERENCES: `${BASE}/notifications/preferences`,
    // Sprint 9 / FE-9.1 — bell + center.
    UNREAD_COUNT: `${BASE}/notifications/unread-count`,
    MARK_READ: (publicUuid: string) =>
      `${BASE}/notifications/${encodeURIComponent(publicUuid)}/read`,
    MARK_ALL_READ: `${BASE}/notifications/read-all`
  },
  ATTENDANCE: {
    /** {@code POST /v1/attendance/sessions} (BE-6.4). 200 si ya hay ACTIVE, 201 si se acaba de crear. */
    SESSIONS_ROOT: `${BASE}/attendance/sessions`,
    /** {@code PATCH /v1/attendance/sessions/{publicUuid}/close} (BE-6.4). */
    CLOSE_SESSION: (publicUuid: string) =>
      `${BASE}/attendance/sessions/${encodeURIComponent(publicUuid)}/close`,
    /** {@code POST /v1/attendance/sessions/{publicUuid}/check-in} (BE-6.4). */
    CHECK_IN: (publicUuid: string) =>
      `${BASE}/attendance/sessions/${encodeURIComponent(publicUuid)}/check-in`,
    /** {@code GET /v1/attendance/sessions/{publicUuid}/records} (BE-6.4). */
    SESSION_RECORDS: (publicUuid: string) =>
      `${BASE}/attendance/sessions/${encodeURIComponent(publicUuid)}/records`,
    /** {@code PUT /v1/attendance/records/{publicUuid}} (BE-6.4). */
    RECORD_BY_ID: (publicUuid: string) =>
      `${BASE}/attendance/records/${encodeURIComponent(publicUuid)}`,
    /**
     * {@code GET /v1/students/{publicUuid}/attendance-qr} (BE-6.3).
     * Binario: response TypeScript = `Blob`. Acepta `Accept: image/png|image/svg+xml`.
     */
    STUDENT_QR: (publicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(publicUuid)}/attendance-qr`,
    /** {@code GET /v1/students/{publicUuid}/attendance-qr/info} (BE-6.3). */
    STUDENT_QR_INFO: (publicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(publicUuid)}/attendance-qr/info`,
    /** {@code POST /v1/students/{publicUuid}/attendance-qr/rotate} (BE-6.3). */
    STUDENT_QR_ROTATE: (publicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(publicUuid)}/attendance-qr/rotate`,
    /** {@code GET /v1/attendance/dashboard/overview} (BE-6.5). Solo TENANT_ADMIN. */
    DASHBOARD_OVERVIEW: `${BASE}/attendance/dashboard/overview`,
    /**
     * {@code POST /v1/attendance/manual-check-in} (BE-6.8 — manual fallback).
     * Roles: TENANT_ADMIN + TEACHER. 200 si ya existía un record, 201 si fue creado.
     * El backend auto-resuelve la sesión a partir del enrollment activo del alumno.
     */
    MANUAL_CHECK_IN: `${BASE}/attendance/manual-check-in`,
    /**
     * {@code POST /v1/attendance/scan-check-in} (BE-6.8.b — session-less QR scan).
     * Roles: TENANT_ADMIN + TEACHER. Mismo contrato que `CHECK_IN` pero el
     * backend auto-resuelve la sesión a partir del enrollment activo del alumno
     * (idéntico flujo al manual fallback). Pensado para auxiliar en la puerta del
     * colegio escaneando QRs sin pre-abrir una sesión por sección.
     */
    SCAN_CHECK_IN: `${BASE}/attendance/scan-check-in`,
    /**
     * {@code GET /v1/attendance/students/lookup} (BE-6.8 — manual fallback picker).
     * Roles: TENANT_ADMIN + TEACHER. Acepta `?q&levelPublicUuid&gradePublicUuid&sectionPublicUuid` + paginación Spring.
     * Retorna alumnos con enrollment ACTIVO únicamente (proyección lean, sin PII).
     */
    STUDENT_LOOKUP: `${BASE}/attendance/students/lookup`
  },
  LMS: {
    ROOT: `${BASE}/lms`,
    /** {@code POST /v1/lms/assignments} (BE-7a.2) — crear. */
    ASSIGNMENTS_ROOT: `${BASE}/lms/assignments`,
    /** {@code GET /v1/lms/assignments/{uuid}} (BE-7a.2) — detalle. */
    ASSIGNMENT_BY_UUID: (publicUuid: string) =>
      `${BASE}/lms/assignments/${encodeURIComponent(publicUuid)}`,
    /** {@code PATCH /v1/lms/assignments/{uuid}} (BE-7a.2) — editar (DRAFT). */
    ASSIGNMENT_PATCH: (publicUuid: string) =>
      `${BASE}/lms/assignments/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/lms/assignments/{uuid}/publish} (BE-7a.2) — DRAFT → PUBLISHED. */
    ASSIGNMENT_PUBLISH: (publicUuid: string) =>
      `${BASE}/lms/assignments/${encodeURIComponent(publicUuid)}/publish`,
    /** {@code POST /v1/lms/assignments/{uuid}/close} (BE-7a.2) — PUBLISHED → CLOSED. */
    ASSIGNMENT_CLOSE: (publicUuid: string) =>
      `${BASE}/lms/assignments/${encodeURIComponent(publicUuid)}/close`,
    /** {@code GET /v1/lms/sections/{uuid}/assignments} (BE-7a.2) — paginated listing (TEACHER). */
    ASSIGNMENTS_BY_SECTION: (sectionUuid: string) =>
      `${BASE}/lms/sections/${encodeURIComponent(sectionUuid)}/assignments`,
    /** {@code GET /v1/lms/students/{uuid}/assignments} (BE-7a.2) — paginated listing (STUDENT/PARENT). */
    ASSIGNMENTS_BY_STUDENT: (studentUuid: string) =>
      `${BASE}/lms/students/${encodeURIComponent(studentUuid)}/assignments`,
    /** {@code POST /v1/lms/assignments/{uuid}/submissions} (BE-7a.2) — entregar. */
    ASSIGNMENT_SUBMISSIONS: (assignmentUuid: string) =>
      `${BASE}/lms/assignments/${encodeURIComponent(assignmentUuid)}/submissions`,
    /** {@code GET /v1/lms/assignments/{uuid}/submissions} (BE-7a.2) — listing (TEACHER). */
    ASSIGNMENT_SUBMISSIONS_LIST: (assignmentUuid: string) =>
      `${BASE}/lms/assignments/${encodeURIComponent(assignmentUuid)}/submissions`,
    /** {@code GET /v1/lms/students/{uuid}/submissions} (BE-7a.2) — listing (STUDENT/PARENT). */
    SUBMISSIONS_BY_STUDENT: (studentUuid: string) =>
      `${BASE}/lms/students/${encodeURIComponent(studentUuid)}/submissions`,
    /** {@code PATCH /v1/lms/submissions/{uuid}} (BE-7a.2) — editar entrega. */
    SUBMISSION_PATCH: (submissionUuid: string) =>
      `${BASE}/lms/submissions/${encodeURIComponent(submissionUuid)}`,
    /** {@code PATCH /v1/lms/submissions/{uuid}/grade} (BE-7a.2) — calificar. */
    SUBMISSION_GRADE: (submissionUuid: string) =>
      `${BASE}/lms/submissions/${encodeURIComponent(submissionUuid)}/grade`,
    /** {@code PATCH /v1/lms/submissions/{uuid}/return} (BE-7a.2) — devolver. */
    SUBMISSION_RETURN: (submissionUuid: string) =>
      `${BASE}/lms/submissions/${encodeURIComponent(submissionUuid)}/return`,
    /** {@code POST /v1/lms/sections/{uuid}/materials} (BE-7a.1) — upload multipart. */
    SECTION_MATERIALS: (sectionUuid: string) =>
      `${BASE}/lms/sections/${encodeURIComponent(sectionUuid)}/materials`,
    /** {@code GET /v1/lms/sections/{uuid}/materials} (BE-7a.1) — listing. */
    SECTION_MATERIALS_LIST: (sectionUuid: string) =>
      `${BASE}/lms/sections/${encodeURIComponent(sectionUuid)}/materials`,
    /** {@code GET|DELETE /v1/lms/materials/{uuid}} (BE-7a.1) — detalle / soft-delete. */
    MATERIAL_BY_UUID: (publicUuid: string) =>
      `${BASE}/lms/materials/${encodeURIComponent(publicUuid)}`,
    /** {@code GET /v1/lms/materials/{uuid}/download} (BE-7a.1) — 302 al signed URL de Firebase. */
    MATERIAL_DOWNLOAD: (publicUuid: string) =>
      `${BASE}/lms/materials/${encodeURIComponent(publicUuid)}/download`,

    // -------------------------------------------------------------------------
    // Quizzes (Sprint 7b, BE-7b.0). Backend endpoints are not yet implemented;
    // these constants are placeholders so the FE can wire its API service and
    // the route guards in FE-7b.0/7b.1/7b.2/7b.3 without waiting for BE.
    // -------------------------------------------------------------------------
    /** `GET /v1/lms/sections/{uuid}/quizzes` (BE-7b.0) — listado de quizzes de la sección. */
    SECTION_QUIZZES: (sectionPublicUuid: string) =>
      `${BASE}/lms/sections/${encodeURIComponent(sectionPublicUuid)}/quizzes`,
    /** `POST /v1/lms/sections/{uuid}/quizzes` (BE-7b.0) — crear quiz. */
    SECTION_QUIZZES_CREATE: (sectionPublicUuid: string) =>
      `${BASE}/lms/sections/${encodeURIComponent(sectionPublicUuid)}/quizzes`,
    /** `GET /v1/lms/quizzes/{uuid}` (BE-7b.0) — detalle de quiz. */
    QUIZ_BY_UUID: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}`,
    /** `PATCH /v1/lms/quizzes/{uuid}` (BE-7b.0) — editar quiz (DRAFT). */
    QUIZ_PATCH: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}`,
    /** `DELETE /v1/lms/quizzes/{uuid}` (BE-7b.0) — eliminar quiz. */
    QUIZ_DELETE: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}`,
    /** `POST /v1/lms/quizzes/{uuid}/publish` (BE-7b.0) — publicar quiz. */
    QUIZ_PUBLISH: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}/publish`,
    /** `POST /v1/lms/quizzes/{uuid}/close` (BE-7b.1) — cerrar quiz. */
    QUIZ_CLOSE: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}/close`,
    /** `POST /v1/lms/quizzes/{uuid}/questions` (BE-7b.1) — añadir pregunta. */
    QUIZ_ADD_QUESTION: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}/questions`,
    /** `POST /v1/lms/questions/{uuid}/options` (BE-7b.1) — añadir opción MC. */
    QUESTION_ADD_OPTION: (publicUuid: string) =>
      `${BASE}/lms/questions/${encodeURIComponent(publicUuid)}/options`,
    /** `POST /v1/lms/quizzes/{uuid}/attempts` (BE-7b.1) — iniciar intento. */
    QUIZ_ATTEMPT_START: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}/attempts`,
    /** `GET /v1/lms/attempts/{uuid}` (BE-7b.1) — detalle del intento. */
    QUIZ_ATTEMPT_BY_UUID: (attemptPublicUuid: string) =>
      `${BASE}/lms/attempts/${encodeURIComponent(attemptPublicUuid)}`,
    /** `PATCH /v1/lms/attempts/{uuid}` (BE-7b.1) — autosave de respuestas. */
    QUIZ_ATTEMPT_PATCH: (attemptPublicUuid: string) =>
      `${BASE}/lms/attempts/${encodeURIComponent(attemptPublicUuid)}`,
    /** `POST /v1/lms/attempts/{uuid}/submit` (BE-7b.1) — submit final. */
    QUIZ_ATTEMPT_SUBMIT: (attemptPublicUuid: string) =>
      `${BASE}/lms/attempts/${encodeURIComponent(attemptPublicUuid)}/submit`,
    /** `GET /v1/lms/quizzes/{uuid}/attempts` (BE-7b.1) — listado de intentos (TEACHER). */
    QUIZ_ATTEMPTS_LIST: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}/attempts`,
    /** `POST /v1/lms/attempts/{uuid}/grade` (BE-7b.1) — calificar short-answers (TEACHER). */
    QUIZ_ATTEMPT_GRADE: (attemptPublicUuid: string) =>
      `${BASE}/lms/attempts/${encodeURIComponent(attemptPublicUuid)}/grade`,
    /** `GET /v1/lms/quizzes/{uuid}/grading-queue` (BE-7b.2) — cola de SHORT_ANSWER pendientes. */
    QUIZ_GRADING_QUEUE: (publicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(publicUuid)}/grading-queue`,
    /** `PATCH /v1/lms/quizzes/{quizUuid}/attempts/{attemptUuid}/answers/{answerUuid}` (BE-7b.2) — override single-answer. */
    QUIZ_ANSWER_GRADE: (quizPublicUuid: string, attemptPublicUuid: string, answerPublicUuid: string) =>
      `${BASE}/lms/quizzes/${encodeURIComponent(quizPublicUuid)}/attempts/${encodeURIComponent(attemptPublicUuid)}/answers/${encodeURIComponent(answerPublicUuid)}`,

    // -------------------------------------------------------------------------
    // AI assistant (Sprint 7c, BE-7c.1). Gated by `LMS_AI_GENERATE`
    // (TENANT_ADMIN + TEACHER). See `docs/modules/ai.md` §3.
    // -------------------------------------------------------------------------
    /** `POST /v1/lms/ai/quiz-questions` (BE-7c.1) — ask the LLM to suggest
     * N questions (MC/TF/SHORT_ANSWER) for the given topic. Synchronous;
     * 1-3s typical latency. Subject to the tenant's daily/monthly quota. */
    AI_SUGGEST_QUESTIONS: `${BASE}/lms/ai/quiz-questions`
  }
} as const;
