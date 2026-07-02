import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TeacherAssignmentsStore } from './teacher-assignments.store';
import { TeachersApiService } from '../services';
import { AssignmentRow, AssignmentDetail, SectionTeacherItem } from '../models';
import { PeriodType } from '@features/academic/models';

describe('TeacherAssignmentsStore', () => {
  let store: TeacherAssignmentsStore;
  let apiSpy: jasmine.SpyObj<TeachersApiService>;

  const mockRows: AssignmentRow[] = [
    {
      publicUuid: 'a-1',
      teacherPublicUuid: 't-1',
      teacherFullName: 'Maria Gomez',
      sectionPublicUuid: 'sec-1',
      sectionName: 'A',
      coursePublicUuid: 'c-1',
      courseCode: 'MATH-101',
      courseName: 'Algebra',
      academicPeriodPublicUuid: 'p-1',
      periodType: PeriodType.Bimestre,
      periodOrdinal: 1,
      assignedAt: new Date('2026-01-01'),
      unassignedAt: undefined,
      active: true,
    },
  ];

  const mockDetail: AssignmentDetail = {
    publicUuid: 'a-2',
    teacherPublicUuid: 't-1',
    teacherFullName: 'Maria Gomez',
    sectionPublicUuid: 'sec-2',
    sectionName: 'B',
    coursePublicUuid: 'c-2',
    courseCode: 'PHYS-101',
    courseName: 'Física',
    academicPeriodPublicUuid: 'p-1',
    periodType: PeriodType.Bimestre,
    periodOrdinal: 1,
    periodName: 'Q1',
    academicYearPublicUuid: 'y-1',
    academicYearName: '2026',
    assignedAt: new Date('2026-01-15'),
    unassignedAt: undefined,
    active: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<TeachersApiService>('TeachersApiService', [
      'listAssignments',
      'createAssignment',
      'softEndAssignment',
      'listSectionTeachers',
    ]);
    TestBed.configureTestingModule({
      providers: [TeacherAssignmentsStore, { provide: TeachersApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(TeacherAssignmentsStore);
  });

  it('inicia vacío', () => {
    expect(store.assignments()).toEqual([]);
    expect(store.loading()).toBeFalse();
    expect(store.saving()).toBeFalse();
    expect(store.sectionTeachers()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('loadAssignmentsFor carga y setea currentTeacherUuid', async () => {
    apiSpy.listAssignments.and.returnValue(of(mockRows));
    await store.loadAssignmentsFor('t-1');
    expect(store.assignments()).toHaveSize(1);
    expect(store.assignments()[0].courseCode).toBe('MATH-101');
    expect(store.hasAssignments()).toBeTrue();
  });

  it('loadAssignmentsFor con error vacía lista', async () => {
    apiSpy.listAssignments.and.returnValue(throwError(() => new Error('fail')));
    await store.loadAssignmentsFor('t-1');
    expect(store.assignments()).toEqual([]);
    expect(store.error()).toBeTruthy();
  });

  it('setActiveFilter cambia filtro y refetch', async () => {
    apiSpy.listAssignments.and.returnValue(of(mockRows));
    await store.loadAssignmentsFor('t-1');

    apiSpy.listAssignments.and.returnValue(of([]));
    await store.setActiveFilter(false);
    expect(store.filters().active).toBeFalse();
  });

  it('create añade row al inicio si coincide teacher', async () => {
    apiSpy.createAssignment.and.returnValue(of(mockDetail));
    apiSpy.listAssignments.and.returnValue(of([]));
    await store.loadAssignmentsFor('t-1');

    const result = await store.create('t-1', {
      sectionPublicUuid: 'sec-2',
      coursePublicUuid: 'c-2',
      academicPeriodPublicUuid: 'p-1',
    } as any);

    expect(result).toEqual(mockDetail);
    expect(store.assignments()).toHaveSize(1);
    expect(store.assignments()[0].courseCode).toBe('PHYS-101');
  });

  it('create no añade row si teacher no coincide', async () => {
    apiSpy.createAssignment.and.returnValue(of(mockDetail));
    apiSpy.listAssignments.and.returnValue(of([]));
    await store.loadAssignmentsFor('t-1');

    await store.create('t-2', {} as any);
    expect(store.assignments()).toEqual([]);
  });

  it('softEnd remueve row si active=true', async () => {
    apiSpy.softEndAssignment.and.returnValue(of(void 0));
    apiSpy.listAssignments.and.returnValue(of(mockRows));
    await store.loadAssignmentsFor('t-1');

    const success = await store.softEnd('a-1');
    expect(success).toBeTrue();
    expect(store.assignments()).toEqual([]);
  });

  it('softEnd con error retorna false', async () => {
    apiSpy.softEndAssignment.and.returnValue(throwError(() => new Error('fail')));
    apiSpy.listAssignments.and.returnValue(of(mockRows));
    await store.loadAssignmentsFor('t-1');

    const success = await store.softEnd('a-1');
    expect(success).toBeFalse();
  });

  it('loadSectionTeachers carga slice', async () => {
    const teachers: SectionTeacherItem[] = [
      {
        assignmentPublicUuid: 'a-1',
        teacherPublicUuid: 't-1',
        teacherFullName: 'Maria Gomez',
        coursePublicUuid: 'c-1',
        courseCode: 'MATH-101',
        courseName: 'Algebra',
        academicPeriodPublicUuid: 'p-1',
        periodType: PeriodType.Bimestre,
        periodOrdinal: 1,
        assignedAt: new Date('2026-01-01'),
      },
    ];
    apiSpy.listSectionTeachers.and.returnValue(of(teachers));
    await store.loadSectionTeachers('sec-1');
    expect(store.sectionTeachers()).toHaveSize(1);
  });

  it('clearAssignments resetea todo', async () => {
    apiSpy.listAssignments.and.returnValue(of(mockRows));
    await store.loadAssignmentsFor('t-1');
    store.clearAssignments();
    expect(store.assignments()).toEqual([]);
  });

  it('clearError limpia error', () => {
    store['_error'].set('algo');
    store.clearError();
    expect(store.error()).toBeNull();
  });
});
