import { environment } from '@env/environment';

const BASE = `${environment.apiUrl}/${environment.apiVersion}`;
export const API_BASE_URL = environment.apiUrl;

export const API = {
  BASE,
  PUBLIC_CONTACT: `${BASE}/public/contact`,
  /** FileObjectService — uploads + downloads (BE-7a.0). */
  FILES: {
    DOWNLOAD: (publicUuid: string) =>
      `${BASE}/files/${encodeURIComponent(publicUuid)}/download`,
  },
  AUTH: {
    ROOT: `${BASE}/auth`,
    LOGIN: `${BASE}/auth/login`,
    /**
     * `POST /v1/auth/google` — verify a Google `id_token` returned by the FE
     * popup, resolve / auto-provision the matching user inside the tenant
     * identified by `X-Tenant-Slug`, and return the same bearer pair as
     * `/login`. Public endpoint (no `Authorization` header required).
     */
    GOOGLE: `${BASE}/auth/google`,
    LOGOUT: `${BASE}/auth/logout`,
    REFRESH: `${BASE}/auth/refresh`,
    ME: `${BASE}/auth/me`,
    /** CRED-7 — change password (clears mustChangePassword). */
    ME_PASSWORD: `${BASE}/auth/me/password`,
    /** CRED-7 — first-login onboarding status + complete. */
    ME_ONBOARDING: `${BASE}/auth/me/onboarding`,
    FORGOT_PASSWORD: `${BASE}/auth/forgot-password`,
    RESET_PASSWORD: `${BASE}/auth/reset-password`,
    /** `GET /v1/auth/reset-password/validate?token=...` (Sprint 17 / BE-17.1). */
    RESET_PASSWORD_VALIDATE: `${BASE}/auth/reset-password/validate`,
    // Sprint 17 / BE-17.2 + FE-17.3 — MFA (TOTP) flow.
    MFA_ENROLL_START: `${BASE}/auth/mfa/enroll/start`,
    MFA_ENROLL_VERIFY: `${BASE}/auth/mfa/enroll/verify`,
    MFA_CHALLENGE: `${BASE}/auth/mfa/challenge`,
    MFA_DISABLE: `${BASE}/auth/mfa/disable`,
    MFA_REGENERATE_RECOVERY: `${BASE}/auth/mfa/recovery-codes/regenerate`,
  },
  TENANTS: {
    ROOT: `${BASE}/tenants`,
    /** Authenticated `GET` returns the caller's tenant; `PATCH` updates it (TENANT_ADMIN). */
    ME: `${BASE}/tenants/me`,
    /** D1 / F0.5 — TENANT_ADMIN customises LMS_* authorities per role for the tenant. */
    PERMISSION_OVERRIDES: `${BASE}/tenants/me/permission-overrides`,
    /** Public lookup used by the login screen to fetch branding before authentication. */
    BY_SLUG: (slug: string) => `${BASE}/tenants/by-slug/${encodeURIComponent(slug)}`,
    /** Invite-gated signup: creates a tenant + admin and returns an auth session. */
    REGISTER: `${BASE}/tenants/register`,
    /** Public preflight for a Super-Admin school invitation token. */
    INVITATION_BY_TOKEN: (token: string) =>
      `${BASE}/tenants/invitations/by-token/${encodeURIComponent(token)}`,
    /** Onboarding lifecycle hop PENDING → ACTIVE. Idempotent on already-ACTIVE tenants. */
    ACTIVATE: `${BASE}/tenants/me/activate`,
  },
  DASHBOARD: {
    SCHOOL_OPERATIONS_SUMMARY: `${BASE}/school-dashboard/summary`,
    ROOT: `${BASE}/dashboard`,
    METRICS: `${BASE}/dashboard/metrics`,
    WIDGETS: `${BASE}/dashboard/widgets`,
    /** Sprint 9B / BE-9B.1 — teacher-scoped attendance snapshot. */
    TEACHER: `${BASE}/dashboard/teacher`,
  },
  /**
   * Sprint cierre-A / B1 + F10 — tenant KPI dashboard.
   * Endpoints live under {@code /v1/analytics/*} on the BE side.
   * Roles: TENANT_ADMIN + TEACHER + STUDENT.
   */
  ANALYTICS: {
    /** `GET /v1/analytics/kpis` — current-period KPI summary. */
    KPIS: `${BASE}/analytics/kpis`,
    /** `GET /v1/analytics/charts/attendance?from=&to=`. */
    CHARTS_ATTENDANCE: `${BASE}/analytics/charts/attendance`,
    /** `GET /v1/analytics/charts/performance?from=&to=`. */
    CHARTS_PERFORMANCE: `${BASE}/analytics/charts/performance`,
    /** `GET /v1/analytics/charts/morosidad?from=&to=`. */
    CHARTS_MOROSIDAD: `${BASE}/analytics/charts/morosidad`,
  },
  USERS: {
    ROOT: `${BASE}/users`,
    /** Detail / patch endpoint for a specific user. */
    BY_ID: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}`,
    /** Wholesale-replace the user's role set (TENANT_ADMIN). */
    ROLES: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}/roles`,
    /** Read or replace the profiles and permission exceptions for one STAFF user. */
    STAFF_ACCESS: (publicUuid: string) =>
      `${BASE}/users/${encodeURIComponent(publicUuid)}/staff-access`,
    /** Lifecycle: SUSPENDED → ACTIVE. */
    DISABLE: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}/disable`,
    /** Lifecycle: ACTIVE → SUSPENDED (with last-admin + self-lockout guards). */
    ENABLE: (publicUuid: string) => `${BASE}/users/${encodeURIComponent(publicUuid)}/enable`,
    /** Trigger an admin-driven password reset (202 Accepted, async delivery). */
    RESET_PASSWORD: (publicUuid: string) =>
      `${BASE}/users/${encodeURIComponent(publicUuid)}/reset-password`,
    /** Self-service endpoints (any authenticated user, not admin-only). */
    AVATAR: `${BASE}/users/me/avatar`,
  },
  INVITATIONS: {
    /** Admin: create + list under {@code /v1/users/invitations}. */
    ROOT: `${BASE}/users/invitations`,
    /** Admin: cancel a pending invitation by publicUuid. */
    BY_ID: (publicUuid: string) => `${BASE}/users/invitations/${encodeURIComponent(publicUuid)}`,
    /** Public: preflight an invitation token (renders the accept page header). */
    BY_TOKEN: (token: string) => `${BASE}/users/invitations/by-token/${encodeURIComponent(token)}`,
    /** Public: accept an invitation token (returns an auth session). */
    ACCEPT: `${BASE}/users/invitations/accept`,
    /** Admin: resend a pending invitation (rotates token). */
    RESEND: (publicUuid: string) =>
      `${BASE}/users/invitations/${encodeURIComponent(publicUuid)}/resend`,
  },
  TEACHERS: {
    /** {@code GET|POST /v1/teachers}. {@code GET} acepta {@code ?search&employmentStatus&hasUserAccount} + paginación Spring. */
    ROOT: `${BASE}/teachers`,
    /** {@code GET /v1/teachers/me} — perfil docente del caller (TEACHER, self-only). */
    ME: `${BASE}/teachers/me`,
    /** {@code GET|PUT|DELETE /v1/teachers/{publicUuid}}. */
    BY_ID: (publicUuid: string) => `${BASE}/teachers/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/teachers/{publicUuid}/link-user} — vincula a un User existente con rol TEACHER. */
    LINK_USER: (publicUuid: string) =>
      `${BASE}/teachers/${encodeURIComponent(publicUuid)}/link-user`,
    /** {@code POST /v1/teachers/{publicUuid}/invite} — crea invitación con metadata.teacherId. */
    INVITE: (publicUuid: string) => `${BASE}/teachers/${encodeURIComponent(publicUuid)}/invite`,
    /**
     * Sprint cierre-B / F7 — teacher bulk import.
     *  - {@code GET  /v1/teachers/bulk-import/template} — plantilla .xlsx.
     *  - {@code POST /v1/teachers/bulk-import} (multipart, TENANT_ADMIN).
     *  - {@code GET  /v1/teachers/bulk-import/{publicUuid}} — poll status.
     */
    BULK_IMPORT: {
      ROOT: `${BASE}/teachers/bulk-import`,
      TEMPLATE: `${BASE}/teachers/bulk-import/template`,
      PREVIEW: `${BASE}/teachers/bulk-import/preview`,
      BY_ID: (publicUuid: string) =>
        `${BASE}/teachers/bulk-import/${encodeURIComponent(publicUuid)}`,
    },
    /**
     * {@code GET|POST /v1/teachers/{publicUuid}/assignments} (BE-4.7).
     * {@code GET} acepta {@code ?periodId&active=true|false}.
     */
    ASSIGNMENTS: (publicUuid: string) =>
      `${BASE}/teachers/${encodeURIComponent(publicUuid)}/assignments`,
  },
  TEACHER_ASSIGNMENTS: {
    /**
     * {@code GET /v1/teacher-assignments?teacherId&sectionId&courseId&periodId&active}
     * — listado tenant-wide (admin Registros picker).
     */
    ROOT: `${BASE}/teacher-assignments`,
    /** Nested resources use this root + {@code /{publicUuid}/…} (sessions, time-slots). */
    BY_ID: (publicUuid: string) => `${BASE}/teacher-assignments/${encodeURIComponent(publicUuid)}`,
  },
  ASSIGNMENTS: {
    /** {@code DELETE /v1/assignments/{publicUuid}} — soft-end de assignment (BE-4.7). */
    BY_ID: (publicUuid: string) => `${BASE}/assignments/${encodeURIComponent(publicUuid)}`,
  },
  ENROLLMENTS: {
    /** {@code PATCH /v1/enrollments/{publicUuid}} — update enrolledAt (ACTIVE). */
    BY_ID: (publicUuid: string) =>
      `${BASE}/enrollments/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/enrollments/{publicUuid}/withdraw} — soft-end de enrollment (BE-4.8). */
    WITHDRAW: (publicUuid: string) =>
      `${BASE}/enrollments/${encodeURIComponent(publicUuid)}/withdraw`,
  },
  GUARDIANS: {
    /** {@code GET /v1/guardians/by-document?documentType=&documentNumber=} */
    BY_DOCUMENT: `${BASE}/guardians/by-document`,
  },
  STUDENTS: {
    ROOT: `${BASE}/students`,
    /** {@code GET /v1/students/payment-recipients} — minimal invoice recipient search. */
    PAYMENT_RECIPIENTS: `${BASE}/students/payment-recipients`,
    /** {@code GET|PUT|DELETE /v1/students/{publicUuid}}. */
    BY_ID: (publicUuid: string) => `${BASE}/students/${encodeURIComponent(publicUuid)}`,
    BULK_IMPORT: {
      /** {@code POST /v1/students/bulk-import} (multipart). */
      ROOT: `${BASE}/students/bulk-import`,
      /** {@code POST /v1/students/bulk-import/preview} (multipart). */
      PREVIEW: `${BASE}/students/bulk-import/preview`,
      /** {@code GET /v1/students/bulk-import/template} (binary .xlsx). */
      TEMPLATE: `${BASE}/students/bulk-import/template`,
      /** {@code GET /v1/students/bulk-import/{publicUuid}}. */
      BY_ID: (publicUuid: string) =>
        `${BASE}/students/bulk-import/${encodeURIComponent(publicUuid)}`,
    },
    /** {@code GET|POST /v1/students/{publicUuid}/guardians}. */
    GUARDIANS: (studentPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians`,
    /** {@code PUT|DELETE /v1/students/{studentUuid}/guardians/{guardianUuid}}. */
    GUARDIAN_BY_ID: (studentPublicUuid: string, guardianPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians/${encodeURIComponent(guardianPublicUuid)}`,
    /** {@code POST /v1/students/{uuid}/invite} — STUDENT + metadata.studentId. */
    INVITE: (publicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(publicUuid)}/invite`,
    /** {@code POST /v1/students/{uuid}/link-user} — rescue existing STUDENT user. */
    LINK_USER: (publicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(publicUuid)}/link-user`,
    /** {@code POST /v1/students/{s}/guardians/{g}/invite}. */
    GUARDIAN_INVITE: (studentPublicUuid: string, guardianPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians/${encodeURIComponent(guardianPublicUuid)}/invite`,
    /** {@code POST /v1/students/{s}/guardians/{g}/link-user}. */
    GUARDIAN_LINK_USER: (studentPublicUuid: string, guardianPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians/${encodeURIComponent(guardianPublicUuid)}/link-user`,
    /** {@code GET|POST /v1/students/{publicUuid}/enrollments} (BE-4.8). */
    ENROLLMENTS: (studentPublicUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/enrollments`,
  },
  ADMISSIONS: {
    PUBLIC_CATALOG: (tenantSlug: string) =>
      `${BASE}/public/admissions/${encodeURIComponent(tenantSlug)}/catalog`,
    PUBLIC_INQUIRY: (tenantSlug: string) =>
      `${BASE}/public/admissions/${encodeURIComponent(tenantSlug)}/inquiries`,
    PUBLIC_OFFER: (tenantSlug: string, token: string) =>
      `${BASE}/public/admissions/${encodeURIComponent(tenantSlug)}/offers/${encodeURIComponent(token)}`,
    PUBLIC_OFFER_RESPONSE: (tenantSlug: string, token: string) =>
      `${BASE}/public/admissions/${encodeURIComponent(tenantSlug)}/offers/${encodeURIComponent(token)}/response`,
    APPLICATION: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}`,
    APPLICATIONS: (yearPublicUuid: string) =>
      `${BASE}/admissions/years/${encodeURIComponent(yearPublicUuid)}/applications`,
    INQUIRIES: (yearPublicUuid: string) =>
      `${BASE}/admissions/years/${encodeURIComponent(yearPublicUuid)}/inquiries`,
    INQUIRY: (inquiryPublicUuid: string) =>
      `${BASE}/admissions/inquiries/${encodeURIComponent(inquiryPublicUuid)}`,
    INQUIRY_HISTORY: (inquiryPublicUuid: string) =>
      `${BASE}/admissions/inquiries/${encodeURIComponent(inquiryPublicUuid)}/history`,
    CONVERT_INQUIRY: (inquiryPublicUuid: string) =>
      `${BASE}/admissions/inquiries/${encodeURIComponent(inquiryPublicUuid)}/application`,
    OFFER_LINK: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/offer-link`,
    COMPLETE_ENROLLMENT: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/complete-enrollment`,
    RETRY_ENROLLMENT_SETUP: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/retry-enrollment-setup`,
    VACANCIES: (yearPublicUuid: string) =>
      `${BASE}/admissions/years/${encodeURIComponent(yearPublicUuid)}/vacancies`,
    RESERVATIONS: (yearPublicUuid: string) =>
      `${BASE}/admissions/years/${encodeURIComponent(yearPublicUuid)}/reservations`,
    APPLICATION_RESERVATION: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/reservations`,
    RESERVATION: (reservationPublicUuid: string) =>
      `${BASE}/admissions/reservations/${encodeURIComponent(reservationPublicUuid)}`,
    RESERVATION_HISTORY: (reservationPublicUuid: string) =>
      `${BASE}/admissions/reservations/${encodeURIComponent(reservationPublicUuid)}/history`,
    RESERVATION_ADVANCES: (reservationPublicUuid: string) =>
      `${BASE}/admissions/reservations/${encodeURIComponent(reservationPublicUuid)}/advances`,
    RESERVATION_ADVANCE_EVENTS: (reservationPublicUuid: string) =>
      `${BASE}/admissions/reservations/${encodeURIComponent(reservationPublicUuid)}/advances/events`,
    RESERVATION_ADVANCE_REFUND: (reservationPublicUuid: string, advancePublicUuid: string) =>
      `${BASE}/admissions/reservations/${encodeURIComponent(reservationPublicUuid)}/advances/${encodeURIComponent(advancePublicUuid)}/refund`,
    STATUS: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/status`,
    ENROLLMENT: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/enrollment`,
    HISTORY: (applicationPublicUuid: string) =>
      `${BASE}/admissions/applications/${encodeURIComponent(applicationPublicUuid)}/history`,
  },
  ACADEMIC: {
    ROOT: `${BASE}/academic`,
    YEARS: {
      /** {@code GET|POST /v1/academic/years}. */
      ROOT: `${BASE}/academic/years`,
      /** {@code GET|PUT|DELETE /v1/academic/years/{publicUuid}}. */
      BY_ID: (publicUuid: string) => `${BASE}/academic/years/${encodeURIComponent(publicUuid)}`,
      /** {@code POST /v1/academic/years/{publicUuid}/activate}. Cierra el ACTIVE previo en la misma tx. */
      ACTIVATE: (publicUuid: string) =>
        `${BASE}/academic/years/${encodeURIComponent(publicUuid)}/activate`,
    },
    LEVELS: {
      /** {@code GET|POST /v1/academic/levels}. {@code GET} retorna lista plana (no envelope). */
      ROOT: `${BASE}/academic/levels`,
      /** {@code GET|PUT|DELETE /v1/academic/levels/{publicUuid}}. */
      BY_ID: (publicUuid: string) => `${BASE}/academic/levels/${encodeURIComponent(publicUuid)}`,
      /** {@code GET|POST /v1/academic/levels/{levelUuid}/grades}. */
      GRADES: (levelUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(levelUuid)}/grades`,
      /** {@code PUT|DELETE /v1/academic/levels/{levelUuid}/grades/{gradeUuid}}. */
      GRADE_BY_ID: (levelUuid: string, gradeUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(levelUuid)}/grades/${encodeURIComponent(gradeUuid)}`,
      /** {@code PATCH /v1/academic/levels/{levelUuid}/grades/reorder}. */
      GRADES_REORDER: (levelUuid: string) =>
        `${BASE}/academic/levels/${encodeURIComponent(levelUuid)}/grades/reorder`,
    },
    SECTIONS: {
      /** {@code GET|POST /v1/academic/sections}. {@code GET} acepta filtros {@code ?academicYearId&gradeId&levelId}. */
      ROOT: `${BASE}/academic/sections`,
      /** {@code GET|PUT|DELETE /v1/academic/sections/{publicUuid}}. */
      BY_ID: (publicUuid: string) => `${BASE}/academic/sections/${encodeURIComponent(publicUuid)}`,
      /** {@code GET /v1/academic/sections/{publicUuid}/teachers} (BE-4.7). Acepta {@code ?periodId}. */
      TEACHERS: (sectionPublicUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionPublicUuid)}/teachers`,
      /** {@code GET /v1/academic/sections/{publicUuid}/students} (BE-4.8) — roster activo. */
      STUDENTS: (sectionPublicUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionPublicUuid)}/students`,
      /** CRED-7 — {@code POST /v1/academic/sections/{uuid}/provision-accounts}. */
      PROVISION_ACCOUNTS: (sectionPublicUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionPublicUuid)}/provision-accounts`,
      /** CRED-7 — {@code GET .../provision-accounts/{jobUuid}/sheet.xlsx}. */
      PROVISION_SHEET: (jobPublicUuid: string) =>
        `${BASE}/academic/sections/provision-accounts/${encodeURIComponent(jobPublicUuid)}/sheet.xlsx`,
      /** CRED-7 — {@code GET .../provision-accounts/{jobUuid}/handout.zip}. */
      PROVISION_HANDOUT_ZIP: (jobPublicUuid: string) =>
        `${BASE}/academic/sections/provision-accounts/${encodeURIComponent(jobPublicUuid)}/handout.zip`,
    },
    COURSES: {
      /** {@code GET|POST /v1/academic/courses}. {@code GET} acepta filtros {@code ?levelId&isActive}. */
      ROOT: `${BASE}/academic/courses`,
      /** {@code GET|PUT|DELETE /v1/academic/courses/{publicUuid}}. */
      BY_ID: (publicUuid: string) => `${BASE}/academic/courses/${encodeURIComponent(publicUuid)}`,
      /** {@code POST /v1/academic/courses/{publicUuid}/levels} — replace semantics. */
      LEVELS: (publicUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(publicUuid)}/levels`,
      /** {@code GET|POST /v1/academic/courses/{courseUuid}/units} (BE-5A.1). */
      UNITS: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/units`,
      /** {@code PATCH /v1/academic/courses/{courseUuid}/units/reorder} (BE-5A.1). */
      UNITS_REORDER: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/units/reorder`,
      /** {@code POST /v1/academic/courses/{courseUuid}/units/seed-defaults}. */
      UNITS_SEED: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/units/seed-defaults`,
      /** {@code GET|POST /v1/academic/courses/{courseUuid}/competencies} (BE-5A.2). */
      COMPETENCIES: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/competencies`,
      /** {@code PATCH /v1/academic/courses/{courseUuid}/competencies/reorder} (BE-5A.2). */
      COMPETENCIES_REORDER: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/competencies/reorder`,
      /** {@code POST /v1/academic/courses/{courseUuid}/competencies/seed-defaults} (BE-5A.2). */
      COMPETENCIES_SEED: (courseUuid: string) =>
        `${BASE}/academic/courses/${encodeURIComponent(courseUuid)}/competencies/seed-defaults`,
    },
    UNITS: {
      /** {@code GET|PUT|DELETE /v1/academic/units/{publicUuid}} (BE-5A.1). */
      BY_ID: (publicUuid: string) => `${BASE}/academic/units/${encodeURIComponent(publicUuid)}`,
    },
    COMPETENCIES: {
      /** {@code POST /v1/academic/competencies/{publicUuid}/deactivate}. */
      DEACTIVATE: (publicUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(publicUuid)}/deactivate`,
      /** {@code POST /v1/academic/competencies/{publicUuid}/promote}. */
      PROMOTE: (publicUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(publicUuid)}/promote`,
      /** {@code GET|PUT|DELETE /v1/academic/competencies/{publicUuid}} (BE-5A.2). */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(publicUuid)}`,
      /** {@code GET|POST /v1/academic/competencies/{competencyUuid}/capacities} (BE-5A.2). */
      CAPACITIES: (competencyUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(competencyUuid)}/capacities`,
      /** {@code PATCH /v1/academic/competencies/{competencyUuid}/capacities/reorder} (BE-5A.2). */
      CAPACITIES_REORDER: (competencyUuid: string) =>
        `${BASE}/academic/competencies/${encodeURIComponent(competencyUuid)}/capacities/reorder`,
    },
    CAPACITIES: {
      /** {@code GET|PUT|DELETE /v1/academic/capacities/{publicUuid}} (BE-5A.2). */
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/capacities/${encodeURIComponent(publicUuid)}`,
    },
    SCHEDULE: {
      /** {@code GET /v1/teachers/{teacherUuid}/schedule?periodId=<uuid>} (BE-5A.3). */
      TEACHER_SCHEDULE: (teacherUuid: string) =>
        `${BASE}/teachers/${encodeURIComponent(teacherUuid)}/schedule`,
      /** {@code GET /v1/teachers/{teacherUuid}/schedule/week?periodId=<uuid>}. */
      TEACHER_SCHEDULE_WEEK: (teacherUuid: string) =>
        `${BASE}/teachers/${encodeURIComponent(teacherUuid)}/schedule/week`,
      /** {@code GET /v1/academic/sections/{sectionUuid}/schedule?periodId=<uuid>} (BE-5A.3). */
      SECTION_SCHEDULE: (sectionUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionUuid)}/schedule`,
      /** {@code GET /v1/academic/sections/{sectionUuid}/schedule/week?periodId=<uuid>}. */
      SECTION_SCHEDULE_WEEK: (sectionUuid: string) =>
        `${BASE}/academic/sections/${encodeURIComponent(sectionUuid)}/schedule/week`,
    },
    TIME_SLOTS: {
      /** {@code GET|POST /v1/teacher-assignments/{assignmentUuid}/time-slots} (BE-5A.3). */
      BY_ASSIGNMENT: (assignmentUuid: string) =>
        `${BASE}/teacher-assignments/${encodeURIComponent(assignmentUuid)}/time-slots`,
      /** {@code GET|PUT|DELETE /v1/time-slots/{publicUuid}} (BE-5A.3). */
      BY_ID: (publicUuid: string) => `${BASE}/time-slots/${encodeURIComponent(publicUuid)}`,
    },
    /**
     * Day templates / jornada / recess / bootstrap / workload.
     * Controllers under {@code com.edushift.modules.schedule.daytemplate}.
     */
    DAY_SCHEDULE: {
      SETTINGS: `${BASE}/schedule/settings`,
      DAY_TEMPLATES: `${BASE}/schedule/day-templates`,
      DAY_TEMPLATE: (uuid: string) =>
        `${BASE}/schedule/day-templates/${encodeURIComponent(uuid)}`,
      DAY_TEMPLATE_BLOCKS: (uuid: string) =>
        `${BASE}/schedule/day-templates/${encodeURIComponent(uuid)}/blocks`,
      BLOCK: (uuid: string) => `${BASE}/schedule/blocks/${encodeURIComponent(uuid)}`,
      SEED_DEFAULTS: `${BASE}/schedule/day-templates/seed-defaults`,
      APPLY_DAY_PLAN: (uuid: string) =>
        `${BASE}/schedule/day-templates/${encodeURIComponent(uuid)}/apply-day-plan`,
      REVIEW_DAY_TEMPLATE: (uuid: string) =>
        `${BASE}/schedule/day-templates/${encodeURIComponent(uuid)}/review`,
      VALIDATION_WARNINGS: `${BASE}/schedule/validation-warnings`,
      BOOTSTRAP: (yearUuid: string) =>
        `${BASE}/schedule/bootstrap/${encodeURIComponent(yearUuid)}`,
      BOOTSTRAP_UPLOAD: (yearUuid: string) =>
        `${BASE}/schedule/bootstrap/${encodeURIComponent(yearUuid)}/upload`,
      CLONE_SCHEDULE: (yearUuid: string) =>
        `${BASE}/academic/years/${encodeURIComponent(yearUuid)}/clone-schedule`,
      TEACHERS_WORKLOAD: `${BASE}/teachers/workload`,
      TEACHER_WORKLOAD: (uuid: string) =>
        `${BASE}/teachers/${encodeURIComponent(uuid)}/workload`,
    },
    /**
     * Sprint cierre-C / B4 -- classrooms catalog (per-tenant).
     *  - `GET    /v1/academic/classrooms`           (paginated)
     *  - `GET    /v1/academic/classrooms/{uuid}`    (one)
     *  - `POST   /v1/academic/classrooms`           (create, TENANT_ADMIN)
     *  - `PUT    /v1/academic/classrooms/{uuid}`    (update, TENANT_ADMIN)
     *  - `DELETE /v1/academic/classrooms/{uuid}`    (soft-delete, TENANT_ADMIN)
     */
    CLASSROOMS: {
      ROOT: `${BASE}/academic/classrooms`,
      BY_ID: (publicUuid: string) =>
        `${BASE}/academic/classrooms/${encodeURIComponent(publicUuid)}`,
    },
    PERIODS: {
      /** {@code GET|POST /v1/academic/periods}. {@code GET} acepta {@code ?academicYearId&periodType}. */
      ROOT: `${BASE}/academic/periods`,
      /** {@code GET|PUT|DELETE /v1/academic/periods/{publicUuid}}. */
      BY_ID: (publicUuid: string) => `${BASE}/academic/periods/${encodeURIComponent(publicUuid)}`,
    },
    /**
     * Formal grade-register templates (F1).
     * Controllers under {@code com.edushift.modules.evaluations.graderegister}.
     */
    GRADE_REGISTER_TEMPLATES: {
      /** {@code GET /v1/academic/grade-register-templates/catalog} */
      CATALOG: `${BASE}/academic/grade-register-templates/catalog`,
      /** {@code GET /v1/academic/grade-register-templates?yearUuid=} */
      ROOT: `${BASE}/academic/grade-register-templates`,
      /** {@code GET|PUT|DELETE /v1/academic/grade-register-templates/{uuid}} */
      BY_ID: (uuid: string) =>
        `${BASE}/academic/grade-register-templates/${encodeURIComponent(uuid)}`,
      /** {@code POST /v1/academic/grade-register-templates/{uuid}/adopt} */
      ADOPT: (uuid: string) =>
        `${BASE}/academic/grade-register-templates/${encodeURIComponent(uuid)}/adopt`,
      /** {@code POST /v1/academic/grade-register-templates/{uuid}/categories} */
      CATEGORIES: (uuid: string) =>
        `${BASE}/academic/grade-register-templates/${encodeURIComponent(uuid)}/categories`,
    },
    /** {@code GET|PUT|DELETE /v1/academic/grade-categories/{uuid}} */
    GRADE_CATEGORIES: {
      BY_ID: (uuid: string) =>
        `${BASE}/academic/grade-categories/${encodeURIComponent(uuid)}`,
    },
  },
  PAYMENTS: {
    ROOT: `${BASE}/payments`,
    INVOICES: `${BASE}/payments/invoices`,
    TRANSACTIONS: `${BASE}/payments/transactions`,
    /** Soft LMS gate status for PARENT/STUDENT (`{ lmsRestricted }`). */
    ACCESS_STATUS: `${BASE}/payments/access-status`,
    // Sprint 10 / FE-10.1.
    INVOICE_BY_ID: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}`,
    INVOICE_PAYMENTS: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}/payments`,
    INVOICE_CHECKOUT: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}/checkout`,
    INVOICE_RECEIPT: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}/receipt`,
    INVOICE_EVIDENCE: (publicUuid: string) =>
      `${BASE}/payments/invoices/${encodeURIComponent(publicUuid)}/evidence`,
    // Sprint 11 / FE-11.1 — admin power tools (DEBT-10-PAY-1).
    ADMIN: {
      // Listing all payments in the tenant with optional filters.
      PAYMENTS: `${BASE}/admin/payments`,
      INVOICES: `${BASE}/admin/payments/invoices`,
      INVOICE_REVIEW_QUEUE: `${BASE}/admin/payments/invoices/review-queue`,
      /** POST /admin/payments/invoices — emit one invoice. */
      EMIT: `${BASE}/admin/payments/invoices`,
      /** POST /admin/payments/invoices/bulk — section or all-enrolled. */
      BULK: `${BASE}/admin/payments/invoices/bulk`,
      // POST /admin/payments/{uuid}/reconcile — force a PENDING/IN_PROCESS
      // payment into APPROVED.
      RECONCILE: (paymentPublicUuid: string) =>
        `${BASE}/admin/payments/${encodeURIComponent(paymentPublicUuid)}/reconcile`,
      // POST /admin/payments/{uuid}/refund — APPROVED → REFUNDED.
      REFUND: (paymentPublicUuid: string) =>
        `${BASE}/admin/payments/${encodeURIComponent(paymentPublicUuid)}/refund`,
      // POST /admin/payments/invoices/{uuid}/mark-paid-cash — create a
      // CASH payment for the invoice and flip it to PAID.
      MARK_PAID_CASH: (invoicePublicUuid: string) =>
        `${BASE}/admin/payments/invoices/${encodeURIComponent(invoicePublicUuid)}/mark-paid-cash`,
      APPROVE_EVIDENCE: (invoicePublicUuid: string) =>
        `${BASE}/admin/payments/invoices/${encodeURIComponent(invoicePublicUuid)}/approve-evidence`,
      SUBMIT_EVIDENCE: (invoicePublicUuid: string) =>
        `${BASE}/admin/payments/invoices/${encodeURIComponent(invoicePublicUuid)}/evidence`,
      REJECT_EVIDENCE: (invoicePublicUuid: string) =>
        `${BASE}/admin/payments/invoices/${encodeURIComponent(invoicePublicUuid)}/reject-evidence`,
      MORA_EXEMPT: (invoicePublicUuid: string) =>
        `${BASE}/admin/payments/invoices/${encodeURIComponent(invoicePublicUuid)}/mora-exempt`,
      SUBSCRIPTIONS: {
        ROOT: `${BASE}/admin/payments/subscriptions`,
        BULK: `${BASE}/admin/payments/subscriptions/bulk`,
        RULES: `${BASE}/admin/payments/subscriptions/rules`,
        RULE_PREVIEW: `${BASE}/admin/payments/subscriptions/rules/preview`,
        RULE_BY_ID: (publicUuid: string) =>
          `${BASE}/admin/payments/subscriptions/rules/${encodeURIComponent(publicUuid)}`,
        RULE_SYNC: (publicUuid: string) =>
          `${BASE}/admin/payments/subscriptions/rules/${encodeURIComponent(publicUuid)}/sync`,
        SIBLING_SUGGESTIONS: `${BASE}/admin/payments/subscriptions/sibling-suggestions`,
        SIBLING_REFRESH: `${BASE}/admin/payments/subscriptions/sibling-suggestions/refresh`,
        SIBLING_DECIDE: `${BASE}/admin/payments/subscriptions/sibling-suggestions/decide`,
        PAUSE: (publicUuid: string) =>
          `${BASE}/admin/payments/subscriptions/${encodeURIComponent(publicUuid)}/pause`,
        RESUME: (publicUuid: string) =>
          `${BASE}/admin/payments/subscriptions/${encodeURIComponent(publicUuid)}/resume`,
        CANCEL: (publicUuid: string) =>
          `${BASE}/admin/payments/subscriptions/${encodeURIComponent(publicUuid)}/cancel`,
        RUN_DUE: `${BASE}/admin/payments/subscriptions/run-due`,
      },
      /** Alias kept for callers that expect a flat RUN_DUE key. */
      RUN_DUE: `${BASE}/admin/payments/subscriptions/run-due`,
      POLICY: `${BASE}/admin/payments/policy`,
      ACCESS_OVERRIDES: `${BASE}/admin/payments/access-overrides`,
      ACCESS_OVERRIDE_CANDIDATES: `${BASE}/admin/payments/access-overrides/candidates`,
      ACCESS_OVERRIDE_BY_ID: (publicUuid: string) =>
        `${BASE}/admin/payments/access-overrides/${encodeURIComponent(publicUuid)}`,
      REPORTS: {
        EXPORT_CSV: `${BASE}/admin/payments/reports/export.csv`,
        AGING: `${BASE}/admin/payments/reports/aging`,
      },
      // -----------------------------------------------------------------
      // Sprint cierre-C / F14 — payment concepts catalog.
      //  - `GET    /admin/payments/concepts`           (list, paged)
      //  - `POST   /admin/payments/concepts`           (create)
      //  - `PATCH  /admin/payments/concepts/{uuid}`    (update)
      //  - `DELETE /admin/payments/concepts/{uuid}`    (soft-delete)
      // All gated by LMS_PAYMENT_ADMIN (TENANT_ADMIN + STAFF front-desk).
      // -----------------------------------------------------------------
      CONCEPTS: {
        ROOT: `${BASE}/admin/payments/concepts`,
        BY_ID: (publicUuid: string) =>
          `${BASE}/admin/payments/concepts/${encodeURIComponent(publicUuid)}`,
      },
      PAYMENT_METHODS: {
        ROOT: `${BASE}/tenants/:tenantSlug/payment-methods`,
        BY_ID: (tenantSlug: string, publicUuid: string) =>
          `${BASE}/tenants/${encodeURIComponent(tenantSlug)}/payment-methods/${encodeURIComponent(publicUuid)}`,
        SET_DEFAULT: (tenantSlug: string, publicUuid: string) =>
          `${BASE}/tenants/${encodeURIComponent(tenantSlug)}/payment-methods/${encodeURIComponent(publicUuid)}/set-default`,
        PUBLIC: (tenantSlug: string) =>
          `${BASE}/tenants/${encodeURIComponent(tenantSlug)}/payment-methods/public`,
      },
    },
  },
  SESSIONS: {
    ROOT: `${BASE}/learning-sessions`,
    /** {@code GET|PUT|DELETE /v1/learning-sessions/{publicUuid}} (BE-5A.4). */
    BY_ID: (publicUuid: string) => `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}`,
    SHARED: `${BASE}/learning-sessions/shared`,
    COPY: (publicUuid: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/copy`,
    /** {@code POST /v1/learning-sessions/{publicUuid}/start} (BE-5A.4). */
    START: (publicUuid: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/start`,
    /** {@code POST /v1/learning-sessions/{publicUuid}/complete} (BE-5A.4). */
    COMPLETE: (publicUuid: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/complete`,
    /** {@code POST /v1/learning-sessions/{publicUuid}/cancel} (BE-5A.4). */
    CANCEL: (publicUuid: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/cancel`,
    /** {@code GET /v1/teacher-assignments/{assignmentUuid}/sessions} (BE-5A.4). */
    BY_ASSIGNMENT: (assignmentUuid: string) =>
      `${BASE}/teacher-assignments/${encodeURIComponent(assignmentUuid)}/sessions`,
    /** {@code GET /v1/academic/units/{unitUuid}/sessions} (BE-5A.4). */
    BY_UNIT: (unitUuid: string) =>
      `${BASE}/academic/units/${encodeURIComponent(unitUuid)}/sessions`,
    APPLICATION_SHEETS: (publicUuid: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/application-sheets`,
    APPLICATION_SHEETS_GENERATE: (publicUuid: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/application-sheets/generate`,
    APPLICATION_SHEET_EXPORT: (publicUuid: string, kind: string) =>
      `${BASE}/learning-sessions/${encodeURIComponent(publicUuid)}/application-sheets/${encodeURIComponent(kind)}/export`,
    /** Session templates catalog / adopt / CRUD. */
    TEMPLATES: {
      ROOT: `${BASE}/session-templates`,
      CATALOG: `${BASE}/session-templates/catalog`,
      ORGANIZED: `${BASE}/session-templates/organized`,
      BY_ID: (publicUuid: string) =>
        `${BASE}/session-templates/${encodeURIComponent(publicUuid)}`,
      ADOPT: (publicUuid: string) =>
        `${BASE}/session-templates/${encodeURIComponent(publicUuid)}/adopt`,
      DEFAULT: (publicUuid: string) =>
        `${BASE}/session-templates/${encodeURIComponent(publicUuid)}/default`,
    },
  },
  EVALUATIONS: {
    /** {@code GET|POST /v1/academic/assignments/{assignmentUuid}/evaluations} (BE-5B.1). */
    BY_ASSIGNMENT: (assignmentUuid: string) =>
      `${BASE}/academic/assignments/${encodeURIComponent(assignmentUuid)}/evaluations`,
    /** {@code GET|PUT|DELETE /v1/academic/evaluations/{publicUuid}} (BE-5B.1). */
    BY_ID: (publicUuid: string) => `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/academic/evaluations/{publicUuid}/publish} (BE-5B.1). */
    PUBLISH: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}/publish`,
    /** {@code POST /v1/academic/evaluations/{publicUuid}/close} (BE-5B.1). */
    CLOSE: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}/close`,
    /** {@code POST|GET|DELETE /v1/academic/evaluations/{publicUuid}/rubric} (BE-5B.4). */
    RUBRIC: (publicUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(publicUuid)}/rubric`,
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
      `${BASE}/academic/grade-records/${encodeURIComponent(publicUuid)}`,
    /** GET|PUT /academic/evaluations/{evaluation}/students/{student}/competency-results. */
    COMPETENCY_RESULTS: (evaluationUuid: string, studentUuid: string) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(evaluationUuid)}`
      + `/students/${encodeURIComponent(studentUuid)}/competency-results`,
    COMPETENCY_RESULT_REVISIONS: (
      evaluationUuid: string,
      studentUuid: string,
      competencyUuid: string,
    ) =>
      `${BASE}/academic/evaluations/${encodeURIComponent(evaluationUuid)}`
      + `/students/${encodeURIComponent(studentUuid)}/competency-results/${encodeURIComponent(competencyUuid)}/revisions`,
  },
  GRADE_BOOK: {
    /** {@code GET /v1/academic/teacher-assignments/{publicUuid}/gradebook} (BE-5B.4 / F2). */
    BY_ASSIGNMENT: (assignmentUuid: string) =>
      `${BASE}/academic/teacher-assignments/${encodeURIComponent(assignmentUuid)}/gradebook`,
    /** {@code GET …/gradebook/export.xlsx} (F4). */
    EXPORT_XLSX: (assignmentUuid: string) =>
      `${BASE}/academic/teacher-assignments/${encodeURIComponent(assignmentUuid)}/gradebook/export.xlsx`,
    /** {@code GET …/gradebook/export.pdf} (F4). */
    EXPORT_PDF: (assignmentUuid: string) =>
      `${BASE}/academic/teacher-assignments/${encodeURIComponent(assignmentUuid)}/gradebook/export.pdf`,
  },
  RUBRICS: {
    /** {@code GET|POST /v1/academic/rubrics} (BE-5B.2). Acepta {@code ?systemOnly&isActive&q}. */
    ROOT: `${BASE}/academic/rubrics`,
    /** {@code GET /v1/academic/rubrics/system} — seed MINEDU on-demand (BE-5B.2). */
    SYSTEM: `${BASE}/academic/rubrics/system`,
    /** {@code GET|PUT|DELETE /v1/academic/rubrics/{publicUuid}} (BE-5B.2). */
    BY_ID: (publicUuid: string) => `${BASE}/academic/rubrics/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /v1/academic/rubrics/{publicUuid}/fork} (BE-5B.2). */
    FORK: (publicUuid: string) => `${BASE}/academic/rubrics/${encodeURIComponent(publicUuid)}/fork`,
  },
  AI: {
    ROOT: `${BASE}/ai`,
    CAPABILITIES: `${BASE}/ai/capabilities`,
    AGENTS: `${BASE}/ai/agents`,
    SOURCES: `${BASE}/ai/sources`,
    CHAT: `${BASE}/ai/chat`,
    INSIGHTS: `${BASE}/ai/insights`,
    // Sprint 8 / BE-8.1 — generate session outline (MINEDU template, strict JSON)
    GENERATE_SESSION: `${BASE}/ai/generate-session`,
    // Sprint 8 / BE-8.2 — generate rubric criteria (supports seedRubricId fork, ADR-8.3)
    GENERATE_RUBRIC: `${BASE}/ai/generate-rubric`,
    // Sprint cierre-A / B11 — SSE streaming variants of the generators.
    GENERATE_SESSION_STREAM: `${BASE}/ai/generate-session/stream`,
    GENERATE_RUBRIC_STREAM: `${BASE}/ai/generate-rubric/stream`,
    GENERATE_APPLICATION_SHEET: `${BASE}/ai/application-sheets/generate`,
    // Sprint 8 / BE-8.4 — usage dashboard (TENANT_ADMIN)
    USAGE_SUMMARY: `${BASE}/ai/usage/summary`,
    USAGE_DAILY: `${BASE}/ai/usage/daily`,
    USAGE_EXPORT_CSV: `${BASE}/ai/usage/export.csv`,
  },
  REPORTS: {
    ROOT: `${BASE}/reports`,
    EXPORT: `${BASE}/reports/export`,
    /**
     * Sprint cierre-C / B12 — recurring report templates.
     *  - `GET    /v1/reports/templates`           (list, paged)
     *  - `GET    /v1/reports/templates/{uuid}`    (one)
     *  - `POST   /v1/reports/templates`           (create)
     *  - `PUT    /v1/reports/templates/{uuid}`    (update)
     *  - `DELETE /v1/reports/templates/{uuid}`    (soft-delete)
     * All gated by `hasRole('TENANT_ADMIN')`.
     */
    TEMPLATES: {
      ROOT: `${BASE}/reports/templates`,
      BY_ID: (publicUuid: string) =>
        `${BASE}/reports/templates/${encodeURIComponent(publicUuid)}`,
    },
  },
  NOTIFICATIONS: {
    ROOT: `${BASE}/notifications`,
    PREFERENCES: `${BASE}/notifications/preferences`,
    // Sprint 9 / FE-9.1 — bell + center.
    UNREAD_COUNT: `${BASE}/notifications/unread-count`,
    MARK_READ: (publicUuid: string) =>
      `${BASE}/notifications/${encodeURIComponent(publicUuid)}/read`,
    MARK_ALL_READ: `${BASE}/notifications/read-all`,
    /**
     * Sprint cierre-C / F11 — notification templates editor.
     *  - `GET   /v1/notifications/templates`            (list, LMS_NOTIFICATIONS_MANAGE)
     *  - `PATCH /v1/notifications/templates/{publicUuid}` (update subject + bodyHtml)
     * The BE sanitizes the HTML with jsoup on write and bumps `version` so
     * the engine's cache invalidates (BE-9.4).
     */
    TEMPLATES: {
      ROOT: `${BASE}/notifications/templates`,
      BY_ID: (publicUuid: string) =>
        `${BASE}/notifications/templates/${encodeURIComponent(publicUuid)}`,
    },
    /**
     * Sprint cierre-C / B8 — FCM push device registration.
     *  - `POST /v1/notifications/devices`         (register FCM token for current user)
     *  - `PUT  /v1/notifications/devices/heartbeat`  (revive + refresh last_seen_at)
     *  - `DELETE /v1/notifications/devices`       (unregister on logout)
     * Endpoints return 204; the FE just consumes the bearer token
     * for tenant-scoped upserts.
     */
    DEVICES: {
      ROOT: `${BASE}/notifications/devices`,
      HEARTBEAT: `${BASE}/notifications/devices/heartbeat`,
    },
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
    STUDENT_LOOKUP: `${BASE}/attendance/students/lookup`,
  },
  // Sprint 15 — super-admin platform console (under /v1/admin/*).
  // All endpoints are gated by `hasRole('SUPER_ADMIN')` on the BE.
  ADMIN: {
    AUTH: {
      /** `POST /v1/admin/login` — super-admin authentication (3 req/min rate-limited). */
      LOGIN: `${BASE}/admin/login`,
      INITIAL_PASSWORD: `${BASE}/admin/initial-password`,
      MFA_ENROL: `${BASE}/admin/mfa/enrol`,
      MFA_VERIFY_ENROL: `${BASE}/admin/mfa/verify-enrol`,
      MFA_CHALLENGE: `${BASE}/admin/mfa/challenge`,
      /** `POST /v1/admin/logout` — revokes the refresh cookie and clears both auth cookies. */
      LOGOUT: `${BASE}/admin/logout`,
      /**
       * `POST /v1/admin/dev/complete-mfa` — dev-only MFA enrolment bypass.
       * Bean-gated to {dev,local} profiles on the BE; in prod this URL
       * returns 404 and the FE should never call it. The admin login
       * service transparently calls this when the FE is running with a
       * non-prod environment and `devMfaBypassCode` is configured.
       */
      DEV_COMPLETE_MFA: `${BASE}/admin/dev/complete-mfa`,
    },
    /** `GET /v1/admin/dashboard/kpis` — 6 KPI cards. */
    KPIS: `${BASE}/admin/dashboard/kpis`,
    /** `GET /v1/admin/dashboard/revenue-trend?months=12` — revenue line chart. */
    REVENUE_TREND: `${BASE}/admin/dashboard/revenue-trend`,
    /** Legacy route: new institutions grouped by creation month. */
    ACTIVE_TENANTS: `${BASE}/admin/dashboard/active-tenants`,
    /** `GET /v1/admin/dashboard/plan-distribution` — pie chart. */
    PLAN_DISTRIBUTION: `${BASE}/admin/dashboard/plan-distribution`,
    /** `GET /v1/admin/dashboard/top-tenants?limit=10` — top 10 by revenue. */
    TOP_TENANTS: `${BASE}/admin/dashboard/top-tenants`,
    /** `GET /v1/admin/dashboard/collection-vs-overdue` — bar chart. */
    COLLECTION_VS_OVERDUE: `${BASE}/admin/dashboard/collection-vs-overdue`,
    /** `GET /v1/admin/dashboard/students-by-plan` — bar chart. */
    STUDENTS_BY_PLAN: `${BASE}/admin/dashboard/students-by-plan`,
    /** `GET /v1/admin/tenants` — paginated tenant listing (super-admin). */
    TENANTS_ROOT: `${BASE}/admin/tenants`,
    /** `GET|PATCH /v1/admin/tenants/{publicUuid}` — detail / suspend. */
    TENANTS_BY_ID: (publicUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(publicUuid)}`,
    TENANT_AI_SETTINGS: (publicUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(publicUuid)}/ai-settings`,
    /** `GET /v1/admin/tenants/{publicUuid}/invoices` — institution billing history. */
    TENANT_INVOICES: (publicUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(publicUuid)}/invoices`,
    /** `POST /v1/admin/tenants/{publicUuid}/suspend` — suspend tenant. */
    TENANTS_SUSPEND: (publicUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(publicUuid)}/suspend`,
    /** `POST /v1/admin/tenants/{publicUuid}/reactivate` — reactivate tenant. */
    TENANTS_REACTIVATE: (publicUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(publicUuid)}/reactivate`,
    /** Super-Admin: invite a new school by email. */
    SCHOOL_INVITATIONS: `${BASE}/admin/school-invitations`,
    SCHOOL_INVITATION_BY_ID: (publicUuid: string) =>
      `${BASE}/admin/school-invitations/${encodeURIComponent(publicUuid)}`,
    SCHOOL_INVITATION_RESEND: (publicUuid: string) =>
      `${BASE}/admin/school-invitations/${encodeURIComponent(publicUuid)}/resend`,
    /**
     * `GET /v1/admin/prep-package?schoolName=&variant=PILOT|PRODUCTION`
     * — ZIP de preparación de datos personalizado (SUPER_ADMIN).
     */
    PREP_PACKAGE: `${BASE}/admin/prep-package`,
    /** `GET|POST /v1/admin/plans` — platform plan CRUD. */
    PLANS_ROOT: `${BASE}/admin/plans`,
    PLANS_ANALYTICS: `${BASE}/admin/plans/analytics`,
    PLAN_AI_POLICIES: `${BASE}/admin/plans/ai-policies`,
    PLAN_AI_POLICY: (publicUuid: string) => `${BASE}/admin/plans/${encodeURIComponent(publicUuid)}/ai-policy`,
    AI_GLOBAL_SOURCES: `${BASE}/admin/ai/global-sources`,
    AI_GLOBAL_SOURCE_REVIEW: (uuid: string) => `${BASE}/admin/ai/global-sources/${encodeURIComponent(uuid)}/review`,
    AI_GLOBAL_SOURCE_FILE: (uuid: string) => `${BASE}/admin/ai/global-sources/${encodeURIComponent(uuid)}/file`,
    AI_GLOBAL_SOURCE_PUBLISH: (uuid: string) => `${BASE}/admin/ai/global-sources/${encodeURIComponent(uuid)}/publish`,
    AI_GLOBAL_SOURCE_RETRY: (uuid: string) => `${BASE}/admin/ai/global-sources/${encodeURIComponent(uuid)}/retry`,
    AI_GLOBAL_SOURCE_REINDEX: (uuid: string) => `${BASE}/admin/ai/global-sources/${encodeURIComponent(uuid)}/reindex`,
    AI_GLOBAL_SOURCE_RETIRE: (uuid: string) => `${BASE}/admin/ai/global-sources/${encodeURIComponent(uuid)}`,
    /** `GET|PUT|DELETE /v1/admin/plans/{publicUuid}` — single plan CRUD. */
    PLANS_BY_ID: (publicUuid: string) =>
      `${BASE}/admin/plans/${encodeURIComponent(publicUuid)}`,
    /** `POST /v1/admin/tenants/{tenantUuid}/subscription` — assign / change plan. */
    ASSIGN_SUBSCRIPTION: (tenantUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(tenantUuid)}/subscription`,
    /** `POST /v1/admin/tenants/{tenantUuid}/subscription/cancel` — cancel subscription. */
    CANCEL_SUBSCRIPTION: (tenantUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(tenantUuid)}/subscription/cancel`,
    /** `POST /v1/admin/tenants/{tenantUuid}/subscription/reactivate` — reactivate. */
    REACTIVATE_SUBSCRIPTION: (tenantUuid: string) =>
      `${BASE}/admin/tenants/${encodeURIComponent(tenantUuid)}/subscription/reactivate`,
    /** `GET /v1/admin/invoices` — paginated invoice listing. */
    INVOICES_ROOT: `${BASE}/admin/invoices`,
    INVOICE_BY_ID: (publicUuid: string) => `${BASE}/admin/invoices/${encodeURIComponent(publicUuid)}`,
    /** `GET|POST /v1/admin/b2b/invoices/{publicUuid}/payments` — B2B payments on invoice. */
    INVOICE_PAYMENTS: (publicUuid: string) =>
      `${BASE}/admin/b2b/invoices/${encodeURIComponent(publicUuid)}/payments`,
    /** `POST /v1/admin/invoices/{publicUuid}/mark-paid` — manual PAID. */
    INVOICE_MARK_PAID: (publicUuid: string) =>
      `${BASE}/admin/invoices/${encodeURIComponent(publicUuid)}/mark-paid`,
    /** `GET /v1/admin/b2b/payments` — platform B2B payment listing (SUPER_ADMIN). */
    PAYMENTS_ROOT: `${BASE}/admin/b2b/payments`,
    B2B_PAYMENTS: `${BASE}/admin/b2b/payments`,
    /** `POST /v1/admin/b2b/payments/{publicUuid}/refund` — refund a B2B payment. */
    PAYMENTS_REFUND: (publicUuid: string) =>
      `${BASE}/admin/b2b/payments/${encodeURIComponent(publicUuid)}/refund`,
    /** `GET /v1/admin/metrics/students?tenantUuid=` — student count per tenant. */
    METRICS_STUDENTS: `${BASE}/admin/metrics/students`,
    /** `GET /v1/admin/metrics/teachers?tenantUuid=` — teacher count per tenant. */
    METRICS_TEACHERS: `${BASE}/admin/metrics/teachers`,
    /** `GET /v1/admin/metrics/storage?tenantUuid=` — storage usage per tenant. */
    METRICS_STORAGE: `${BASE}/admin/metrics/storage`,
    /** `GET /v1/admin/metrics/ai?tenantUuid=` — AI usage per tenant. */
    METRICS_AI: `${BASE}/admin/metrics/ai`,
    AUDIT_ROOT: `${BASE}/admin/audit`,
    AUDIT_EXPORT: `${BASE}/admin/audit/export.csv`,
    SUPER_ADMINS: `${BASE}/admin/super-admins`,
    SUPER_ADMINS_COUNT: `${BASE}/admin/super-admins/count-active`,
    SUPER_ADMIN_DISABLE: (uuid: string) => `${BASE}/admin/super-admins/${encodeURIComponent(uuid)}/disable`,
    /** Impersonation: `POST /v1/admin/impersonate` — obtain impersonation token. */
    IMPERSONATE: `${BASE}/admin/impersonate/token`,
    IMPERSONATE_TENANT_USERS: (tenantUuid: string) =>
      `${BASE}/admin/impersonate/tenants/${encodeURIComponent(tenantUuid)}/users`,
    /** Impersonation: `POST /v1/admin/impersonate/stop` — stop impersonating. */
    IMPERSONATE_STOP: `${BASE}/admin/impersonate/stop`,
  },






















  CLAIMS: {
    /** `GET /v1/admin/claims?status=&page=&size=` — list claims (TENTANT_ADMIN+SUPER_ADMIN). */
    ROOT: `${BASE}/admin/claims`,
    /** `POST /v1/admin/claims/{uuid}/respond` — respond to a claim. */
    RESPOND: (uuid: string) => `${BASE}/admin/claims/${encodeURIComponent(uuid)}/respond`,
  },





























  LMS: {
    ROOT: `${BASE}/lms`,
    // ---------------------------------------------------------------------
    // DEBT-FE-LMS-1 (2026-07-17): the FE used to call `/v1/lms/...` paths
    // (legacy mockup prefix). The BE mounts LMS endpoints directly under
    // `/sections/{uuid}/...`, `/tasks/...`, `/quizzes/...` (no `/lms/`
    // prefix). The constants below were rewritten to match the BE so the
    // doc comments describe the actual wire path. See
    // edushift-back/.../tasks/controller/TaskController.java,
    // .../materials/controller/MaterialController.java,
    // .../quizzes/controller/QuizController.java,
    // .../quizzes/controller/QuizAttemptController.java.
    // ---------------------------------------------------------------------
    /** {@code POST /sections/{uuid}/tasks} (BE-7a.2) — crear task en sección. */
    ASSIGNMENTS_ROOT: (sectionUuid: string) =>
      `${BASE}/sections/${encodeURIComponent(sectionUuid)}/tasks`,
    /** {@code GET /tasks/{uuid}} (BE-7a.2) — detalle de task. */
    ASSIGNMENT_BY_UUID: (publicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(publicUuid)}`,
    /** {@code PATCH /tasks/{uuid}} (BE-7a.2) — editar task (DRAFT / before dueAt). */
    ASSIGNMENT_PATCH: (publicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(publicUuid)}`,
    // DEBT-FE-LMS-1 (FIX BUG-2026-07-31-04): publish/archive endpoints DO
    // exist on the BE (added by V95 + TaskController). `ASSIGNMENT_PUBLISH`
    // hits `POST /tasks/{uuid}/publish` (DRAFT → PUBLISHED). The
    // `ASSIGNMENT_CLOSE` alias maps to the BE's `/archive` endpoint
    // (PUBLISHED → ARCHIVED) — kept named "close" on the FE for UX
    // continuity (admin UI shows "Cerrar tarea").
    /** {@code POST /tasks/{uuid}/publish} (BE-7a.2 / BUG-04) — DRAFT → PUBLISHED. */
    ASSIGNMENT_PUBLISH: (publicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(publicUuid)}/publish`,
    /** {@code POST /tasks/{uuid}/archive} (BE-7a.2 / BUG-04) — PUBLISHED → ARCHIVED. */
    ASSIGNMENT_CLOSE: (publicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(publicUuid)}/archive`,
    /** {@code GET /sections/{uuid}/tasks} (BE-7a.2) — paginated listing (TEACHER/TA). */
    ASSIGNMENTS_BY_SECTION: (sectionUuid: string) =>
      `${BASE}/sections/${encodeURIComponent(sectionUuid)}/tasks`,
    // DEBT-FE-LMS-1: no `/students/{uuid}/assignments` on BE. STUDENT-side
    // tasks come from `/sections/{uuid}/tasks?student=me` (TODO) or via the
    // own course detail. Keeping the constant as a no-op for now.
    /** @deprecated No BE endpoint — see BE-7a.2 followup. */
    ASSIGNMENTS_BY_STUDENT: (studentUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentUuid)}/tasks`,
    /** {@code POST /tasks/{uuid}/submissions} (BE-7a.2) — entregar. */
    ASSIGNMENT_SUBMISSIONS: (taskPublicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(taskPublicUuid)}/submissions`,
    /** {@code GET /tasks/{uuid}/submissions} (BE-7a.2) — listing (TEACHER). */
    ASSIGNMENT_SUBMISSIONS_LIST: (taskPublicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(taskPublicUuid)}/submissions`,
    // DEBT-FE-LMS-1: no `/students/{uuid}/submissions` on BE. Students
    // call `GET /tasks/{uuid}/submissions/me` for their own submission.
    /** @deprecated Use `TASK_SUBMISSION_MINE(taskUuid)` instead. */
    SUBMISSIONS_BY_STUDENT: (studentUuid: string) =>
      `${BASE}/students/${encodeURIComponent(studentUuid)}/submissions`,
    /** {@code GET /tasks/{uuid}/submissions/me} (BE-7a.2) — submission propia del STUDENT. */
    TASK_SUBMISSION_MINE: (taskPublicUuid: string) =>
      `${BASE}/tasks/${encodeURIComponent(taskPublicUuid)}/submissions/me`,
    /** {@code PATCH /submissions/{uuid}} (BE-7a.2) — editar entrega. */
    SUBMISSION_PATCH: (submissionUuid: string) =>
      `${BASE}/submissions/${encodeURIComponent(submissionUuid)}`,
    /** {@code PATCH /submissions/{uuid}/grade} (BE-7a.2) — calificar. */
    SUBMISSION_GRADE: (submissionUuid: string) =>
      `${BASE}/submissions/${encodeURIComponent(submissionUuid)}/grade`,
    // DEBT-FE-LMS-1: no `/submissions/{uuid}/return` on BE (return is a
    // subset of patch with status=RETURNED).
    /** @deprecated Use PATCH on the submission with `status=RETURNED`. */
    SUBMISSION_RETURN: (submissionUuid: string) =>
      `${BASE}/submissions/${encodeURIComponent(submissionUuid)}/return`,
    /** {@code POST /sections/{uuid}/materials} (BE-7a.1) — upload multipart. */
    SECTION_MATERIALS: (sectionUuid: string) =>
      `${BASE}/sections/${encodeURIComponent(sectionUuid)}/materials`,
    /** {@code GET /sections/{uuid}/materials} (BE-7a.1) — listing. */
    SECTION_MATERIALS_LIST: (sectionUuid: string) =>
      `${BASE}/sections/${encodeURIComponent(sectionUuid)}/materials`,
    /** {@code GET|PATCH|DELETE /materials/{uuid}} (BE-7a.1) — detalle / patch / soft-delete. */
    MATERIAL_BY_UUID: (publicUuid: string) =>
      `${BASE}/materials/${encodeURIComponent(publicUuid)}`,
    // DEBT-FE-LMS-1: no `/materials/{uuid}/download` on BE — downloads
    // go through the FileObjectService (`/files/{uuid}/download`).
    /** @deprecated Use `/files/{uuid}/download` instead. */
    MATERIAL_DOWNLOAD: (publicUuid: string) =>
      `${BASE}/materials/${encodeURIComponent(publicUuid)}/download`,

    // -------------------------------------------------------------------------
    // Quizzes (Sprint 7b, BE-7b.0/7b.1). BE mounts quiz endpoints under
    // `/sections/{uuid}/quizzes`, `/quizzes/{uuid}/...`, `/attempts/{uuid}`,
    // and `/questions/{uuid}/options` (no `/lms/` prefix). See
    // edushift-back/.../quizzes/controller/QuizController.java and
    // QuizAttemptController.java.
    // -------------------------------------------------------------------------
    /** {@code GET /sections/{uuid}/quizzes} (BE-7b.0) — listado de quizzes de la sección. */
    SECTION_QUIZZES: (sectionPublicUuid: string) =>
      `${BASE}/sections/${encodeURIComponent(sectionPublicUuid)}/quizzes`,
    /** {@code POST /sections/{uuid}/quizzes} (BE-7b.0) — crear quiz. */
    SECTION_QUIZZES_CREATE: (sectionPublicUuid: string) =>
      `${BASE}/sections/${encodeURIComponent(sectionPublicUuid)}/quizzes`,
    /** {@code GET /quizzes/{uuid}} (BE-7b.0) — detalle de quiz. */
    QUIZ_BY_UUID: (publicUuid: string) => `${BASE}/quizzes/${encodeURIComponent(publicUuid)}`,
    /** {@code PATCH /quizzes/{uuid}} (BE-7b.0) — editar quiz (DRAFT). */
    QUIZ_PATCH: (publicUuid: string) => `${BASE}/quizzes/${encodeURIComponent(publicUuid)}`,
    /** {@code DELETE /quizzes/{uuid}} (BE-7b.0) — eliminar quiz. */
    QUIZ_DELETE: (publicUuid: string) => `${BASE}/quizzes/${encodeURIComponent(publicUuid)}`,
    /** {@code POST /quizzes/{uuid}/publish} (BE-7b.0) — publicar quiz. */
    QUIZ_PUBLISH: (publicUuid: string) =>
      `${BASE}/quizzes/${encodeURIComponent(publicUuid)}/publish`,
    /** {@code POST /quizzes/{uuid}/close} (BE-7b.1) — cerrar quiz. */
    QUIZ_CLOSE: (publicUuid: string) =>
      `${BASE}/quizzes/${encodeURIComponent(publicUuid)}/close`,
    /** {@code POST /quizzes/{uuid}/questions} (BE-7b.1) — añadir pregunta. */
    QUIZ_ADD_QUESTION: (publicUuid: string) =>
      `${BASE}/quizzes/${encodeURIComponent(publicUuid)}/questions`,
    /** {@code POST /questions/{uuid}/options} (BE-7b.1) — añadir opción MC. */
    QUESTION_ADD_OPTION: (publicUuid: string) =>
      `${BASE}/questions/${encodeURIComponent(publicUuid)}/options`,
    /** {@code POST /quizzes/{uuid}/attempts} (BE-7b.1) — iniciar intento. */
    QUIZ_ATTEMPT_START: (publicUuid: string) =>
      `${BASE}/quizzes/${encodeURIComponent(publicUuid)}/attempts`,
    /** {@code GET /attempts/{uuid}} (BE-7b.1) — detalle del intento. */
    QUIZ_ATTEMPT_BY_UUID: (attemptPublicUuid: string) =>
      `${BASE}/attempts/${encodeURIComponent(attemptPublicUuid)}`,
    /** {@code PATCH /attempts/{uuid}} (BE-7b.1) — autosave de respuestas. */
    QUIZ_ATTEMPT_PATCH: (attemptPublicUuid: string) =>
      `${BASE}/attempts/${encodeURIComponent(attemptPublicUuid)}`,
    /** {@code POST /attempts/{uuid}/submit} (BE-7b.1) — submit final. */
    QUIZ_ATTEMPT_SUBMIT: (attemptPublicUuid: string) =>
      `${BASE}/attempts/${encodeURIComponent(attemptPublicUuid)}/submit`,
    /** {@code GET /quizzes/{uuid}/attempts} (BE-7b.1) — listado de intentos (TEACHER). */
    QUIZ_ATTEMPTS_LIST: (publicUuid: string) =>
      `${BASE}/quizzes/${encodeURIComponent(publicUuid)}/attempts`,
    /** {@code POST /attempts/{uuid}/grade} (BE-7b.1) — calificar short-answers (TEACHER). */
    QUIZ_ATTEMPT_GRADE: (attemptPublicUuid: string) =>
      `${BASE}/attempts/${encodeURIComponent(attemptPublicUuid)}/grade`,
    /** {@code GET /quizzes/{uuid}/grading-queue} (BE-7b.2) — cola de SHORT_ANSWER pendientes. */
    QUIZ_GRADING_QUEUE: (publicUuid: string) =>
      `${BASE}/quizzes/${encodeURIComponent(publicUuid)}/grading-queue`,
    /** {@code PATCH /quizzes/{quizUuid}/attempts/{attemptUuid}/answers/{answerUuid}} (BE-7b.2) — override single-answer. */
    QUIZ_ANSWER_GRADE: (
      quizPublicUuid: string,
      attemptPublicUuid: string,
      answerPublicUuid: string,
    ) =>
      `${BASE}/quizzes/${encodeURIComponent(quizPublicUuid)}/attempts/${encodeURIComponent(attemptPublicUuid)}/answers/${encodeURIComponent(answerPublicUuid)}`,

    // -------------------------------------------------------------------------
    // AI assistant (Sprint 7c, BE-7c.1). Gated by `LMS_AI_GENERATE`
    // (TENANT_ADMIN + TEACHER). See `docs/modules/ai.md` §3. The BE mounts
    // AI quiz-suggest under `/lms/ai/...` (literal `/lms/` prefix, not the
    // legacy FE convention — see AiController.java).
    // -------------------------------------------------------------------------
    /** {@code POST /lms/ai/quiz-questions} (BE-7c.1) — ask the LLM to suggest
     * N questions (MC/TF/SHORT_ANSWER) for the given topic. Synchronous;
     * 1-3s typical latency. Subject to the tenant's daily/monthly quota. */
    AI_SUGGEST_QUESTIONS: `${BASE}/lms/ai/quiz-questions`,
  },
} as const;
