import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { UserDetailComponent } from './user-detail.component';
import { UsersStore } from '../../store';
import { UserDetail } from '../../models';
import { UserRole, UserStatus } from '@core/enums';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';
import { UsersApiService } from '../../services';
import { of } from 'rxjs';
import { ConfirmDialogService } from '@shared/components/confirm-dialog/confirm-dialog.service';

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
  let fakeConfirm: jasmine.SpyObj<ConfirmDialogService>;

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
    fakeConfirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    fakeConfirm.open.and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: UsersStore, useValue: fakeStore },
        {
          provide: UsersApiService,
          useValue: {
            getStaffAccess: () => of({ profiles: [], overrides: {} }),
            replaceStaffAccess: () => of({ profiles: [], overrides: {} }),
          },
        },
        { provide: AuthService, useValue: fakeAuth },
        { provide: ConfirmDialogService, useValue: fakeConfirm },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
  }

  function selectDetail(user: UserDetail = detail): void {
    fakeStore.selected.set(user);
    component['hydrateProfile'](user);
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('expone usersLink', () => {
    configureModule();
    expect(component['usersLink']).toBe(ROUTES.USERS.LIST);
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
    expect(component['firstName']).toBe('A');
  });

  it('isProfileDirty compara contra detail actual', () => {
    configureModule();
    selectDetail();
    component['firstName'] = 'A';
    expect(component['isProfileDirty']()).toBeFalse();
    component['firstName'] = 'Other';
    expect(component['isProfileDirty']()).toBeTrue();
  });

  it('resetProfile restaura valores desde detail', () => {
    configureModule();
    selectDetail();
    component['firstName'] = 'X';
    component['resetProfile']();
    expect(component['firstName']).toBe('A');
  });

  it('onSaveProfile con cambios llama update', async () => {
    configureModule();
    selectDetail();
    component['firstName'] = 'Updated';
    fakeStore.update.and.returnValue(Promise.resolve({ ...detail, firstName: 'Updated' }));
    await component['onSaveProfile']();
    expect(fakeStore.update).toHaveBeenCalledWith(
      'u-1',
      jasmine.objectContaining({ firstName: 'Updated' }),
    );
  });

  it('onSaveProfile sin cambios no llama update', async () => {
    configureModule();
    selectDetail();
    component['firstName'] = 'A';
    await component['onSaveProfile']();
    expect(fakeStore.update).not.toHaveBeenCalled();
  });

  it('isRolesDirty compara sets', () => {
    configureModule();
    fakeStore.selected.set(detail);
    component['pendingRoles'].set([UserRole.TenantAdmin]);
    expect(component['isRolesDirty']()).toBeFalse();
    component['pendingRoles'].set([UserRole.Teacher]);
    expect(component['isRolesDirty']()).toBeTrue();
  });

  it('onSaveRoles no llama si roles vacíos', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    component['pendingRoles'].set([]);
    await component['onSaveRoles']();
    expect(fakeStore.assignRoles).not.toHaveBeenCalled();
  });

  it('onSaveRoles llama con roles', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    component['pendingRoles'].set([UserRole.Teacher]);
    fakeStore.assignRoles.and.returnValue(
      Promise.resolve({ ...detail, roles: [UserRole.Teacher] }),
    );
    await component['onSaveRoles']();
    expect(fakeStore.assignRoles).toHaveBeenCalled();
  });

  it('roles de perfil se muestran como informativos y no como opciones genéricas', () => {
    configureModule();
    const teacherUser = { ...detail, roles: [UserRole.Teacher] };
    const roleOptions = component['roleOptions'];

    expect(roleOptions.map((option) => option.value)).toEqual([
      UserRole.TenantAdmin,
      UserRole.Staff,
    ]);
    expect(component['profileManagedRoles'](teacherUser)).toEqual([UserRole.Teacher]);
  });

  it('cambiar accesos generales conserva los roles ligados a fichas', async () => {
    configureModule();
    const teacherUser = { ...detail, roles: [UserRole.Teacher] };
    fakeStore.selected.set(teacherUser);
    component['pendingRoles'].set([UserRole.Teacher, UserRole.Staff]);
    fakeStore.assignRoles.and.returnValue(
      Promise.resolve({ ...teacherUser, roles: [UserRole.Teacher, UserRole.Staff] }),
    );

    await component['onSaveRoles']();

    expect(fakeStore.assignRoles).toHaveBeenCalledWith('u-1', {
      roles: [UserRole.Teacher, UserRole.Staff],
    });
  });

  it('onDisable requiere confirm y no es self', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeConfirm.open.and.resolveTo(true);
    fakeStore.disable.and.returnValue(Promise.resolve(detail));
    await component['onDisable']();
    expect(fakeStore.disable).toHaveBeenCalledWith('u-1');
  });

  it('onDisable cancelado por confirm', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeConfirm.open.and.resolveTo(false);
    await component['onDisable']();
    expect(fakeStore.disable).not.toHaveBeenCalled();
  });

  it('onDisable bloqueado si es self', async () => {
    configureModule();
    fakeAuth.user.set({ publicUuid: 'u-1' });
    fakeStore.selected.set(detail);
    await component['onDisable']();
    expect(fakeStore.disable).not.toHaveBeenCalled();
  });

  it('onEnable llama enable', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeStore.enable.and.returnValue(Promise.resolve(detail));
    await component['onEnable']();
    expect(fakeStore.enable).toHaveBeenCalledWith('u-1');
  });

  it('onResetPassword abre modal', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    component['onResetPassword']();
    expect(component['resetModalOpen']()).toBeTrue();
  });

  it('confirmReset EMAIL activa banner', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeStore.resetPassword.and.returnValue(
      Promise.resolve({
        delivery: 'EMAIL',
        email: detail.email,
        temporaryPassword: null,
        mustChangePassword: false,
      }),
    );
    await component['confirmReset']('EMAIL');
    expect(fakeStore.resetPassword).toHaveBeenCalledWith('u-1', 'EMAIL');
    expect(component['resetSent']()).toBeTrue();
    expect(component['resetModalOpen']()).toBeFalse();
  });

  it('confirmReset TEMPORARY muestra clave', async () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeStore.resetPassword.and.returnValue(
      Promise.resolve({
        delivery: 'TEMPORARY',
        email: detail.email,
        temporaryPassword: 'Temp!234567890',
        mustChangePassword: true,
      }),
    );
    await component['confirmReset']('TEMPORARY');
    expect(component['tempPassword']()).toBe('Temp!234567890');
    expect(component['resetSent']()).toBeFalse();
  });

  it('isSelf compara currentUser con detail', () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeAuth.user.set({ publicUuid: 'u-1' });
    expect(component['isSelf']()).toBeTrue();
    fakeAuth.user.set({ publicUuid: 'other' });
    expect(component['isSelf']()).toBeFalse();
  });

  it('isRoleLocked protege TENANT_ADMIN si es self', () => {
    configureModule();
    fakeStore.selected.set(detail);
    fakeAuth.user.set({ publicUuid: 'u-1' });
    expect(component['isRoleLocked'](UserRole.TenantAdmin)).toBeTrue();
    expect(component['isRoleLocked'](UserRole.Teacher)).toBeFalse();
  });

  it('rolesSubtitle formatea plural correctamente', () => {
    configureModule();
    expect(component['rolesSubtitle']({ ...detail, roles: [] })).toContain('Sin rol');
    expect(component['rolesSubtitle']({ ...detail, roles: [UserRole.Teacher] })).toContain(
      '1 rol asignado',
    );
    expect(
      component['rolesSubtitle']({ ...detail, roles: [UserRole.Teacher, UserRole.Staff] }),
    ).toContain('2 roles asignados');
  });

  it('formatDate maneja undefined', () => {
    configureModule();
    expect(component['formatDate'](undefined)).toBe('—');
  });
});
