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
      `${BASE}/students/${encodeURIComponent(studentPublicUuid)}/guardians/${encodeURIComponent(guardianPublicUuid)}`
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
