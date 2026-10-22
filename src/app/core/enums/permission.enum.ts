/**
 * Domain × action permission map.
 *
 * Convention: `<domain>:<action>` where action is one of
 *   - `read`    → list/detail views
 *   - `write`   → create + update
 *   - `delete`  → destructive operations
 *   - `manage`  → grants all the above (effective admin for the domain)
 *
 * LMS authorities (Sprint 7a, BE-7a.3) are emitted by the backend in
 * `LMS_*` form to match Spring Security's `hasAuthority('LMS_TASK_READ')`
 * guards on the LMS controllers. They cannot follow the `lms:*` colon
 * pattern because that would diverge from the `LmsRoleAuthorityMapper`
 * contract; the spec (sprint-07a-lms-foundations.md §FE-7a.4) keeps the
 * `LMS_*` strings verbatim in `data.permissions`. Keep both halves of
 * this enum in sync with `edushift-back/.../security/LmsAuthorities`.
 */
export enum Permission {
  StudentsRead = 'students:read',
  StudentsWrite = 'students:write',
  StudentsDelete = 'students:delete',
  StudentsManage = 'students:manage',

  AcademicRead = 'academic:read',
  AcademicWrite = 'academic:write',
  AcademicManage = 'academic:manage',

  AttendanceRead = 'attendance:read',
  AttendanceWrite = 'attendance:write',
  AttendanceManage = 'attendance:manage',

  PaymentsRead = 'payments:read',
  PaymentsWrite = 'payments:write',
  PaymentsManage = 'payments:manage',

  ReportsRead = 'reports:read',
  ReportsExport = 'reports:export',

  AiUse = 'ai:use',
  AiConfigure = 'ai:configure',

  NotificationsRead = 'notifications:read',
  NotificationsManage = 'notifications:manage',

  TenantManage = 'tenant:manage',
  UsersManage = 'users:manage',
  SettingsRead = 'settings:read',
  SettingsManage = 'settings:manage',

  // -------------------------------------------------------------------------
  // LMS (Sprint 7a, BE-7a.3). Authority names match `LmsAuthorities` on the
  // backend one-to-one. See sprint-07a-lms-foundations.md §BE-7a.3 for the
  // role→authority mapping matrix.
  // -------------------------------------------------------------------------
  LmsTaskRead = 'LMS_TASK_READ',
  LmsTaskCreate = 'LMS_TASK_CREATE',
  LmsTaskGrade = 'LMS_TASK_GRADE',
  LmsTaskSubmit = 'LMS_TASK_SUBMIT',
  LmsMaterialRead = 'LMS_MATERIAL_READ',
  LmsMaterialWrite = 'LMS_MATERIAL_WRITE',

  // -------------------------------------------------------------------------
  // LMS Quizzes (Sprint 7b, BE-7b.0). Sprint 7b is currently a placeholder
  // (see sprint-07b-lms-intelligence.md). Authority names follow the same
  // `LMS_QUIZ_*` convention as the 7a matrix. Reserved for the Quiz builder
  // (TEACHER), taker (STUDENT/PARENT) and grader (TEACHER) UIs.
  // -------------------------------------------------------------------------
  LmsQuizRead = 'LMS_QUIZ_READ',
  LmsQuizCreate = 'LMS_QUIZ_CREATE',
  LmsQuizGrade = 'LMS_QUIZ_GRADE',
  LmsQuizSubmit = 'LMS_QUIZ_SUBMIT',

  // -------------------------------------------------------------------------
  // AI assistant (Sprint 7c, BE-7c.1). Authority name mirrors
  // `LmsAuthorities.LMS_AI_GENERATE` on the backend one-to-one. Granted to
  // TENANT_ADMIN + TEACHER only (see `LmsRoleAuthorityMapper`).
  // -------------------------------------------------------------------------
  LmsAiGenerate = 'LMS_AI_GENERATE',
  AiTutorUse = 'AI:TUTOR_USE',
  AiTeacherUse = 'AI:TEACHER_USE',
  AiFamilyUse = 'AI:FAMILY_USE',
  AiSourceManage = 'AI:SOURCE_MANAGE',
  AiPromptManage = 'AI:PROMPT_MANAGE',

  // -------------------------------------------------------------------------
  // AI usage visibility (Sprint 7c / BE-7c.2). Mirrors
  // `LmsAuthorities.LMS_AI_USAGE` on the backend. Granted to
  // TENANT_ADMIN + SUPER_ADMIN (see `LmsRoleAuthorityMapper`). Gates the
  // `/ai/usage` surface (own-tenant token consumption breakdown, quotas).
  // DEBT-QA-2 (QA plan 2026-07-02): added to keep FE enum in sync with BE
  // so the `permissionGuard` can resolve `LMS_AI_USAGE`.
  // -------------------------------------------------------------------------
  LmsAiUsage = 'LMS_AI_USAGE',

  // -------------------------------------------------------------------------
  // Payments admin (Sprint 11 / BE-11.7). Authority name mirrors
  // `LmsAuthorities.LMS_PAYMENT_ADMIN` on the backend. Granted to
  // TENANT_ADMIN + STAFF (see `LmsRoleAuthorityMapper`). Gates the
  // `/payments/admin/*` surface (reconcile, refund, mark-paid-cash).
  // -------------------------------------------------------------------------
  LmsPaymentAdmin = 'LMS_PAYMENT_ADMIN',
  StudentsReadGranular = 'STUDENTS:READ',
  StudentsCreateGranular = 'STUDENTS:CREATE',
  StudentsUpdateGranular = 'STUDENTS:UPDATE',
  UsersProvisionStudent = 'USERS:PROVISION_STUDENT',
  GuardiansRead = 'GUARDIANS:READ',
  GuardiansManage = 'GUARDIANS:MANAGE',
  UsersProvisionGuardian = 'USERS:PROVISION_GUARDIAN',
  EnrollmentsRead = 'ENROLLMENTS:READ',
  EnrollmentsManage = 'ENROLLMENTS:MANAGE',
  AttendanceReadGranular = 'ATTENDANCE:READ',
  AttendanceRegister = 'ATTENDANCE:REGISTER',
  AttendanceCorrect = 'ATTENDANCE:CORRECT',
  PaymentsReadGranular = 'PAYMENTS:READ',
  PaymentsReceive = 'PAYMENTS:RECEIVE',
  PaymentsReconcile = 'PAYMENTS:RECONCILE',
  PaymentsIssue = 'PAYMENTS:ISSUE',
  PaymentsRefund = 'PAYMENTS:REFUND',
  PaymentsExport = 'PAYMENTS:EXPORT',
  PaymentConceptsManage = 'PAYMENT_CONCEPTS:MANAGE',
  AcademicReadGranular = 'ACADEMIC:READ',
  ReportsReadGranular = 'REPORTS:READ',
  LmsFamilyRead = 'LMS_FAMILY_READ',
  LmsAttendanceJustify = 'LMS_ATTENDANCE_JUSTIFY',
  LmsDisclosureRead = 'LMS_DISCLOSURE_READ',
  LmsDisclosureManage = 'LMS_DISCLOSURE_MANAGE',
  LmsDisclosureSubmit = 'LMS_DISCLOSURE_SUBMIT',
  LmsDisclosureReview = 'LMS_DISCLOSURE_REVIEW',
  LmsDisclosurePublish = 'LMS_DISCLOSURE_PUBLISH',
  LmsAdmissionManage = 'LMS_ADMISSION_MANAGE',
  AdmissionsInquiriesRead = 'ADMISSIONS_INQUIRIES_READ',
  AdmissionsInquiriesManage = 'ADMISSIONS_INQUIRIES_MANAGE',
  AdmissionsApplicationsRead = 'ADMISSIONS_APPLICATIONS_READ',
  AdmissionsApplicationsManage = 'ADMISSIONS_APPLICATIONS_MANAGE',
  AdmissionsDecide = 'ADMISSIONS_DECIDE',
  AdmissionsOffersManage = 'ADMISSIONS_OFFERS_MANAGE',
  AdmissionsEnroll = 'ADMISSIONS_ENROLL',

  // -------------------------------------------------------------------------
  // Student workspace (DEBT-STUDENT-PRIVACY / Fase 1-3). Authority names
  // mirror `LmsAuthorities.ME_*` on the backend one-to-one. Granted to
  // STUDENT by default; tenants can revoke any sub-section via
  // PermissionOverride (e.g. disable payments for K-6 segments).
  // -------------------------------------------------------------------------
  MeRead = 'ME_READ',
  MeAttendanceRead = 'ME_ATTENDANCE_READ',
  MeAttendanceJustify = 'ME_ATTENDANCE_JUSTIFY',
  MeQrRead = 'ME_QR_READ',
  MePaymentsRead = 'ME_PAYMENTS_READ',
  MePaymentsCheckout = 'ME_PAYMENTS_CHECKOUT',

  // -------------------------------------------------------------------------
  // CRED-7 — mass provision of student/parent accounts for a section.
  // Mirrors LmsAuthorities.USERS_PROVISION_SECTION. Granted to TENANT_ADMIN
  // + STAFF by default.
  // -------------------------------------------------------------------------
  UsersProvisionSection = 'USERS_PROVISION_SECTION',

  // Announcements. CREATE is school-wide (tenant admin). CREATE_OWN is a
  // teacher limited to assigned sections and courses. Students never get either.
  LmsAnnouncementsCreate = 'LMS_ANNOUNCEMENTS_CREATE',
  LmsAnnouncementsCreateOwn = 'LMS_ANNOUNCEMENTS_CREATE_OWN',
}
