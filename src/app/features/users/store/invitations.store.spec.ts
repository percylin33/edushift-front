import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InvitationsStore } from './invitations.store';
import { UsersApiService } from '../services';
import { Invitation } from '../models';
import { InvitationStatus, UserRole } from '@core/enums';

describe('InvitationsStore', () => {
  let store: InvitationsStore;
  let apiSpy: jasmine.SpyObj<UsersApiService>;

  const invitation: Invitation = {
    publicUuid: 'inv-1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    fullName: 'A B',
    roles: [UserRole.Teacher],
    status: InvitationStatus.Pending,
    token: 'tok-1',
    expiresAt: new Date('2026-12-31'),
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<UsersApiService>('UsersApiService', [
      'listInvitations',
      'createInvitation',
      'cancelInvitation',
    ]);
    TestBed.configureTestingModule({
      providers: [InvitationsStore, { provide: UsersApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(InvitationsStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.items()).toEqual([]);
    expect(store.lastCreated()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.hasItems()).toBeFalse();
    expect(store.isEmpty()).toBeTrue();
  });

  it('loadList carga items y paginación', async () => {
    apiSpy.listInvitations.and.returnValue(
      of({
        content: [invitation],
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
    expect(store.pagination().totalElements).toBe(1);
  });

  it('loadList maneja error', async () => {
    apiSpy.listInvitations.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    await store.loadList();
    expect(store.error()).toBe('boom');
  });

  it('goToPage clampea al rango', async () => {
    apiSpy.listInvitations.and.returnValue(
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

  it('create guarda lastCreated y prepends a la lista', async () => {
    apiSpy.createInvitation.and.returnValue(of(invitation));
    const result = await store.create({
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      roles: [UserRole.Teacher],
    });
    expect(result?.publicUuid).toBe('inv-1');
    expect(store.lastCreated()?.token).toBe('tok-1');
    expect(store.items()).toHaveSize(1);
    expect(store.pagination().totalElements).toBe(1);
  });

  it('create maneja error', async () => {
    apiSpy.createInvitation.and.returnValue(throwError(() => ({ error: { message: 'fail' } })));
    const result = await store.create({
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      roles: [UserRole.Teacher],
    });
    expect(result).toBeNull();
    expect(store.error()).toBe('fail');
  });

  it('cancel actualiza row en place', async () => {
    apiSpy.listInvitations.and.returnValue(
      of({
        content: [invitation],
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
    apiSpy.cancelInvitation.and.returnValue(
      of({ ...invitation, status: InvitationStatus.Cancelled, cancelledAt: new Date() }),
    );
    const result = await store.cancel('inv-1');
    expect(result?.status).toBe(InvitationStatus.Cancelled);
    expect(store.items()[0].status).toBe(InvitationStatus.Cancelled);
  });

  it('cancel maneja error', async () => {
    apiSpy.cancelInvitation.and.returnValue(throwError(() => ({ error: { message: 'fail' } })));
    const result = await store.cancel('inv-1');
    expect(result).toBeNull();
    expect(store.error()).toBe('fail');
  });

  it('clearLastCreated y clearError', () => {
    store.clearLastCreated();
    store.clearError();
    expect(store.lastCreated()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('reset limpia todo el estado', () => {
    store.reset();
    expect(store.items()).toEqual([]);
    expect(store.error()).toBeNull();
    expect(store.lastCreated()).toBeNull();
  });
});
