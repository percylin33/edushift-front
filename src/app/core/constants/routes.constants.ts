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
  ONBOARDING: {
    ROOT: '/onboarding',
    WELCOME: '/onboarding/welcome',
    SCHOOL: '/onboarding/school',
    COMPLETE: '/onboarding/complete'
  },
  DASHBOARD: {
    ROOT: '/dashboard'
  },
  STUDENTS: {
    ROOT: '/students',
    LIST: '/students',
    NEW: '/students/new',
    detail: (id: string) => `/students/${id}`
  },
  ACADEMIC: {
    ROOT: '/academic',
    COURSES: '/academic/courses',
    CLASSES: '/academic/classes',
    GRADES: '/academic/grades',
    SCHEDULE: '/academic/schedule'
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
