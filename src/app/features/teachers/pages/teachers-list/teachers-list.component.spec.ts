import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TeachersListComponent } from './teachers-list.component';
import { TeachersStore } from '../../store';
import { TeacherRow, TeacherListFilters } from '../../models';
import {  EmploymentStatus } from '@core/enums';
import { ROUTES } from '@core/constants';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('TeachersListComponent', () => {
  let fixture: ComponentFixture<TeachersListComponent>;
  let component: TeachersListComponent;
  let fakeStore: {
    items: ReturnType<typeof signal<TeacherRow[]>>;
    hasItems: ReturnType<typeof signal<boolean>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    loading: ReturnType<typeof signal<boolean>>;
    pagination: ReturnType<
      typeof signal<{ page: number; size: number; totalElements: number; totalPages: number }>
    >;
    error: ReturnType<typeof signal<string | null>>;
    filters: ReturnType<typeof signal<TeacherListFilters>>;
    clearError: jasmine.Spy;
    loadList: jasmine.Spy;
    applyFilters: jasmine.Spy;
    goToPage: jasmine.Spy;
  };

  function configureModule(): void {
    TestBed.resetTestingModule();
    fakeStore = {
      items: signal<TeacherRow[]>([]),
      hasItems: signal(false),
      isEmpty: signal(true),
      loading: signal(false),
      pagination: signal({ page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      error: signal<string | null>(null),
      filters: signal<TeacherListFilters>({}),
      clearError: jasmine.createSpy('clearError'),
      loadList: jasmine.createSpy('loadList').and.returnValue(Promise.resolve()),
      applyFilters: jasmine.createSpy('applyFilters').and.returnValue(Promise.resolve()),
      goToPage: jasmine.createSpy('goToPage').and.returnValue(Promise.resolve()),
    };
    TestBed.configureTestingModule({
      imports: [TeachersListComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: TeachersStore, useValue: fakeStore },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (_: string) => null } } },
        },
      ],
    });
    fixture = TestBed.createComponent(TeachersListComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('expone newRoute apuntando al alta', () => {
    configureModule();
    expect(component['newRoute']).toBe(ROUTES.TEACHERS.NEW);
  });

  it('ngOnInit sin query params hidrata del store y carga lista', async () => {
    configureModule();
    await component.ngOnInit();
    expect(fakeStore.loadList).toHaveBeenCalled();
  });

  it('ngOnInit con query params aplica filtros', async () => {
    TestBed.resetTestingModule();
    fakeStore = {
      items: signal<TeacherRow[]>([]),
      hasItems: signal(false),
      isEmpty: signal(true),
      loading: signal(false),
      pagination: signal({ page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      error: signal<string | null>(null),
      filters: signal<TeacherListFilters>({}),
      clearError: jasmine.createSpy('clearError'),
      loadList: jasmine.createSpy('loadList').and.returnValue(Promise.resolve()),
      applyFilters: jasmine.createSpy('applyFilters').and.returnValue(Promise.resolve()),
      goToPage: jasmine.createSpy('goToPage').and.returnValue(Promise.resolve()),
    };
    TestBed.configureTestingModule({
      imports: [TeachersListComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: TeachersStore, useValue: fakeStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (k: string) =>
                  k === 'search' ? 'juan' : k === 'hasUserAccount' ? 'true' : null,
              },
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(TeachersListComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    expect(fakeStore.applyFilters).toHaveBeenCalled();
  });

  it('onSearchChange programa debounce y aplica filtros', async () => {
    configureModule();
    jasmine.clock().install();
    component['onSearchChange']('Maria');
    expect(component['search']()).toBe('Maria');
    jasmine.clock().tick(400);
    expect(fakeStore.applyFilters).toHaveBeenCalled();
    jasmine.clock().uninstall();
  });

  it('onStatusChange aplica filtros', async () => {
    configureModule();
    component['onStatusChange'](EmploymentStatus.Active);
    expect(component['employmentStatus']()).toBe(EmploymentStatus.Active);
    expect(fakeStore.applyFilters).toHaveBeenCalled();
  });

  it('onAccountChange aplica filtros', async () => {
    configureModule();
    component['onAccountChange'](true);
    expect(component['hasUserAccount']()).toBeTrue();
    expect(fakeStore.applyFilters).toHaveBeenCalled();
  });

  it('prev y next delegan al store', async () => {
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

  it('detailLink retorna ruta del detalle', () => {
    configureModule();
    expect(component['detailLink']('t-1')).toBe(ROUTES.TEACHERS.detail('t-1'));
  });

  it('canPrev / canNext reflejan paginación', () => {
    configureModule();
    fakeStore.pagination.set({ page: 0, size: 20, totalElements: 100, totalPages: 5 });
    expect(component['canPrev']()).toBeFalse();
    expect(component['canNext']()).toBeTrue();
  });

  it('parseStatus descarta valores inválidos', () => {
    configureModule();
    expect(component['parseStatus']('BOGUS')).toBeNull();
    expect(component['parseStatus'](EmploymentStatus.Active)).toBe(EmploymentStatus.Active);
    expect(component['parseStatus'](null)).toBeNull();
  });

  it('parseBool interpreta true/false o null', () => {
    configureModule();
    expect(component['parseBool']('true')).toBeTrue();
    expect(component['parseBool']('false')).toBeFalse();
    expect(component['parseBool'](null)).toBeNull();
    expect(component['parseBool']('other')).toBeNull();
  });
});
