/**
 * Domain × action permission map.
 *
 * Convention: `<domain>:<action>` where action is one of
 *   - `read`    → list/detail views
 *   - `write`   → create + update
 *   - `delete`  → destructive operations
 *   - `manage`  → grants all the above (effective admin for the domain)
 *
 * Keep these in sync with backend ACL strings.
 */
export enum Permission {
  StudentsRead   = 'students:read',
  StudentsWrite  = 'students:write',
  StudentsDelete = 'students:delete',
  StudentsManage = 'students:manage',

  AcademicRead   = 'academic:read',
  AcademicWrite  = 'academic:write',
  AcademicManage = 'academic:manage',

  AttendanceRead   = 'attendance:read',
  AttendanceWrite  = 'attendance:write',
  AttendanceManage = 'attendance:manage',

  PaymentsRead   = 'payments:read',
  PaymentsWrite  = 'payments:write',
  PaymentsManage = 'payments:manage',

  ReportsRead    = 'reports:read',
  ReportsExport  = 'reports:export',

  AiUse          = 'ai:use',
  AiConfigure    = 'ai:configure',

  NotificationsRead   = 'notifications:read',
  NotificationsManage = 'notifications:manage',

  TenantManage   = 'tenant:manage',
  UsersManage    = 'users:manage',
  SettingsRead   = 'settings:read',
  SettingsManage = 'settings:manage'
}
