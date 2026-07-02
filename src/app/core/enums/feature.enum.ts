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
  Settings = 'settings',
  // LMS (Sprint 7a). Owns Materials, Tasks and Submissions. Granular
  // authorities are declared in `Permission.Lms*`; the `FeatureKey.Lms`
  // flag is the build-time / plan-level on/off switch that gates the
  // whole `/lms/*` route tree via `featureFlagGuard`.
  Lms = 'lms',
}
