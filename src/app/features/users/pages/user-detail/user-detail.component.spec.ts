import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { UserDetailComponent } from './user-detail.component';
import { UsersStore } from '../../store';
import { UserDetail } from '../../models';
import { UserRole, UserStatus } from '@core/enums';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('UserDetailComponent', () => {
  let fixture: ComponentFixture<UserDetailComponent>;
  let component: UserDetailComponent;
  let fakeStore: {
    selected: ReturnType<typeof signal<UserDetail | null>>;
    loadingDetail: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    loadDetail: jasmine.Spy;
    update: jasmine.Spy;
    assignRoles: jasmine.Spy;
    disable: jasmine.Spy;
    enable: jasmine.Spy;
    resetPassword: jasmine.Spy;
  };
  let fakeAuth: {
    user: ReturnType<typeof signal<{ publicUuid: string } | null>>;
    hasRole: jasmine.Spy;
  };

  const detail: UserDetail = {
    publicUuid: 'u-1',
    email: 'a@b.com',
    fullName: 'A B',
    firstName: 'A',
    lastName: 'B',
    phone: '555',
    avatarUrl: 'https://x.com/a.png',
    status: UserStatus.Active,
    emailVerified: true,
    mfaEnabled: false,
    roles: [UserRole.TenantAdmin],
  } as any;

  function configureModule(id: string | null = 'u-1'): void {
    TestBed.resetTestingModule();
    fakeStore = {
      selected: signal<UserDetail | null>(null),
      loadingDetail: signal(false),
      saving: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      loadDetail: jasmine.createSpy('loadDetail').and.returnValue(Promise.resolve(null)),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve(null)),
      assignRoles: jasmine.createSpy('assignRoles').and.returnValue(Promise.resolve(null)),
      disable: jasmine.createSpy('disable').and.returnValue(Promise.resolve(null)),
      enable: jasmine.createSpy('enable').and.returnValue(Promise.resolve(null)),
      resetPassword: jasmine.createSpy('resetPassword').and.returnValue(Promise.resolve(true)),
    };
    fakeAuth = {
      user: signal<{ publicUuid: string } | null>(null),
      hasRole: jasmine.createSpy('hasRole').and.returnValue(false),
    };
    TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: UsersStore, useValue: fakeStore },
        { provide: AuthService, useValue: fakeAuth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('expone usersLink', () => {
    configureModule();
    expect((component as any).usersLink).toBe(ROUTES.USERS.LIST);
  });

  it('ngOnInit sin id redirige a lista', async () => {
    configureModule(null);
    await component.ngOnInit();
    expect(fakeStore.loadDetail).not.toHaveBeenCalled();
  });

  it('ngOnInit con id carga detalle', async () => {
    configureModule();
    fakeStore.loadDetail.and.returnValue(Promise.resolve(detail));
    await component.ngOnInit();
    expect(fakeStore.loadDetail).toHaveBeenCalledWith('u-1');
    expect((component as any).firstName).toBe('A');
  });

  it('isProfileDirty compara contra detail actual', () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).firstName = 'A';
    expect((component as any).isProfileDirty()).toBeFalse();
    (component as any).firstName = 'Other';
    expect((component as any).isProfileDirty()).toBeTrue();
  });

  it('resetProfile restaura valores desde detail', () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).firstName = 'X';
    (component as any).resetProfile();
    expect((component as any).firstName).toBe('A');
  });

  it('onSaveProfile con cambios llama update', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).firstName = 'Updated';
    fakeStore.update.and.returnValue(Promise.resolve({ ...detail, firstName: 'Updated' }));
    await (component as any).onSaveProfile();
    expect(fakeStore.update).toHaveBeenCalledWith(
      'u-1',
      jasmine.objectContaining({ firstName: 'Updated' }),
    );
  });

  it('onSaveProfile sin cambios no llama update', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).firstName = 'A';
    await (component as any).onSaveProfile();
    expect(fakeStore.update).not.toHaveBeenCalled();
  });

  it('isRolesDirty compara sets', () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).pendingRoles.set([UserRole.TenantAdmin]);
    expect((component as any).isRolesDirty()).toBeFalse();
    (component as any).pendingRoles.set([UserRole.Teacher]);
    expect((component as any).isRolesDirty()).toBeTrue();
  });

  it('onSaveRoles no llama si roles vacíos', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).pendingRoles.set([]);
    await (component as any).onSaveRoles();
    expect(fakeStore.assignRoles).not.toHaveBeenCalled();
  });

  it('onSaveRoles llama con roles', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    (component as any).pendingRoles.set([UserRole.Teacher]);
    fakeStore.assignRoles.and.returnValue(
      Promise.resolve({ ...detail, roles: [UserRole.Teacher] }),
    );
    await (component as any).onSaveRoles();
    expect(fakeStore.assignRoles).toHaveBeenCalled();
  });

  it('onDisable requiere confirm y no es self', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    spyOn(window, 'confirm').and.returnValue(true);
    fakeStore.disable.and.returnValue(Promise.resolve(detail));
    await (component as any).onDisable();
    expect(fakeStore.disable).toHaveBeenCalledWith('u-1');
  });

  it('onDisable cancelado por confirm', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).onDisable();
    expect(fakeStore.disable).not.toHaveBeenCalled();
  });

  it('onDisable bloqueado si es self', async () => {
    configureModule();
    fakeAuth.user.set({ publicUuid: 'u-1' });
    fakeStore.selected.set(detail);
    spyOn(window, 'confirm').and.returnValue(true);
    await (component as any).onDisable();
    expect(fakeStore.disable).not.toHaveBeenCalled();
  });

  it('onEnable llama enable', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeStore.enable.and.returnValue(Promise.resolve(detail));
    await (component as any).onEnable();
    expect(fakeStore.enable).toHaveBeenCalledWith('u-1');
  });

  it('onResetPassword activa banner', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    spyOn(window, 'confirm').and.returnValue(true);
    fakeStore.resetPassword.and.returnValue(Promise.resolve(true));
    await (component as any).onResetPassword();
    expect((component as any).resetSent()).toBeTrue();
  });

  it('isSelf compara currentUser con detail', () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeAuth.user.set({ publicUuid: 'u-1' });
    expect((component as any).isSelf()).toBeTrue();
    fakeAuth.user.set({ publicUuid: 'other' });
    expect((component as any).isSelf()).toBeFalse();
  });

  it('isRoleLocked protege TENANT_ADMIN si es self', () => {
    configureModule();
    fakeAuth.user.set({ publicUuid: 'u-1' });
    expect((component as any).isRoleLocked(UserRole.TenantAdmin)).toBeTrue();
    expect((component as any).isRoleLocked(UserRole.Teacher)).toBeFalse();
  });

  it('rolesSubtitle formatea plural correctamente', () => {
    configureModule();
    expect((component as any).rolesSubtitle({ ...detail, roles: [] })).toContain('Sin rol');
    expect((component as any).rolesSubtitle({ ...detail, roles: [UserRole.Teacher] })).toContain(
      '1 rol asignado',
    );
    expect(
      (component as any).rolesSubtitle({ ...detail, roles: [UserRole.Teacher, UserRole.Staff] }),
    ).toContain('2 roles asignados');
  });

  it('formatDate maneja undefined', () => {
    configureModule();
    expect((component as any).formatDate(undefined)).toBe('—');
  });
});
