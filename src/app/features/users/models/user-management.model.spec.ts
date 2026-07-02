import { UserRole, UserStatus } from '@core/enums';
import {
  UserRow,
  UserDetail,
  UserListFilters,
  UpdateUserRequest,
  AssignRolesRequest,
} from './user-management.model';

describe('UserManagementModel', () => {
  describe('UserRow', () => {
    it('shape mínimo', () => {
      const r: UserRow = {
        publicUuid: 'u-1',
        email: 'a@b.com',
        fullName: 'A B',
        status: UserStatus.Active,
        roles: [UserRole.Teacher],
      };
      expect(r.firstName).toBeUndefined();
    });
  });

  describe('UserDetail', () => {
    it('extiende row con phone/avatarUrl y flags de seguridad', () => {
      const d: UserDetail = {
        publicUuid: 'u-1',
        email: 'a@b.com',
        fullName: 'A B',
        status: UserStatus.Active,
        roles: [UserRole.Teacher],
        phone: '555',
        avatarUrl: 'https://x',
        emailVerified: true,
        mfaEnabled: false,
      };
      expect(d.emailVerified).toBeTrue();
    });
  });

  describe('UserListFilters', () => {
    it('todos opcionales', () => {
      const f1: UserListFilters = {};
      const f2: UserListFilters = {
        search: 'x',
        status: UserStatus.Active,
        role: UserRole.Teacher,
      };
      expect(Object.keys(f1)).toHaveSize(0);
      expect(f2.search).toBe('x');
    });
  });

  describe('UpdateUserRequest', () => {
    it('acepta patch parcial', () => {
      const u: UpdateUserRequest = { firstName: 'Nuevo' };
      expect(u.lastName).toBeUndefined();
    });
  });

  describe('AssignRolesRequest', () => {
    it('roles es un array', () => {
      const a: AssignRolesRequest = { roles: [UserRole.Teacher] };
      expect(a.roles).toHaveSize(1);
    });
  });
});
