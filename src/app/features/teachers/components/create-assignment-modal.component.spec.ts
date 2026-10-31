import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CreateAssignmentModalComponent } from './create-assignment-modal.component';
import { TeacherAssignmentsStore } from '../store';
import { AcademicApiService } from '@features/academic/services';
import { TeacherDetail } from '../models';
import { AcademicPeriodRow, CourseRow, PeriodType, SectionRow } from '@features/academic/models';
import { DocumentType, EmploymentStatus } from '@core/enums';

function testFixture<T>(value: Partial<T>): T {
  return value as T;
}

describe('CreateAssignmentModalComponent', () => {
  let fixture: ComponentFixture<CreateAssignmentModalComponent>;
  let component: CreateAssignmentModalComponent;
  let fakeStore: {
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    create: jasmine.Spy;
    createCombinations: jasmine.Spy;
  };
  let fakeAcademic: jasmine.SpyObj<AcademicApiService>;

  const teacher: TeacherDetail = testFixture<TeacherDetail>({
    publicUuid: 't-1',
    documentType: DocumentType.Dni,
    documentNumber: '1',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    specializations: [],
    employmentStatus: EmploymentStatus.Active,
    hasUserAccount: false,
  });

  function configureModule(): void {
    fakeStore = {
      saving: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      create: jasmine.createSpy('create').and.returnValue(Promise.resolve(null)),
      createCombinations: jasmine
        .createSpy('createCombinations')
        .and.returnValue(Promise.resolve(null)),
    };
    fakeAcademic = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
      'listCourses',
      'listPeriods',
    ]);
    TestBed.configureTestingModule({
      imports: [CreateAssignmentModalComponent],
      providers: [
        { provide: TeacherAssignmentsStore, useValue: fakeStore },
        { provide: AcademicApiService, useValue: fakeAcademic },
      ],
    });
    fixture = TestBed.createComponent(CreateAssignmentModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('teacher', teacher);
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit limpia error y carga catálogos', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    await component.ngOnInit();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeAcademic.listYears).toHaveBeenCalled();
  });

  it('ngOnInit maneja error y vacía catálogos', async () => {
    configureModule();
    fakeAcademic.listYears.and.returnValue(of([]));
    fakeAcademic.listYears.and.throwError('boom');
    await component.ngOnInit();
    expect(component['activeYear']()).toBeNull();
    expect(component['sections']()).toEqual([]);
  });

  it('isCourseApplicable false si level del curso no coincide con la sección', () => {
    configureModule();
    component['sections'].set([
      testFixture<SectionRow>({ publicUuid: 'sec-1', levelPublicUuid: 'lv-1', levelCode: 'PRI' }),
    ]);
    component['sectionUuid'].set('sec-1');
    const course = testFixture<CourseRow>({
      publicUuid: 'c-1',
      code: 'M',
      name: 'M',
      isActive: true,
      levels: [{ publicUuid: 'lv-2', code: 'M', name: 'M', ordinal: 2 }],
    });
    expect(component['isCourseApplicable'](course)).toBeFalse();
  });

  it('isCourseApplicable false si levels vacío (no aplica a ningún nivel)', () => {
    configureModule();
    component['sections'].set([testFixture<SectionRow>({ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' })]);
    component['sectionUuid'].set('sec-1');
    const course = testFixture<CourseRow>({ publicUuid: 'c-1', code: 'M', name: 'M', isActive: true, levels: [] });
    expect(component['isCourseApplicable'](course)).toBeFalse();
  });

  it('isCourseApplicable true sin sección seleccionada', () => {
    configureModule();
    const course = testFixture<CourseRow>({ publicUuid: 'c-1', code: 'M', name: 'M', isActive: true, levels: [{ publicUuid: 'lv-1', code: 'M', name: 'M', ordinal: 1 }] });
    expect(component['isCourseApplicable'](course)).toBeTrue();
  });

  it('canSubmit false si faltan section/course/period', () => {
    configureModule();
    expect(component['canSubmit']()).toBeFalse();
  });

  it('canSubmit true con selección válida', () => {
    configureModule();
    component['sectionUuid'].set('sec-1');
    component['selectedCourseUuids'].set(['c-1']);
    component['periodUuid'].set('p-1');
    expect(component['canSubmit']()).toBeTrue();
  });

  it('canSubmit true en modo todo el año', () => {
    configureModule();
    component['sectionUuid'].set('sec-1');
    component['selectedCourseUuids'].set(['c-1']);
    component['periods'].set([
      testFixture<AcademicPeriodRow>({ publicUuid: 'p-1', academicYearPublicUuid: 'y-1', periodType: PeriodType.Bimestre, ordinal: 1, name: 'I Bimestre', startDate: new Date(2026, 2, 1), endDate: new Date(2026, 4, 30) }),
      testFixture<AcademicPeriodRow>({ publicUuid: 'p-2', academicYearPublicUuid: 'y-1', periodType: PeriodType.Bimestre, ordinal: 2, name: 'II Bimestre', startDate: new Date(2026, 5, 1), endDate: new Date(2026, 7, 30) }),
    ]);
    component['periodUuid'].set(component['ALL_YEAR_VALUE']);
    expect(component['canSubmit']()).toBeTrue();
    expect(component['plannedCount']()).toBe(2);
  });

  it('bulkPeriods prioriza bimestres sobre anual', () => {
    configureModule();
    component['periods'].set([
      testFixture<AcademicPeriodRow>({ publicUuid: 'a-1', academicYearPublicUuid: 'y-1', periodType: PeriodType.Anual, ordinal: 1, name: 'Año', startDate: new Date(2026, 2, 1), endDate: new Date(2026, 11, 31) }),
      testFixture<AcademicPeriodRow>({ publicUuid: 'b-2', academicYearPublicUuid: 'y-1', periodType: PeriodType.Bimestre, ordinal: 2, name: 'II Bimestre', startDate: new Date(2026, 5, 1), endDate: new Date(2026, 7, 30) }),
      testFixture<AcademicPeriodRow>({ publicUuid: 'b-1', academicYearPublicUuid: 'y-1', periodType: PeriodType.Bimestre, ordinal: 1, name: 'I Bimestre', startDate: new Date(2026, 2, 1), endDate: new Date(2026, 4, 30) }),
    ]);
    expect(component['bulkPeriods']().map((p) => p.publicUuid)).toEqual([
      'b-1',
      'b-2',
    ]);
  });

  it('selectAllApplicableCourses marca todos los del nivel', () => {
    configureModule();
    component['sections'].set([testFixture<SectionRow>({ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' })]);
    component['sectionUuid'].set('sec-1');
    component['courses'].set([
      testFixture<CourseRow>({ publicUuid: 'c-1', code: 'M', name: 'M', isActive: true, levels: [{ publicUuid: 'lv-1', code: 'M', name: 'M', ordinal: 1 }] }),
      testFixture<CourseRow>({ publicUuid: 'c-2', code: 'C', name: 'C', isActive: true, levels: [{ publicUuid: 'lv-1', code: 'C', name: 'C', ordinal: 1 }] }),
      testFixture<CourseRow>({ publicUuid: 'c-3', code: 'L', name: 'L', isActive: true, levels: [{ publicUuid: 'lv-9', code: 'L', name: 'L', ordinal: 9 }] }),
    ]);
    component['selectAllApplicableCourses']();
    expect(component['selectedCourseUuids']()).toEqual(['c-1', 'c-2']);
  });

  it('onSectionChange limpia cursos que dejan de aplicar', () => {
    configureModule();
    component['sections'].set([testFixture<SectionRow>({ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' })]);
    component['courses'].set([
      testFixture<CourseRow>({ publicUuid: 'c-1', code: 'M', name: 'M', isActive: true, levels: [{ publicUuid: 'lv-99', code: 'M', name: 'M', ordinal: 99 }] }),
    ]);
    component['selectedCourseUuids'].set(['c-1']);
    component['onSectionChange']('sec-1');
    expect(component['selectedCourseUuids']()).toEqual([]);
  });

  it('onSubmit llama createCombinations con cursos × periodos', async () => {
    configureModule();
    fakeStore.createCombinations.and.returnValue(
      Promise.resolve({ created: 4, skipped: 0 }),
    );
    component['sectionUuid'].set('sec-1');
    component['selectedCourseUuids'].set(['c-1', 'c-2']);
    component['periods'].set([
      testFixture<AcademicPeriodRow>({ publicUuid: 'p-1', academicYearPublicUuid: 'y-1', periodType: PeriodType.Bimestre, ordinal: 1, name: 'I Bimestre', startDate: new Date(2026, 2, 1), endDate: new Date(2026, 4, 30) }),
      testFixture<AcademicPeriodRow>({ publicUuid: 'p-2', academicYearPublicUuid: 'y-1', periodType: PeriodType.Bimestre, ordinal: 2, name: 'II Bimestre', startDate: new Date(2026, 5, 1), endDate: new Date(2026, 7, 30) }),
    ]);
    component['periodUuid'].set(component['ALL_YEAR_VALUE']);
    const created = jasmine.createSpy('created');
    component.created.subscribe(created);
    await component['onSubmit']();
    expect(fakeStore.createCombinations).toHaveBeenCalledWith(
      't-1',
      'sec-1',
      ['c-1', 'c-2'],
      ['p-1', 'p-2'],
      undefined,
    );
    expect(created).toHaveBeenCalled();
  });

  it('onSubmit no dispara si store devuelve null', async () => {
    configureModule();
    component['sectionUuid'].set('sec-1');
    component['selectedCourseUuids'].set(['c-1']);
    component['periodUuid'].set('p-1');
    fakeStore.createCombinations.and.returnValue(Promise.resolve(null));
    const created = jasmine.createSpy('created');
    component.created.subscribe(created);
    await component['onSubmit']();
    expect(created).not.toHaveBeenCalled();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    component['close']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it('periodTypeLabel retorna etiqueta', () => {
    configureModule();
    expect(component['periodTypeLabel'](PeriodType.Bimestre)).toBe('Bimestre');
  });
});
