import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeachersStore } from './teachers.store';
import { TeachersApiService } from '../services';
import { TeacherDetail, TeacherInvitationResult } from '../models';
import { DocumentType, EmploymentStatus } from '@core/enums';

describe('TeachersStore', () => {
  let store: TeachersStore;
  let apiSpy: jasmine.SpyObj<TeachersApiService>;

  const detail: TeacherDetail = {
    publicUuid: 't-1',
    documentType: DocumentType.Dni,
    documentNumber: '87654321',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    specializations: [],
    employmentStatus: EmploymentStatus.Active,
    hasUserAccount: false,
  } as any;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<TeachersApiService>('TeachersApiService', [
      'list',
      'get',
      'create',
      'update',
      'delete',
      'linkUser',
      'invite',
    ]);
    TestBed.configureTestingModule({
      providers: [TeachersStore, { provide: TeachersApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(TeachersStore);
  });

  it('inicia con estado vacío', () => {
    expect(store.items()).toEqual([]);
    expect(store.loading()).toBeFalse();
    expect(store.selected()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.lastInvitation()).toBeNull();
  });

  it('applyFilters resetea a page 0 y carga', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [detail],
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
    await store.applyFilters({ search: 'Maria' });
    expect(store.filters().search).toBe('Maria');
    expect(store.pagination().page).toBe(0);
    expect(apiSpy.list).toHaveBeenCalled();
  });

  it('loadList carga items + paginación', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [detail],
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
    expect(store.loading()).toBeFalse();
  });

  it('loadList maneja error y limpia items', async () => {
    apiSpy.list.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    await store.loadList();
    expect(store.error()).toBe('boom');
    expect(store.items()).toEqual([]);
  });

  it('loadDetail guarda selected', async () => {
    apiSpy.get.and.returnValue(of(detail));
    const result = await store.loadDetail('t-1');
    expect(result?.publicUuid).toBe('t-1');
    expect(store.selected()?.publicUuid).toBe('t-1');
  });

  it('create prepend fila a la lista', async () => {
    apiSpy.create.and.returnValue(of(detail));
    const result = await store.create({
      documentType: DocumentType.Dni,
      documentNumber: '87654321',
      firstName: 'Maria',
      lastName: 'Gomez',
    } as any);
    expect(result?.publicUuid).toBe('t-1');
    expect(store.items()).toHaveSize(1);
    expect(store.selected()?.publicUuid).toBe('t-1');
  });

  it('update upsert en lista y detail', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [detail],
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
    apiSpy.update.and.returnValue(of(detail));
    await store.update('t-1', { firstName: 'Updated' } as any);
    expect(store.selected()?.publicUuid).toBe('t-1');
  });

  it('delete remueve fila y limpia selected si coincide', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [detail],
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
    apiSpy.get.and.returnValue(of(detail));
    await store.loadDetail('t-1');
    apiSpy.delete.and.returnValue(of(void 0));
    const ok = await store.delete('t-1');
    expect(ok).toBeTrue();
    expect(store.items()).toHaveSize(0);
    expect(store.selected()).toBeNull();
  });

  it('invite guarda lastInvitation', async () => {
    const inv: TeacherInvitationResult = {
      invitationPublicUuid: 'inv-1',
      invitationToken: 'tok',
      expiresAt: new Date(),
      teacherPublicUuid: 't-1',
      email: 'm@s.com',
    };
    apiSpy.invite.and.returnValue(of(inv));
    await store.invite('t-1');
    expect(store.lastInvitation()?.invitationToken).toBe('tok');
  });

  it('invite con error setea mensaje', async () => {
    apiSpy.invite.and.returnValue(throwError(() => ({ error: { message: 'fail' } })));
    await store.invite('t-1');
    expect(store.error()).toBe('fail');
  });

  it('linkUser upsert detail y list row', async () => {
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
    apiSpy.linkUser.and.returnValue(of({ ...detail, hasUserAccount: true }));
    await store.linkUser('t-1', { userPublicUuid: 'u-1' });
    expect(store.selected()?.hasUserAccount).toBeTrue();
    expect(store.items()).toHaveSize(1);
  });

  it('goToPage clampea al rango válido', async () => {
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
    expect(store.pagination().page).toBe(0);
  });

  it('clearLastInvitation y clearError limpian estado', () => {
    store.clearError();
    store.clearLastInvitation();
    expect(store.error()).toBeNull();
    expect(store.lastInvitation()).toBeNull();
  });

  it('reset limpia todo el estado', () => {
    store.reset();
    expect(store.items()).toEqual([]);
    expect(store.filters()).toEqual({});
    expect(store.error()).toBeNull();
    expect(store.selected()).toBeNull();
  });

  it('hasItems / isEmpty reflejan items', () => {
    expect(store.hasItems()).toBeFalse();
    expect(store.isEmpty()).toBeTrue();
  });
});
