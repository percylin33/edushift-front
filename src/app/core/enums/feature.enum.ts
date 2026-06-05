/**
 * Stable string keys for every top-level feature of the SaaS.
 * Used by:
 *   - `environment.features` (global on/off per environment)
 *   - `featureFlagGuard` (route-level gate)
 *   - tenant plan / entitlements (server may return which features are enabled)
 */
export enum FeatureKey {
  Dashboard     = 'dashboard',
  Auth          = 'auth',
  Users         = 'users',
  Students      = 'students',
  Academic      = 'academic',
  Attendance    = 'attendance',
  Payments      = 'payments',
  Ai            = 'ai',
  Reports       = 'reports',
  Notifications = 'notifications',
  Settings      = 'settings'
}
