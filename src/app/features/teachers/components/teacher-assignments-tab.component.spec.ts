import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TeacherAssignmentsTabComponent } from './teacher-assignments-tab.component';
import { TeacherAssignmentsStore } from '../store';
import { TeacherDetail, AssignmentRow } from '../models';
import { DocumentType, EmploymentStatus } from '@core/enums';
import { PeriodType } from '@features/academic/models';
import { ROUTES } from '@core/constants';
import { of } from 'rxjs';
import { AcademicApiService } from '@features/academic/services';
import { ConfirmDialogService } from '@shared/components';

describe('TeacherAssignmentsTabComponent', () => {
  let fixture: ComponentFixture<TeacherAssignmentsTabComponent>;
  let component: TeacherAssignmentsTabComponent;
  let fakeStore: {
    assignments: ReturnType<typeof signal<AssignmentRow[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    filters: ReturnType<typeof signal<{ active?: boolean }>>;
    clearError: jasmine.Spy;
    loadAssignmentsFor: jasmine.Spy;
    setActiveFilter: jasmine.Spy;
    softEnd: jasmine.Spy;
  };
  let fakeAcademicApi: jasmine.SpyObj<AcademicApiService>;
  let fakeConfirm: jasmine.SpyObj<ConfirmDialogService>;

  const teacher: TeacherDetail = {
    publicUuid: 't-1',
    documentType: DocumentType.Dni,
    documentNumber: '1',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    specializations: [],
    employmentStatus: EmploymentStatus.Active,
    hasUserAccount: false,
  } as any;

  const assignment: AssignmentRow = {
    publicUuid: 'a-1',
    teacherPublicUuid: 't-1',
    teacherFullName: 'Maria Gomez',
    sectionPublicUuid: 'sec-1',
    sectionName: 'A',
    gradeName: '1ro',
    coursePublicUuid: 'c-1',
    courseCode: 'MATH-101',
    courseName: 'Algebra',
    academicPeriodPublicUuid: 'p-1',
    periodType: PeriodType.Bimestre,
    periodOrdinal: 1,
    assignedAt: new Date('2026-01-01'),
    unassignedAt: undefined,
    active: true,
  };

  function configureModule(): void {
    fakeAcademicApi = jasmine.createSpyObj<AcademicApiService>(
      'AcademicApiService',
      ['listYears', 'listSections', 'listPeriods'],
    );
    fakeAcademicApi.listYears.and.returnValue(of([]));
    fakeAcademicApi.listSections.and.returnValue(of([]));
    fakeAcademicApi.listPeriods.and.returnValue(of([]));
    fakeConfirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    fakeConfirm.open.and.resolveTo(false);
    fakeStore = {
      assignments: signal<AssignmentRow[]>([]),
      loading: signal(false),
      saving: signal(false),
      error: signal<string | null>(null),
      filters: signal<{ active?: boolean }>({ active: true }),
      clearError: jasmine.createSpy('clearError'),
      loadAssignmentsFor: jasmine
        .createSpy('loadAssignmentsFor')
        .and.returnValue(Promise.resolve()),
      setActiveFilter: jasmine.createSpy('setActiveFilter').and.returnValue(Promise.resolve()),
      softEnd: jasmine.createSpy('softEnd').and.returnValue(Promise.resolve(true)),
    };
    TestBed.configureTestingModule({
      imports: [TeacherAssignmentsTabComponent],
      providers: [
        provideRouter([]),
        { provide: TeacherAssignmentsStore, useValue: fakeStore },
        { provide: AcademicApiService, useValue: fakeAcademicApi },
        { provide: ConfirmDialogService, useValue: fakeConfirm },
      ],
    });
    fixture = TestBed.createComponent(TeacherAssignmentsTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacher', teacher);
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga asignaciones activas por defecto', async () => {
    configureModule();
    await component.ngOnInit();
    expect(fakeStore.loadAssignmentsFor).toHaveBeenCalledWith('t-1', {
      active: true,
      periodId: undefined,
    });
  });

  it('evaluationsRoute retorna ruta correcta', () => {
    configureModule();
    expect(component['evaluationsRoute']('a-1')).toBe(ROUTES.EVALUATIONS.byAssignment('a-1'));
  });

  it('showActiveOnly refleja filtros del store', () => {
    configureModule();
    expect(component['showActiveOnly']()).toBeTrue();
    fakeStore.filters.set({ active: false });
    expect(component['showActiveOnly']()).toBeFalse();
  });

  it('periodLabel combina tipo y ordinal', () => {
    configureModule();
    const label = component['periodLabelForAssignment']('p-1', {
      ...assignment,
      periodType: PeriodType.Bimestre,
      periodOrdinal: 2,
    });
    expect(label).toContain('2');
  });

  it('setActive cambia filtro si difiere', async () => {
    configureModule();
    await component['setActive'](false);
    expect(fakeStore.setActiveFilter).toHaveBeenCalledWith(false);
  });

  it('setActive no llama store si es mismo valor', async () => {
    configureModule();
    await component['setActive'](true);
    expect(fakeStore.setActiveFilter).not.toHaveBeenCalled();
  });

  it('reload limpia error y recarga', async () => {
    configureModule();
    await component['reload']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadAssignmentsFor).toHaveBeenCalled();
  });

  it('openCreate y closeCreate alternan modal', () => {
    configureModule();
    component['openCreate']();
    expect(component['showCreate']()).toBeTrue();
    component['closeCreate']();
    expect(component['showCreate']()).toBeFalse();
    component['openCreate']();
    component['onCreated']();
    expect(component['showCreate']()).toBeFalse();
  });

  it('onSoftEnd confirmado llama store', async () => {
    configureModule();
    fakeConfirm.open.and.resolveTo(true);
    await component['onSoftEnd']('a-1', 'A', 'MATH');
    expect(fakeStore.softEnd).toHaveBeenCalledWith('a-1');
  });

  it('onSoftEnd cancelado no llama store', async () => {
    configureModule();
    fakeConfirm.open.and.resolveTo(false);
    await component['onSoftEnd']('a-1', 'A', 'MATH');
    expect(fakeStore.softEnd).not.toHaveBeenCalled();
  });
});
