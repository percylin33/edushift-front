import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LinkUserDialogComponent } from './link-user-dialog.component';
import { UsersApiService } from '@features/users/services';
import { TeachersStore } from '../store';
import { UserRole, DocumentType, UserStatus } from '@core/enums';
import { UserRow } from '@features/users/models';
import { TeacherDetail } from '../models';
import { of, throwError } from 'rxjs';

describe('LinkUserDialogComponent', () => {
  let fixture: ComponentFixture<LinkUserDialogComponent>;
  let component: LinkUserDialogComponent;
  let fakeUsersApi: jasmine.SpyObj<UsersApiService>;
  let fakeStore: {
    linkUser: jasmine.Spy;
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
  };

  const teacher: TeacherDetail = {
    publicUuid: 't-1',
    fullName: 'Maria Gomez',
    firstName: 'Maria',
    lastName: 'Gomez',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    email: 'maria@test.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockUsers: UserRow[] = [
    {
      publicUuid: 'u-1',
      fullName: 'Ana Lopez',
      email: 'ana@test.com',
      roles: [UserRole.Teacher],
      status: UserStatus.Active,
    },
    {
      publicUuid: 'u-2',
      fullName: 'Carlos Ruiz',
      email: 'carlos@test.com',
      roles: [UserRole.Teacher],
      status: UserStatus.Active,
    },
  ] as any;

  function configureModule(): void {
    fakeUsersApi = jasmine.createSpyObj<UsersApiService>('UsersApiService', ['list']);
    const savingSignal = signal(false);
    const errorSignal = signal<string | null>(null);
    fakeStore = {
      linkUser: jasmine.createSpy('linkUser'),
      saving: savingSignal,
      error: errorSignal,
      clearError: jasmine.createSpy('clearError'),
    };
    TestBed.configureTestingModule({
      imports: [LinkUserDialogComponent],
      providers: [
        { provide: UsersApiService, useValue: fakeUsersApi },
        { provide: TeachersStore, useValue: fakeStore },
      ],
    });
    fixture = TestBed.createComponent(LinkUserDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacher', teacher);
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga usuarios con rol TEACHER', async () => {
    configureModule();
    fakeUsersApi.list.and.returnValue(
      of({ content: mockUsers, totalElements: 2, totalPages: 1, number: 0, size: 100 } as any),
    );
    await component.ngOnInit();
    expect(fakeUsersApi.list).toHaveBeenCalledWith(
      {},
      { page: 0, size: 100, sort: 'lastName,ASC' },
    );
    expect(component['users']()).toHaveSize(2);
  });

  it('fetchUsers con error deja lista vacía', async () => {
    configureModule();
    fakeUsersApi.list.and.returnValue(throwError(() => new Error('fail')));
    await component.ngOnInit();
    expect(component['users']()).toEqual([]);
  });

  it('filtered filtra por nombre', async () => {
    configureModule();
    component['users'].set(mockUsers);
    component['search'].set('ana');
    expect(component['filtered']()).toHaveSize(1);
    expect(component['filtered']()[0].publicUuid).toBe('u-1');
  });

  it('filtered filtra por email', async () => {
    configureModule();
    component['users'].set(mockUsers);
    component['search'].set('carlos');
    expect(component['filtered']()).toHaveSize(1);
    expect(component['filtered']()[0].publicUuid).toBe('u-2');
  });

  it('filtered retorna todos si no hay búsqueda', () => {
    configureModule();
    component['users'].set(mockUsers);
    expect(component['filtered']()).toHaveSize(2);
  });

  it('onSelect llama store.linkUser y emite linked si ok', async () => {
    configureModule();
    fakeUsersApi.list.and.returnValue(of({ content: mockUsers } as any));
    await component.ngOnInit();

    fakeStore.linkUser.and.returnValue(Promise.resolve(true));
    const linkedSpy = jasmine.createSpy('linked');
    component.linked.subscribe(linkedSpy);

    await component['onSelect'](mockUsers[0]);
    expect(fakeStore.linkUser).toHaveBeenCalledWith('t-1', { userPublicUuid: 'u-1' });
    expect(linkedSpy).toHaveBeenCalled();
  });

  it('onSelect no emite linked si falla', async () => {
    configureModule();
    fakeStore.linkUser.and.returnValue(Promise.resolve(false));
    const linkedSpy = jasmine.createSpy('linked');
    component.linked.subscribe(linkedSpy);

    await component['onSelect'](mockUsers[0]);
    expect(linkedSpy).not.toHaveBeenCalled();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closeSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closeSpy);
    component['close']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('errorMessage expone store.error', () => {
    configureModule();
    fakeStore.error.set('falló');
    expect(component['errorMessage']()).toBe('falló');
  });

  it('linking expone store.saving', () => {
    configureModule();
    expect(component['linking']()).toBeFalse();
    fakeStore.saving.set(true);
    expect(component['linking']()).toBeTrue();
  });
});
