import { UserRole } from '@core/enums';
import type { RoleKey } from '../models/qa.model';

const ROLE_KEY_BY_USER_ROLE: ReadonlyMap<UserRole, RoleKey> = new Map([
  [UserRole.SuperAdmin, 'super-admin'],
  [UserRole.TenantAdmin, 'tenant-admin'],
  [UserRole.Teacher, 'teacher'],
  [UserRole.Student, 'student'],
  [UserRole.Parent, 'parent'],
  [UserRole.Staff, 'staff'],
]);

/** Nombres amigables para la familia (no códigos técnicos). */
const TITLE_BY_ROLE_KEY: Record<RoleKey, string> = {
  'super-admin': 'Administrador de la plataforma',
  'tenant-admin': 'Director / admin del colegio',
  teacher: 'Docente',
  student: 'Estudiante',
  parent: 'Padre / madre / apoderado',
  staff: 'Secretaría / caja',
};

/**
 * Maps JWT {@link UserRole} values to Family UAT {@link RoleKey}.
 * Prefer SUPER_ADMIN when present; otherwise first matching tenant role.
 */
export function userRolesToFamilyUatRoleKey(roles: readonly UserRole[]): RoleKey | null {
  if (roles.includes(UserRole.SuperAdmin)) return 'super-admin';
  for (const role of roles) {
    const key = ROLE_KEY_BY_USER_ROLE.get(role);
    if (key) return key;
  }
  return null;
}

export function familyUatRoleTitle(roleKey: RoleKey): string {
  return TITLE_BY_ROLE_KEY[roleKey];
}

export function isFamilyUatRoleKey(value: string): value is RoleKey {
  return value in TITLE_BY_ROLE_KEY;
}
