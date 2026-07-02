import {
  toAuthSession,
  toUserSummary,
  toUser,
  toRoles,
  toPermissions,
} from './auth-session.adapter';
import { Permission, UserRole } from '@core/enums';

describe('toAuthSession', () => {
  it('construye AuthSession desde respuesta raw', () => {
    const raw = {
      user: { publicUuid: 'abc', fullName: 'Juan Pérez', email: 'juan@test.com', status: 'ACTIVE' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresInSec: 3600,
    };
    const session = toAuthSession(raw);
    expect(session.accessToken).toBe('access-token');
    expect(session.user.publicUuid).toBe('abc');
    expect(session.expiresAt).toBeInstanceOf(Date);
  });
});

describe('toUserSummary', () => {
  it('convierte UserSummaryRaw manteniendo campos', () => {
    const raw = {
      publicUuid: 'abc',
      fullName: 'Test',
      email: 'test@test.com',
      status: 'ACTIVE',
      avatarUrl: null,
    };
    const summary = toUserSummary(raw);
    expect(summary.fullName).toBe('Test');
    expect(summary.avatarUrl).toBeUndefined();
  });
});

describe('toUser', () => {
  it('convierte UserResponseRaw a User', () => {
    const raw = {
      publicUuid: 'abc',
      fullName: 'Test',
      email: 'test@test.com',
      status: 'ACTIVE',
      firstName: 'Test',
      lastName: 'User',
      phone: null,
      emailVerified: true,
      mfaEnabled: false,
      roles: ['TENANT_ADMIN'],
      permissions: ['users:read'],
      lastLoginAt: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      avatarUrl: null,
    };
    const user = toUser(raw);
    expect(user.roles).toContain(UserRole.TenantAdmin);
    expect(user.permissions).toContain('users:read' as Permission);
  });
});

describe('toRoles', () => {
  it('filtra solo roles conocidos', () => {
    const result = toRoles(['TENANT_ADMIN', 'UNKNOWN_ROLE']);
    expect(result).toEqual([UserRole.TenantAdmin]);
  });

  it('retorna array vacío para null', () => {
    expect(toRoles(null)).toEqual([]);
  });
});

describe('toPermissions', () => {
  it('filtra solo permisos conocidos', () => {
    const result = toPermissions(['users:read', 'unknown:perm']);
    expect(result).toEqual(['users:read' as Permission]);
  });

  it('retorna array vacío para undefined', () => {
    expect(toPermissions(undefined)).toEqual([]);
  });
});
