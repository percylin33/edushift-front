import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InvitationsTableComponent } from './invitations-table.component';
import { InvitationsStore } from '../store';
import { Invitation } from '../models';
import { InvitationStatus, UserRole } from '@core/enums';
import { DocumentType } from '@core/enums';
import { ConfirmDialogService } from '@shared/components';

describe('InvitationsTableComponent', () => {
  let fixture: ComponentFixture<InvitationsTableComponent>;
  let component: InvitationsTableComponent;
  let fakeConfirm: jasmine.SpyObj<ConfirmDialogService>;
  let fakeStore: {
    items: ReturnType<typeof signal<Invitation[]>>;
    hasItems: ReturnType<typeof signal<boolean>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    loading: ReturnType<typeof signal<boolean>>;
    pagination: ReturnType<
      typeof signal<{ page: number; size: number; totalElements: number; totalPages: number }>
    >;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    loadList: jasmine.Spy;
    goToPage: jasmine.Spy;
    cancel: jasmine.Spy;
  };

  const invitation: Invitation = {
    publicUuid: 'inv-1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    documentType: DocumentType.Dni,
    documentNumber: '87654321',
    fullName: 'A B',
    roles: [UserRole.Teacher],
    status: InvitationStatus.Pending,
    createdAt: new Date('2026-01-01'),
  };

  function configureModule(): void {
    fakeStore = {
      items: signal<Invitation[]>([]),
      hasItems: signal(false),
      isEmpty: signal(true),
      loading: signal(false),
      pagination: signal({ page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      loadList: jasmine.createSpy('loadList').and.returnValue(Promise.resolve()),
      goToPage: jasmine.createSpy('goToPage').and.returnValue(Promise.resolve()),
      cancel: jasmine.createSpy('cancel').and.returnValue(Promise.resolve(invitation)),
    };
    fakeConfirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    fakeConfirm.open.and.returnValue(Promise.resolve(false));
    TestBed.configureTestingModule({
      imports: [InvitationsTableComponent],
      providers: [
        { provide: InvitationsStore, useValue: fakeStore },
        { provide: ConfirmDialogService, useValue: fakeConfirm },
      ],
    });
    fixture = TestBed.createComponent(InvitationsTableComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga lista si vacía', () => {
    configureModule();
    component.ngOnInit();
    expect(fakeStore.loadList).toHaveBeenCalled();
  });

  it('ngOnInit no recarga si ya hay items', () => {
    configureModule();
    fakeStore.items.set([invitation]);
    component.ngOnInit();
    expect(fakeStore.loadList).not.toHaveBeenCalled();
  });

  it('canCancel true solo para PENDING', () => {
    configureModule();
    expect(
      component['canCancel']({ ...invitation, status: InvitationStatus.Pending }),
    ).toBeTrue();
    expect(
      component['canCancel']({ ...invitation, status: InvitationStatus.Cancelled }),
    ).toBeFalse();
    expect(
      component['canCancel']({ ...invitation, status: InvitationStatus.Accepted }),
    ).toBeFalse();
  });

  it('onCancel confirmado llama store y limpia pendingCancelId', async () => {
    configureModule();
    fakeConfirm.open.and.returnValue(Promise.resolve(true));
    await component['onCancel'](invitation);
    expect(fakeStore.cancel).toHaveBeenCalledWith('inv-1');
    expect(component['pendingCancelId']()).toBeNull();
  });

  it('onCancel cancelado por confirm', async () => {
    configureModule();
    fakeConfirm.open.and.returnValue(Promise.resolve(false));
    await component['onCancel'](invitation);
    expect(fakeStore.cancel).not.toHaveBeenCalled();
  });

  it('prev y next delegan al store', () => {
    configureModule();
    fakeStore.pagination.set({ page: 1, size: 20, totalElements: 100, totalPages: 5 });
    component['prev']();
    component['next']();
    expect(fakeStore.goToPage).toHaveBeenCalledWith(0);
    expect(fakeStore.goToPage).toHaveBeenCalledWith(2);
  });

  it('retry limpia error y recarga', () => {
    configureModule();
    component['retry']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadList).toHaveBeenCalled();
  });

  it('formatDate maneja undefined', () => {
    configureModule();
    expect(component['formatDate'](undefined)).toBe('—');
  });

  it('canPrev / canNext reflejan paginación', () => {
    configureModule();
    fakeStore.pagination.set({ page: 0, size: 20, totalElements: 100, totalPages: 5 });
    expect(component['canPrev']()).toBeFalse();
    expect(component['canNext']()).toBeTrue();
  });
});
