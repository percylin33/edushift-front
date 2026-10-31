import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { StudentsListComponent } from './students-list.component';
import { StudentsStore } from '../../store';
import { StudentRow, StudentListFilters } from '../../models';
import {  EnrollmentStatus } from '@core/enums';
import { ROUTES } from '@core/constants';
import { AcademicApiService } from '@features/academic/services';
import { of } from 'rxjs';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('StudentsListComponent', () => {
  let fixture: ComponentFixture<StudentsListComponent>;
  let component: StudentsListComponent;
  let fakeStore: {
    items: ReturnType<typeof signal<StudentRow[]>>;
    hasItems: ReturnType<typeof signal<boolean>>;
    isEmpty: ReturnType<typeof signal<boolean>>;
    loading: ReturnType<typeof signal<boolean>>;
    pagination: ReturnType<
      typeof signal<{ page: number; size: number; totalElements: number; totalPages: number }>
    >;
    error: ReturnType<typeof signal<string | null>>;
    filters: ReturnType<typeof signal<StudentListFilters>>;
    clearError: jasmine.Spy;
    loadList: jasmine.Spy;
    applyFilters: jasmine.Spy;
    goToPage: jasmine.Spy;
  };
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  function configureModule(): void {
    TestBed.resetTestingModule();
    fakeStore = {
      items: signal<StudentRow[]>([]),
      hasItems: signal(false),
      isEmpty: signal(true),
      loading: signal(false),
      pagination: signal({ page: 0, size: 20, totalElements: 0, totalPages: 0 }),
      error: signal<string | null>(null),
      filters: signal<StudentListFilters>({}),
      clearError: jasmine.createSpy('clearError'),
      loadList: jasmine.createSpy('loadList').and.returnValue(Promise.resolve()),
      applyFilters: jasmine.createSpy('applyFilters').and.returnValue(Promise.resolve()),
      goToPage: jasmine.createSpy('goToPage').and.returnValue(Promise.resolve()),
    };
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
    ]);
    TestBed.configureTestingModule({
      imports: [StudentsListComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: StudentsStore, useValue: fakeStore },
        { provide: AcademicApiService, useValue: fakeAcademic },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (_: string) => null } } },
        },
      ],
    });
    fixture = TestBed.createComponent(StudentsListComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('expone newRoute apuntando al alta', () => {
    configureModule();
    expect(component['newRoute']).toBe(ROUTES.STUDENTS.NEW);
  });

  it('ngOnInit carga filtros del store y dispara loadList', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    await component.ngOnInit();
    expect(fakeStore.applyFilters).toHaveBeenCalled();
  });

  it('onSearchChange programa debounce y aplica filtros', async () => {
    configureModule();
    jasmine.clock().install();
    component['onSearchChange']('juan');
    expect(component['search']()).toBe('juan');
    jasmine.clock().tick(400);
    expect(fakeStore.applyFilters).toHaveBeenCalled();
    jasmine.clock().uninstall();
  });

  it('onStatusChange aplica filtros inmediatamente', async () => {
    configureModule();
    component['onStatusChange'](EnrollmentStatus.Enrolled);
    expect(component['enrollmentStatus']()).toBe(EnrollmentStatus.Enrolled);
    expect(fakeStore.applyFilters).toHaveBeenCalled();
  });

  it('onCurrentSectionChange aplica filtros inmediatamente', async () => {
    configureModule();
    component['onCurrentSectionChange']('sec-1');
    expect(component['currentSectionId']()).toBe('sec-1');
    expect(fakeStore.applyFilters).toHaveBeenCalled();
  });

  it('prev y next delegan al store con páginas correctas', async () => {
    configureModule();
    fakeStore.pagination.set({ page: 1, size: 20, totalElements: 100, totalPages: 5 });
    component['prev']();
    component['next']();
    expect(fakeStore.goToPage).toHaveBeenCalledWith(0);
    expect(fakeStore.goToPage).toHaveBeenCalledWith(2);
  });

  it('retry limpia error y recarga listado', () => {
    configureModule();
    component['retry']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadList).toHaveBeenCalled();
  });

  it('openBulkModal y closeBulkModal alternan estado', () => {
    configureModule();
    component['openBulkModal']();
    expect(component['bulkOpen']()).toBeTrue();
    component['closeBulkModal']();
    expect(component['bulkOpen']()).toBeFalse();
  });

  it('detailLink y qrLink retornan rutas esperadas', () => {
    configureModule();
    expect(component['detailLink']('s-1')).toBe(ROUTES.STUDENTS.detail('s-1'));
    expect(component['qrLink']('s-1')).toBe(ROUTES.STUDENTS.qr('s-1'));
  });

  it('formatDate retorna em-dash para undefined', () => {
    configureModule();
    expect(component['formatDate'](undefined)).toBe('—');
  });

  it('formatDate formatea Date válida en es', () => {
    configureModule();
    const formatted = component['formatDate'](new Date('2026-06-15'));
    expect(formatted).toContain('2026');
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
    expect(component['parseStatus'](EnrollmentStatus.Enrolled)).toBe(
      EnrollmentStatus.Enrolled,
    );
    expect(component['parseStatus'](null)).toBeNull();
  });
});
