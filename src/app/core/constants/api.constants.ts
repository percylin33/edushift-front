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
    CURRENT: `${BASE}/tenants/current`
  },
  DASHBOARD: {
    ROOT: `${BASE}/dashboard`,
    METRICS: `${BASE}/dashboard/metrics`,
    WIDGETS: `${BASE}/dashboard/widgets`
  },
  STUDENTS: {
    ROOT: `${BASE}/students`
  },
  ACADEMIC: {
    ROOT: `${BASE}/academic`,
    COURSES: `${BASE}/academic/courses`,
    CLASSES: `${BASE}/academic/classes`,
    GRADES: `${BASE}/academic/grades`,
    SCHEDULE: `${BASE}/academic/schedule`
  },
  PAYMENTS: {
    ROOT: `${BASE}/payments`,
    INVOICES: `${BASE}/payments/invoices`,
    TRANSACTIONS: `${BASE}/payments/transactions`
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
