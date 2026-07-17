/**
 * Stable string keys for every top-level feature of the SaaS.
 * Used by:
 *   - `environment.features` (global on/off per environment)
 *   - `featureFlagGuard` (route-level gate)
 *   - tenant plan / entitlements (server may return which features are enabled)
 */
export enum FeatureKey {
  Dashboard = 'dashboard',
  Auth = 'auth',
  Users = 'users',
  Students = 'students',
  Teachers = 'teachers',
  Academic = 'academic',
  Sessions = 'sessions',
  Evaluations = 'evaluations',
  Rubrics = 'rubrics',
  Attendance = 'attendance',
  Payments = 'payments',
  Ai = 'ai',
  Reports = 'reports',
  Notifications = 'notifications',
  Announcements = 'announcements',
  Settings = 'settings',
  Lms = 'lms',
  // Sprint 15 — super-admin platform console. Gated by SUPER_ADMIN role
  // (not by feature flag); the constant is declared so `featureFlagGuard`
  // can be used if ever needed for environment-level gating.
  Admin = 'admin',
}
