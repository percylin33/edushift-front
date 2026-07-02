import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InvitationsTableComponent } from './invitations-table.component';
import { InvitationsStore } from '../store';
import { Invitation } from '../models';
import { InvitationStatus, UserRole } from '@core/enums';

describe('InvitationsTableComponent', () => {
  let fixture: ComponentFixture<InvitationsTableComponent>;
  let component: InvitationsTableComponent;
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
    TestBed.configureTestingModule({
      imports: [InvitationsTableComponent],
      providers: [{ provide: InvitationsStore, useValue: fakeStore }],
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
      (component as any).canCancel({ ...invitation, status: InvitationStatus.Pending }),
    ).toBeTrue();
    expect(
      (component as any).canCancel({ ...invitation, status: InvitationStatus.Cancelled }),
    ).toBeFalse();
    expect(
      (component as any).canCancel({ ...invitation, status: InvitationStatus.Accepted }),
    ).toBeFalse();
  });

  it('onCancel confirmado llama store y limpia pendingCancelId', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(true);
    await (component as any).onCancel(invitation);
    expect(fakeStore.cancel).toHaveBeenCalledWith('inv-1');
    expect((component as any).pendingCancelId()).toBeNull();
  });

  it('onCancel cancelado por confirm', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).onCancel(invitation);
    expect(fakeStore.cancel).not.toHaveBeenCalled();
  });

  it('prev y next delegan al store', () => {
    configureModule();
    fakeStore.pagination.set({ page: 1, size: 20, totalElements: 100, totalPages: 5 });
    (component as any).prev();
    (component as any).next();
    expect(fakeStore.goToPage).toHaveBeenCalledWith(0);
    expect(fakeStore.goToPage).toHaveBeenCalledWith(2);
  });

  it('retry limpia error y recarga', () => {
    configureModule();
    (component as any).retry();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadList).toHaveBeenCalled();
  });

  it('formatDate maneja undefined', () => {
    configureModule();
    expect((component as any).formatDate(undefined)).toBe('—');
  });

  it('canPrev / canNext reflejan paginación', () => {
    configureModule();
    fakeStore.pagination.set({ page: 0, size: 20, totalElements: 100, totalPages: 5 });
    expect((component as any).canPrev()).toBeFalse();
    expect((component as any).canNext()).toBeTrue();
  });
});
