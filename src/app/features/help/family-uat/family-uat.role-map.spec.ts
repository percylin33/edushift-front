import { UserRole } from '@core/enums';
import {
  familyUatRoleTitle,
  isFamilyUatRoleKey,
  userRolesToFamilyUatRoleKey,
} from './family-uat.role-map';

describe('family-uat.role-map', () => {
  it('maps each UserRole to a RoleKey', () => {
    expect(userRolesToFamilyUatRoleKey([UserRole.Teacher])).toBe('teacher');
    expect(userRolesToFamilyUatRoleKey([UserRole.Student])).toBe('student');
    expect(userRolesToFamilyUatRoleKey([UserRole.Parent])).toBe('parent');
    expect(userRolesToFamilyUatRoleKey([UserRole.Staff])).toBe('staff');
    expect(userRolesToFamilyUatRoleKey([UserRole.TenantAdmin])).toBe('tenant-admin');
  });

  it('prefers SUPER_ADMIN when present with other roles', () => {
    expect(
      userRolesToFamilyUatRoleKey([UserRole.Teacher, UserRole.SuperAdmin]),
    ).toBe('super-admin');
  });

  it('returns null for guest / empty', () => {
    expect(userRolesToFamilyUatRoleKey([])).toBeNull();
    expect(userRolesToFamilyUatRoleKey([UserRole.Guest])).toBeNull();
  });

  it('validates role keys and titles', () => {
    expect(isFamilyUatRoleKey('teacher')).toBe(true);
    expect(isFamilyUatRoleKey('nope')).toBe(false);
    expect(familyUatRoleTitle('tenant-admin')).toBe('Director / admin del colegio');
    expect(familyUatRoleTitle('teacher')).toBe('Docente');
  });
});
