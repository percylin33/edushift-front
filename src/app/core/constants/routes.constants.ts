/**
 * Centralized route paths used across the app.
 * Keep these in sync with the feature route trees under `features/<name>/<name>.routes.ts`.
 */
export const ROUTES = {
  ROOT: '/',
  AUTH: {
    ROOT: '/auth',
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    /** Sprint 17 / FE-17.3 — second-factor challenge page. */
    MFA_CHALLENGE: '/auth/mfa-challenge',
  },
  INVITATION: {
    /**
     * Public landing page for redeeming an invitation token. Hit by the
     * recipient via the link the admin shares; renders the preflight
     * (welcome + email) and the password form.
     */
    ACCEPT: (token: string) => `/invitation/${token}`,
    ROOT: '/invitation',
  },
  ONBOARDING: {
    ROOT: '/onboarding',
    WELCOME: '/onboarding/welcome',
    SCHOOL: '/onboarding/school',
    COMPLETE: '/onboarding/complete',
  },
  DASHBOARD: {
    ROOT: '/dashboard',
  },
  USERS: {
    ROOT: '/users',
    LIST: '/users',
    detail: (id: string) => `/users/${id}`,
  },
  PROFILE: {
    /**
     * Sprint 17 / FE-17.2 — self-service profile page. Reached from the
     * user-menu dropdown in the navbar.
     */
    ROOT: '/profile',
  },
  STUDENTS: {
    ROOT: '/students',
    LIST: '/students',
    NEW: '/students/new',
    detail: (id: string) => `/students/${id}`,
    edit: (id: string) => `/students/${id}/edit`,
    /** {@code /students/:id/qr} — printable attendance credential page (FE-6.3). */
    qr: (id: string) => `/students/${id}/qr`,
  },
  TEACHERS: {
    ROOT: '/teachers',
    LIST: '/teachers',
    NEW: '/teachers/new',
    detail: (id: string) => `/teachers/${id}`,
    edit: (id: string) => `/teachers/${id}/edit`,
  },
  ACADEMIC: {
    ROOT: '/academic',
    YEARS: {
      LIST: '/academic/years',
      NEW: '/academic/years/new',
      edit: (id: string) => `/academic/years/${id}/edit`,
    },
    LEVELS: {
      LIST: '/academic/levels',
      detail: (id: string) => `/academic/levels/${id}`,
    },
    SECTIONS: {
      LIST: '/academic/sections',
      detail: (id: string) => `/academic/sections/${id}`,
    },
    COURSES: {
      LIST: '/academic/courses',
      detail: (id: string) => `/academic/courses/${id}`,
    },
    PERIODS: {
      LIST: '/academic/periods',
    },
  },
  SESSIONS: {
    ROOT: '/learning-sessions',
    LIST: '/learning-sessions',
    NEW: '/learning-sessions/new',
    detail: (id: string) => `/learning-sessions/${id}`,
  },
  EVALUATIONS: {
    ROOT: '/evaluations',
    /** {@code /evaluations/by-assignment/{assignmentUuid}} — listing por assignment. */
    byAssignment: (assignmentUuid: string) => `/evaluations/by-assignment/${assignmentUuid}`,
    /** {@code /evaluations/{publicUuid}} — detail con tabs Overview / Rúbrica / Notas. */
    detail: (publicUuid: string) => `/evaluations/${publicUuid}`,
    /** {@code /evaluations/{publicUuid}/grades} — tabla de grade records (FE-5B.3). */
    grades: (publicUuid: string) => `/evaluations/${publicUuid}/grades`,
    /** {@code /evaluations/by-assignment/{assignmentUuid}/gradebook} — matrix (FE-5B.4). */
    gradeBook: (assignmentUuid: string) => `/evaluations/by-assignment/${assignmentUuid}/gradebook`,
  },
  RUBRICS: {
    ROOT: '/rubrics',
    LIST: '/rubrics',
    NEW: '/rubrics/new',
    detail: (id: string) => `/rubrics/${id}`,
    edit: (id: string) => `/rubrics/${id}/edit`,
  },
  ATTENDANCE: {
    ROOT: '/attendance',
    SCANNER: '/attendance/scanner',
    SESSIONS: '/attendance/sessions',
    session: (id: string) => `/attendance/sessions/${id}`,
    DAILY: '/attendance/daily',
    HISTORY: '/attendance/history',
    REPORTS: '/attendance/reports',
  },
  PAYMENTS: {
    ROOT: '/payments',
    INVOICES: '/payments/invoices',
    TRANSACTIONS: '/payments/transactions',
    // Sprint 11 / FE-11.1 — admin surface (LMS_PAYMENT_ADMIN).
    ADMIN: {
      ROOT: '/payments/admin',
      PAYMENTS: '/payments/admin/payments',
    },
  },
  AI: {
    ROOT: '/ai',
    CHAT: '/ai/chat',
    INSIGHTS: '/ai/insights',
  },
  REPORTS: {
    ROOT: '/reports',
  },
  NOTIFICATIONS: {
    ROOT: '/notifications',
    PREFERENCES: '/notifications/preferences',
  },
  SETTINGS: {
    ROOT: '/settings',
    GENERAL: '/settings/general',
    BRANDING: '/settings/branding',
    USERS: '/settings/users',
    BILLING: '/settings/billing',
  },
  LMS: {
    ROOT: '/lms',
    /** {@code /lms/sections/{sectionUuid}/assignments} — list del docente. */
    sectionAssignments: (sectionUuid: string) => `/lms/sections/${sectionUuid}/assignments`,
    /** {@code /lms/students/{studentUuid}/assignments} — "Mis tareas" del alumno. */
    studentAssignments: (studentUuid: string) => `/lms/students/${studentUuid}/assignments`,
    /** {@code /lms/assignments/new?section={sectionUuid}} — crear. */
    assignmentNew: (sectionUuid: string) => `/lms/assignments/new?section=${sectionUuid}`,
    /** {@code /lms/assignments/{uuid}} — detail. */
    assignmentDetail: (uuid: string) => `/lms/assignments/${uuid}`,
    /** {@code /lms/assignments/{uuid}/edit} — editar (DRAFT). */
    assignmentEdit: (uuid: string) => `/lms/assignments/${uuid}/edit`,
    /** {@code /lms/assignments/{uuid}/grade} — listing de entregas (TEACHER). */
    assignmentGrade: (uuid: string) => `/lms/assignments/${uuid}/grade`,
    /** {@code /lms/assignments/{uuid}/submit} — entregar (STUDENT/PARENT). */
    assignmentSubmit: (uuid: string) => `/lms/assignments/${uuid}/submit`,
    /** {@code /lms/sections/{sectionUuid}/materials} — materiales de la sección. */
    sectionMaterials: (sectionUuid: string) => `/lms/sections/${sectionUuid}/materials`,
    /** {@code /lms/sections/{sectionUuid}/quizzes} — quizzes de la sección. (FE-7b.0) */
    sectionQuizzes: (sectionUuid: string) => `/lms/sections/${sectionUuid}/quizzes`,
    /** {@code /lms/quizzes/new?section={sectionUuid}} — crear quiz. (FE-7b.0) */
    quizNew: (sectionUuid: string) => `/lms/quizzes/new?section=${sectionUuid}`,
    /** {@code /lms/quizzes/{uuid}} — detalle del quiz. (FE-7b.0) */
    quizDetail: (uuid: string) => `/lms/quizzes/${uuid}`,
    /** {@code /lms/quizzes/{uuid}/edit} — editar quiz en DRAFT. (FE-7b.1) */
    quizEdit: (uuid: string) => `/lms/quizzes/${uuid}/edit`,
    /** {@code /lms/quizzes/{uuid}/take} — tomar quiz (STUDENT/PARENT). (FE-7b.0) */
    quizTake: (uuid: string) => `/lms/quizzes/${uuid}/take`,
    /** {@code /lms/quizzes/{uuid}/results} — resultados del quiz. (FE-7b.0) */
    quizResults: (uuid: string) => `/lms/quizzes/${uuid}/results`,
    /** {@code /lms/quizzes/{uuid}/grade} — cola de grading (TEACHER). (FE-7b.3) */
    quizGrade: (uuid: string) => `/lms/quizzes/${uuid}/grade`,
  },
  ERRORS: {
    NOT_FOUND: '/404',
    FORBIDDEN: '/403',
  },
} as const;
