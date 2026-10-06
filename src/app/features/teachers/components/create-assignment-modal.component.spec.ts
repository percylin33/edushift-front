import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CreateAssignmentModalComponent } from './create-assignment-modal.component';
import { TeacherAssignmentsStore } from '../store';
import { AcademicApiService } from '@features/academic/services';
import { TeacherDetail } from '../models';
import { DocumentType, EmploymentStatus } from '@core/enums';

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
    expect((component as any).activeYear()).toBeNull();
    expect((component as any).sections()).toEqual([]);
  });

  it('isCourseApplicable false si level del curso no coincide con la sección', () => {
    configureModule();
    (component as any).sections.set([
      { publicUuid: 'sec-1', levelPublicUuid: 'lv-1', levelCode: 'PRI' } as any,
    ]);
    (component as any).sectionUuid.set('sec-1');
    const course = {
      publicUuid: 'c-1',
      code: 'M',
      name: 'M',
      levels: [{ publicUuid: 'lv-2' }],
    } as any;
    expect((component as any).isCourseApplicable(course)).toBeFalse();
  });

  it('isCourseApplicable false si levels vacío (no aplica a ningún nivel)', () => {
    configureModule();
    (component as any).sections.set([{ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' } as any]);
    (component as any).sectionUuid.set('sec-1');
    const course = { publicUuid: 'c-1', levels: [] } as any;
    expect((component as any).isCourseApplicable(course)).toBeFalse();
  });

  it('isCourseApplicable true sin sección seleccionada', () => {
    configureModule();
    const course = { publicUuid: 'c-1', levels: [{ publicUuid: 'lv-1' }] } as any;
    expect((component as any).isCourseApplicable(course)).toBeTrue();
  });

  it('canSubmit false si faltan section/course/period', () => {
    configureModule();
    expect((component as any).canSubmit()).toBeFalse();
  });

  it('canSubmit true con selección válida', () => {
    configureModule();
    (component as any).sectionUuid.set('sec-1');
    (component as any).selectedCourseUuids.set(['c-1']);
    (component as any).periodUuid.set('p-1');
    expect((component as any).canSubmit()).toBeTrue();
  });

  it('canSubmit true en modo todo el año', () => {
    configureModule();
    (component as any).sectionUuid.set('sec-1');
    (component as any).selectedCourseUuids.set(['c-1']);
    (component as any).periods.set([
      { publicUuid: 'p-1', periodType: 'BIMESTRE', ordinal: 1 } as any,
      { publicUuid: 'p-2', periodType: 'BIMESTRE', ordinal: 2 } as any,
    ]);
    (component as any).periodUuid.set((component as any).ALL_YEAR_VALUE);
    expect((component as any).canSubmit()).toBeTrue();
    expect((component as any).plannedCount()).toBe(2);
  });

  it('bulkPeriods prioriza bimestres sobre anual', () => {
    configureModule();
    (component as any).periods.set([
      { publicUuid: 'a-1', periodType: 'ANUAL', ordinal: 1 } as any,
      { publicUuid: 'b-2', periodType: 'BIMESTRE', ordinal: 2 } as any,
      { publicUuid: 'b-1', periodType: 'BIMESTRE', ordinal: 1 } as any,
    ]);
    expect((component as any).bulkPeriods().map((p: any) => p.publicUuid)).toEqual([
      'b-1',
      'b-2',
    ]);
  });

  it('selectAllApplicableCourses marca todos los del nivel', () => {
    configureModule();
    (component as any).sections.set([{ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' } as any]);
    (component as any).sectionUuid.set('sec-1');
    (component as any).courses.set([
      { publicUuid: 'c-1', levels: [{ publicUuid: 'lv-1' }] } as any,
      { publicUuid: 'c-2', levels: [{ publicUuid: 'lv-1' }] } as any,
      { publicUuid: 'c-3', levels: [{ publicUuid: 'lv-9' }] } as any,
    ]);
    (component as any).selectAllApplicableCourses();
    expect((component as any).selectedCourseUuids()).toEqual(['c-1', 'c-2']);
  });

  it('onSectionChange limpia cursos que dejan de aplicar', () => {
    configureModule();
    (component as any).sections.set([{ publicUuid: 'sec-1', levelPublicUuid: 'lv-1' } as any]);
    (component as any).courses.set([
      { publicUuid: 'c-1', levels: [{ publicUuid: 'lv-99' }] } as any,
    ]);
    (component as any).selectedCourseUuids.set(['c-1']);
    (component as any).onSectionChange('sec-1');
    expect((component as any).selectedCourseUuids()).toEqual([]);
  });

  it('onSubmit llama createCombinations con cursos × periodos', async () => {
    configureModule();
    fakeStore.createCombinations.and.returnValue(
      Promise.resolve({ created: 4, skipped: 0 }),
    );
    (component as any).sectionUuid.set('sec-1');
    (component as any).selectedCourseUuids.set(['c-1', 'c-2']);
    (component as any).periods.set([
      { publicUuid: 'p-1', periodType: 'BIMESTRE', ordinal: 1 } as any,
      { publicUuid: 'p-2', periodType: 'BIMESTRE', ordinal: 2 } as any,
    ]);
    (component as any).periodUuid.set((component as any).ALL_YEAR_VALUE);
    const created = jasmine.createSpy('created');
    component.created.subscribe(created);
    await (component as any).onSubmit();
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
    (component as any).sectionUuid.set('sec-1');
    (component as any).selectedCourseUuids.set(['c-1']);
    (component as any).periodUuid.set('p-1');
    fakeStore.createCombinations.and.returnValue(Promise.resolve(null));
    const created = jasmine.createSpy('created');
    component.created.subscribe(created);
    await (component as any).onSubmit();
    expect(created).not.toHaveBeenCalled();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);
    (component as any).close();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closed).toHaveBeenCalled();
  });

  it('periodTypeLabel retorna etiqueta', () => {
    configureModule();
    expect((component as any).periodTypeLabel('BIMESTRE')).toBe('Bimestre');
  });
});
