import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { UsersListComponent } from './users-list.component';
import { InvitationsStore, UsersStore } from '../../store';
import { UserRow, UserListFilters, Invitation } from '../../models';
import { UserRole, UserStatus } from '@core/enums';
import { ROUTES } from '@core/constants';

describe('UsersListComponent', () => {
  let fixture: ComponentFixture<UsersListComponent>;
  let component: UsersListComponent;
  let fakeUsersStore: {
    items: ReturnType<typeof signal<UserRow[]>>;
    hasItems: ReturnType<typeof signal<boolean>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    loading: ReturnType<typeof signal<boolean>>;
    pagination: ReturnType<
      typeof signal<{ page: number; size: number; totalElements: number; totalPages: number }>
    >;
    error: ReturnType<typeof signal<string | null>>;
    filters: ReturnType<typeof signal<UserListFilters>>;
    clearError: jasmine.Spy;
    loadList: jasmine.Spy;
    applyFilters: jasmine.Spy;
    goToPage: jasmine.Spy;
  };
  let fakeInvStore: {
    items: ReturnType<typeof signal<Invitation[]>>;
    pagination: ReturnType<
      typeof signal<{ page: number; size: number; totalElements: number; totalPages: number }>
    >;
    clearLastCreated: jasmine.Spy;
    clearError: jasmine.Spy;
    loadList: jasmine.Spy;
  };

  function configureModule(tabParam: string | null = null): void {
    TestBed.resetTestingModule();
    fakeUsersStore = {
      items: signal<UserRow[]>([]),
      hasItems: signal(false),
      isEmpty: signal(true),
      loading: signal(false),
      pagination: signal({ page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      error: signal<string | null>(null),
      filters: signal<UserListFilters>({}),
      clearError: jasmine.createSpy('clearError'),
      loadList: jasmine.createSpy('loadList').and.returnValue(Promise.resolve()),
      applyFilters: jasmine.createSpy('applyFilters').and.returnValue(Promise.resolve()),
      goToPage: jasmine.createSpy('goToPage').and.returnValue(Promise.resolve()),
    };
    fakeInvStore = {
      items: signal<Invitation[]>([]),
      pagination: signal({ page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      clearLastCreated: jasmine.createSpy('clearLastCreated'),
      clearError: jasmine.createSpy('clearError'),
      loadList: jasmine.createSpy('loadList').and.returnValue(Promise.resolve()),
    };
    TestBed.configureTestingModule({
      imports: [UsersListComponent],
      providers: [
        provideRouter([]),
        { provide: UsersStore, useValue: fakeUsersStore },
        { provide: InvitationsStore, useValue: fakeInvStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (_: string) => null } },
            queryParamMap: of(new Map(tabParam ? [['tab', tabParam]] : [])),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(UsersListComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit hidrata filtros y carga lista', async () => {
    configureModule();
    await component.ngOnInit();
    expect(fakeUsersStore.loadList).toHaveBeenCalled();
  });

  it('ngOnInit respeta items ya cargados', async () => {
    configureModule();
    fakeUsersStore.items.set([
      { publicUuid: 'u-1', email: 'a@b.com', fullName: 'A', status: UserStatus.Active, roles: [] },
    ]);
    await component.ngOnInit();
    expect(fakeUsersStore.loadList).not.toHaveBeenCalled();
  });

  it('openInviteModal limpia estado y abre modal', () => {
    configureModule();
    component['openInviteModal']();
    expect(fakeInvStore.clearLastCreated).toHaveBeenCalled();
    expect(fakeInvStore.clearError).toHaveBeenCalled();
    expect(component['modalOpen']()).toBeTrue();
  });

  it('closeInviteModal cierra modal', () => {
    configureModule();
    component['closeInviteModal']();
    expect(component['modalOpen']()).toBeFalse();
  });

  it('onSearchChange debounce aplica filtros', async () => {
    configureModule();
    jasmine.clock().install();
    component['onSearchChange']('juan');
    expect(component['search']()).toBe('juan');
    jasmine.clock().tick(400);
    expect(fakeUsersStore.applyFilters).toHaveBeenCalled();
    jasmine.clock().uninstall();
  });

  it('onStatusChange aplica filtros', () => {
    configureModule();
    component['onStatusChange'](UserStatus.Active);
    expect(fakeUsersStore.applyFilters).toHaveBeenCalled();
  });

  it('onRoleChange aplica filtros', () => {
    configureModule();
    component['onRoleChange'](UserRole.Teacher);
    expect(fakeUsersStore.applyFilters).toHaveBeenCalled();
  });

  it('prev y next delegan al store', () => {
    configureModule();
    fakeUsersStore.pagination.set({ page: 1, size: 20, totalElements: 100, totalPages: 5 });
    component['prev']();
    component['next']();
    expect(fakeUsersStore.goToPage).toHaveBeenCalledWith(0);
    expect(fakeUsersStore.goToPage).toHaveBeenCalledWith(2);
  });

  it('retry limpia error y recarga', () => {
    configureModule();
    component['retry']();
    expect(fakeUsersStore.clearError).toHaveBeenCalled();
    expect(fakeUsersStore.loadList).toHaveBeenCalled();
  });

  it('detailLink retorna ruta del detalle', () => {
    configureModule();
    expect(component['detailLink']('u-1')).toBe(ROUTES.USERS.detail('u-1'));
  });

  it('formatDate maneja undefined con em-dash', () => {
    configureModule();
    expect(component['formatDate'](undefined)).toBe('—');
  });

  it('invitationsBadge lee del InvitationsStore', () => {
    configureModule();
    fakeInvStore.pagination.set({ page: 0, size: 20, totalElements: 7, totalPages: 1 });
    expect(component['invitationsBadge']()).toBe(7);
  });

  it('switchTab noop si ya está seleccionado', () => {
    configureModule();
    component['tab'].set('invitations');
    component['switchTab']('invitations');
    expect(component['tab']()).toBe('invitations');
  });

  it('tabClass refleja selección', () => {
    configureModule();
    const active = component['tabClass']('users');
    expect(active).toContain('border-primary-500');
    const inactive = component['tabClass']('invitations');
    expect(inactive).toContain('border-transparent');
  });
});
