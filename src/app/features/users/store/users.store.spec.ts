import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UsersStore } from './users.store';
import { UsersApiService } from '../services';
import { UserDetail, UserRow } from '../models';
import { UserRole, UserStatus } from '@core/enums';

describe('UsersStore', () => {
  let store: UsersStore;
  let apiSpy: jasmine.SpyObj<UsersApiService>;

  const detail: UserDetail = {
    publicUuid: 'u-1',
    email: 'a@b.com',
    fullName: 'A B',
    firstName: 'A',
    lastName: 'B',
    status: UserStatus.Active,
    emailVerified: true,
    mfaEnabled: false,
    roles: [UserRole.Teacher],
  } as any;

  const row: UserRow = {
    publicUuid: 'u-1',
    email: 'a@b.com',
    fullName: 'A B',
    firstName: 'A',
    lastName: 'B',
    status: UserStatus.Active,
    roles: [UserRole.Teacher],
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<UsersApiService>('UsersApiService', [
      'list',
      'get',
      'update',
      'assignRoles',
      'disable',
      'enable',
      'resetPassword',
    ]);
    TestBed.configureTestingModule({
      providers: [UsersStore, { provide: UsersApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(UsersStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.items()).toEqual([]);
    expect(store.selected()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('applyFilters resetea a page 0', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [row],
        number: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
        empty: false,
        numberOfElements: 1,
      } as any),
    );
    await store.applyFilters({ search: 'a' });
    expect(store.filters().search).toBe('a');
    expect(store.pagination().page).toBe(0);
  });

  it('loadList carga items', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [row],
        number: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
        empty: false,
        numberOfElements: 1,
      } as any),
    );
    await store.loadList();
    expect(store.items()).toHaveSize(1);
  });

  it('loadList maneja error', async () => {
    apiSpy.list.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    await store.loadList();
    expect(store.error()).toBe('boom');
    expect(store.items()).toEqual([]);
  });

  it('loadDetail setea selected', async () => {
    apiSpy.get.and.returnValue(of(detail));
    const result = await store.loadDetail('u-1');
    expect(result?.publicUuid).toBe('u-1');
  });

  it('loadDetail con error setea mensaje y limpia selected', async () => {
    apiSpy.get.and.returnValue(throwError(() => ({ error: { message: 'not found' } })));
    const result = await store.loadDetail('u-1');
    expect(result).toBeNull();
    expect(store.selected()).toBeNull();
  });

  it('update upsert row en lista', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [row],
        number: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
        empty: false,
        numberOfElements: 1,
      } as any),
    );
    await store.loadList();
    apiSpy.update.and.returnValue(of({ ...detail, firstName: 'Updated' }));
    await store.update('u-1', { firstName: 'Updated' });
    expect(store.selected()?.firstName).toBe('Updated');
    expect(store.items()[0].firstName).toBe('Updated');
  });

  it('assignRoles actualiza roles', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [row],
        number: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
        empty: false,
        numberOfElements: 1,
      } as any),
    );
    await store.loadList();
    apiSpy.assignRoles.and.returnValue(of({ ...detail, roles: [UserRole.TenantAdmin] }));
    await store.assignRoles('u-1', { roles: [UserRole.TenantAdmin] });
    expect(store.selected()?.roles).toContain(UserRole.TenantAdmin);
  });

  it('disable y enable llaman al api', async () => {
    apiSpy.disable.and.returnValue(of({ ...detail, status: UserStatus.Suspended }));
    await store.disable('u-1');
    expect(apiSpy.disable).toHaveBeenCalledWith('u-1');
    apiSpy.enable.and.returnValue(of({ ...detail, status: UserStatus.Active }));
    await store.enable('u-1');
    expect(apiSpy.enable).toHaveBeenCalledWith('u-1');
  });

  it('resetPassword retorna true/false según éxito', async () => {
    apiSpy.resetPassword.and.returnValue(of(void 0));
    const ok = await store.resetPassword('u-1');
    expect(ok).toBeTrue();
    apiSpy.resetPassword.and.returnValue(throwError(() => new Error('fail')));
    const fail = await store.resetPassword('u-1');
    expect(fail).toBeFalse();
    expect(store.error()).toBeTruthy();
  });

  it('goToPage clampea al rango', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [],
        number: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
        empty: true,
        numberOfElements: 0,
      } as any),
    );
    await store.loadList();
    await store.goToPage(99);
    expect(store.pagination().page).toBe(0);
  });

  it('setPageSize resetea a page 0', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [],
        number: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
        empty: true,
        numberOfElements: 0,
      } as any),
    );
    await store.setPageSize(50);
    expect(store.pagination().size).toBe(50);
  });

  it('clearError y reset limpian estado', () => {
    store.reset();
    store.clearError();
    expect(store.error()).toBeNull();
    expect(store.items()).toEqual([]);
  });
});
