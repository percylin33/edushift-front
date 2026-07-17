import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';
import { TenantThemeService } from '@core/theming';
import { ThemeService } from './theme.service';
import { AuthSession, User } from '@core/models';
import { STORAGE_KEYS } from '@core/constants';
import { Permission, UserRole, UserStatus } from '@core/enums';

describe('AuthService', () => {
  let service: AuthService;
  let storage: jasmine.SpyObj<StorageService>;
  let tenantService: TenantService;

  const mockUser: User = {
    publicUuid: 'u-1',
    email: 'test@test.com',
    fullName: 'Test User',
    status: UserStatus.Active,
    roles: [UserRole.Parent],
    permissions: [Permission.StudentsRead],
  };

  const mockSession: AuthSession = {
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
    expiresAt: new Date('2026-07-01T00:00:00.000Z'),
    user: mockUser,
  };

  beforeEach(() => {
    storage = jasmine.createSpyObj<StorageService>('StorageService', ['get', 'set', 'remove']);
    storage.get.and.returnValue(null);

    const tenantThemeSpy = jasmine.createSpyObj('TenantThemeService', ['apply', 'reset']);
    const themeSpy = jasmine.createSpyObj('ThemeService', ['applyTenantDefault']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        TenantService,
        { provide: StorageService, useValue: storage },
        { provide: TenantThemeService, useValue: tenantThemeSpy },
        { provide: ThemeService, useValue: themeSpy },
      ],
    });
    service = TestBed.inject(AuthService);
    tenantService = TestBed.inject(TenantService);
  });

  it('inicia desautenticado', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.refreshToken()).toBeNull();
    expect(service.expiresAt()).toBeNull();
    expect(service.roles()).toEqual([]);
    expect(service.permissions()).toEqual([]);
  });

  it('setSession persiste todo en signals + storage', () => {
    service.setSession(mockSession);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.accessToken()).toBe('access-123');
    expect(service.refreshToken()).toBe('refresh-456');
    expect(service.user()?.email).toBe('test@test.com');

    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_USER, mockUser);
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.AUTH_TOKEN, 'access-123');
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN, 'refresh-456');
  });

  it('rotateTokens solo rota tokens, no toca el user', () => {
    service.setSession(mockSession);
    storage.set.calls.reset();

    const newSession: AuthSession = {
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      user: { publicUuid: 'u-1', email: 'x', fullName: 'Summary', status: UserStatus.Active },
    };
    service.rotateTokens(newSession);

    expect(service.accessToken()).toBe('access-new');
    expect(service.refreshToken()).toBe('refresh-new');
    expect(service.user()?.email).toBe('test@test.com');
  });

  it('setUser enriquece el user', () => {
    const enriched: User = {
      ...mockUser,
      phone: '+123456789',
    };
    service.setUser(enriched);
    expect(service.user()?.phone).toBe('+123456789');
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_USER, enriched);
  });

  it('clearSession limpia todo', () => {
    service.setSession(mockSession);
    service.clearSession();

    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.refreshToken()).toBeNull();
    expect(service.expiresAt()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();

    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_USER);
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.AUTH_TOKEN);
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.AUTH_EXPIRES_AT);
  });

  it('clearSession también limpia tenant (signals + storage)', () => {
    tenantService.setSlug('tecnosur');
    expect(tenantService.tenantSlug()).toBe('tecnosur');
    service.setSession(mockSession);

    service.clearSession();

    expect(tenantService.tenantSlug()).toBeNull();
    expect(tenantService.tenant()).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_TENANT);
  });

  it('clearSession deja el tenant context en resolvedFrom unknown', () => {
    tenantService.setSlug('tecnosur');
    service.setSession(mockSession);

    service.clearSession();

    expect(tenantService.context().resolvedFrom).toBe('unknown');
    expect(tenantService.context().tenant).toBeNull();
  });

  it('clearSession no rompe el flujo de auth (no-regresión)', () => {
    tenantService.setSlug('tecnosur');
    service.setSession(mockSession);

    service.clearSession();

    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.refreshToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('hasRole retorna true si el user tiene el rol', () => {
    service.setSession(mockSession);
    expect(service.hasRole(UserRole.Parent)).toBeTrue();
    expect(service.hasRole(UserRole.Teacher)).toBeFalse();
  });

  it('hasPermission retorna true si el user tiene el permiso', () => {
    service.setSession(mockSession);
    expect(service.hasPermission(Permission.StudentsRead)).toBeTrue();
    expect(service.hasPermission(Permission.UsersManage)).toBeFalse();
  });

  it('hasAllPermissions requiere todos los permisos', () => {
    service.setSession(mockSession);
    expect(service.hasAllPermissions(Permission.StudentsRead)).toBeTrue();
    expect(service.hasAllPermissions(Permission.StudentsRead, Permission.UsersManage)).toBeFalse();
  });
});
