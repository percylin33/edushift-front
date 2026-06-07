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
    RESET_PASSWORD: '/auth/reset-password'
  },
  INVITATION: {
    /**
     * Public landing page for redeeming an invitation token. Hit by the
     * recipient via the link the admin shares; renders the preflight
     * (welcome + email) and the password form.
     */
    ACCEPT: (token: string) => `/invitation/${token}`,
    ROOT: '/invitation'
  },
  ONBOARDING: {
    ROOT: '/onboarding',
    WELCOME: '/onboarding/welcome',
    SCHOOL: '/onboarding/school',
    COMPLETE: '/onboarding/complete'
  },
  DASHBOARD: {
    ROOT: '/dashboard'
  },
  USERS: {
    ROOT: '/users',
    LIST: '/users',
    detail: (id: string) => `/users/${id}`
  },
  STUDENTS: {
    ROOT: '/students',
    LIST: '/students',
    NEW: '/students/new',
    detail: (id: string) => `/students/${id}`,
    edit: (id: string) => `/students/${id}/edit`
  },
  TEACHERS: {
    ROOT: '/teachers',
    LIST: '/teachers',
    NEW: '/teachers/new',
    detail: (id: string) => `/teachers/${id}`,
    edit: (id: string) => `/teachers/${id}/edit`
  },
  ACADEMIC: {
    ROOT: '/academic',
    YEARS: {
      LIST: '/academic/years',
      NEW: '/academic/years/new',
      edit: (id: string) => `/academic/years/${id}/edit`
    },
    LEVELS: {
      LIST: '/academic/levels',
      detail: (id: string) => `/academic/levels/${id}`
    },
    SECTIONS: {
      LIST: '/academic/sections',
      detail: (id: string) => `/academic/sections/${id}`
    },
    COURSES: {
      LIST: '/academic/courses'
    },
    PERIODS: {
      LIST: '/academic/periods'
    }
  },
  ATTENDANCE: {
    ROOT: '/attendance',
    DAILY: '/attendance/daily',
    HISTORY: '/attendance/history',
    REPORTS: '/attendance/reports'
  },
  PAYMENTS: {
    ROOT: '/payments',
    INVOICES: '/payments/invoices',
    TRANSACTIONS: '/payments/transactions'
  },
  AI: {
    ROOT: '/ai',
    CHAT: '/ai/chat',
    INSIGHTS: '/ai/insights'
  },
  REPORTS: {
    ROOT: '/reports'
  },
  NOTIFICATIONS: {
    ROOT: '/notifications',
    PREFERENCES: '/notifications/preferences'
  },
  SETTINGS: {
    ROOT: '/settings',
    GENERAL: '/settings/general',
    BRANDING: '/settings/branding',
    USERS: '/settings/users',
    BILLING: '/settings/billing'
  },
  ERRORS: {
    NOT_FOUND: '/404',
    FORBIDDEN: '/403'
  }
} as const;
