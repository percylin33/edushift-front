import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TeacherAssignmentsTabComponent } from './teacher-assignments-tab.component';
import { TeacherAssignmentsStore } from '../store';
import { TeacherDetail, AssignmentRow } from '../models';
import { DocumentType, EmploymentStatus, PeriodType } from '@core/enums';
import { ROUTES } from '@core/constants';

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
    coursePublicUuid: 'c-1',
    courseCode: 'MATH-101',
    courseName: 'Algebra',
    academicPeriodPublicUuid: 'p-1',
    periodType: PeriodType.Quarter,
    periodOrdinal: 1,
    assignedAt: new Date('2026-01-01'),
    unassignedAt: undefined,
    active: true,
  };

  function configureModule(): void {
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
      providers: [provideRouter([]), { provide: TeacherAssignmentsStore, useValue: fakeStore }],
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
    expect(fakeStore.loadAssignmentsFor).toHaveBeenCalledWith('t-1', { active: true });
  });

  it('evaluationsRoute retorna ruta correcta', () => {
    configureModule();
    expect((component as any).evaluationsRoute('a-1')).toBe(ROUTES.EVALUATIONS.byAssignment('a-1'));
  });

  it('showActiveOnly refleja filtros del store', () => {
    configureModule();
    expect((component as any).showActiveOnly()).toBeTrue();
    fakeStore.filters.set({ active: false });
    expect((component as any).showActiveOnly()).toBeFalse();
  });

  it('periodLabel combina tipo y ordinal', () => {
    configureModule();
    const label = (component as any).periodLabel({
      periodType: PeriodType.Quarter,
      periodOrdinal: 2,
    });
    expect(label).toContain('2');
  });

  it('setActive cambia filtro si difiere', async () => {
    configureModule();
    await (component as any).setActive(false);
    expect(fakeStore.setActiveFilter).toHaveBeenCalledWith(false);
  });

  it('setActive no llama store si es mismo valor', async () => {
    configureModule();
    await (component as any).setActive(true);
    expect(fakeStore.setActiveFilter).not.toHaveBeenCalled();
  });

  it('reload limpia error y recarga', async () => {
    configureModule();
    await (component as any).reload();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadAssignmentsFor).toHaveBeenCalled();
  });

  it('openCreate y closeCreate alternan modal', () => {
    configureModule();
    (component as any).openCreate();
    expect((component as any).showCreate()).toBeTrue();
    (component as any).closeCreate();
    expect((component as any).showCreate()).toBeFalse();
    (component as any).openCreate();
    (component as any).onCreated();
    expect((component as any).showCreate()).toBeFalse();
  });

  it('onSoftEnd confirmado llama store', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(true);
    await (component as any).onSoftEnd('a-1', 'A', 'MATH');
    expect(fakeStore.softEnd).toHaveBeenCalledWith('a-1');
  });

  it('onSoftEnd cancelado no llama store', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).onSoftEnd('a-1', 'A', 'MATH');
    expect(fakeStore.softEnd).not.toHaveBeenCalled();
  });
});
