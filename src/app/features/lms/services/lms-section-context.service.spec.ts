import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { AcademicYearStatus, PeriodType, SectionRow } from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';
import { AssignmentRow } from '@features/teachers/models';
import { TeachersApiService } from '@features/teachers/services';
import { LmsSectionContextService } from './lms-section-context.service';

describe('LmsSectionContextService academic year isolation', () => {
  let service: LmsSectionContextService;
  let academicApi: jasmine.SpyObj<AcademicApiService>;
  let teachersApi: jasmine.SpyObj<TeachersApiService>;

  const assignment = (section: string, period: string): AssignmentRow => ({
    publicUuid: `assignment-${section}-${period}`,
    teacherPublicUuid: 'teacher',
    teacherFullName: 'Docente',
    sectionPublicUuid: section,
    sectionName: 'A',
    gradeName: '2do Primaria',
    coursePublicUuid: 'art',
    courseName: 'Arte y Cultura',
    courseCode: 'ART',
    academicPeriodPublicUuid: period,
    periodType: PeriodType.Bimestre,
    periodOrdinal: 1,
    active: true,
  });
  const section: SectionRow = {
    publicUuid: 'current',
    name: 'A',
    gradeName: '2do Primaria',
    academicYearPublicUuid: 'current-year',
    academicYearName: 'Nuevo año',
    academicYearStatus: AcademicYearStatus.Active,
    gradePublicUuid: 'grade',
    gradeOrdinal: 2,
    levelPublicUuid: 'level',
    levelCode: 'PRIMARY',
  };

  beforeEach(() => {
    academicApi = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', ['listSections']);
    teachersApi = jasmine.createSpyObj<TeachersApiService>('TeachersApiService', [
      'listMyAssignments',
    ]);
    academicApi.listSections.and.returnValue(of([section]));
    teachersApi.listMyAssignments.and.returnValue(
      of([
        assignment('previous', 'previous-period'),
        assignment('current', 'current-period'),
        assignment('future', 'future-period'),
      ]),
    );
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { hasRole: (role: UserRole) => role === UserRole.Teacher },
        },
        { provide: AcademicApiService, useValue: academicApi },
        { provide: TeachersApiService, useValue: teachersApi },
      ],
    });
    service = TestBed.inject(LmsSectionContextService);
  });

  it('excludes previous and draft years from course cards and section counts', async () => {
    const rows = await service.loadCurrentYearAssignments();
    expect(rows.map((row) => row.sectionPublicUuid)).toEqual(['current']);
    expect(service.groupCoursesFromAssignments(rows)[0].sectionCount).toBe(1);
  });

  it('never falls back to another year when the preferred period has no assignment', async () => {
    const result = await service.sectionsForCourse('art', 'missing-period');
    expect(result.sections).toEqual([
      {
        sectionPublicUuid: 'current',
        label: '2do Primaria · A',
        assignmentPublicUuid: 'assignment-current-current-period',
        academicPeriodPublicUuid: 'current-period',
      },
    ]);
  });

  it('omits old sections from the section switcher', async () => {
    expect(await service.loadSectionOptions()).toEqual([
      { publicUuid: 'current', label: '2do Primaria · A' },
    ]);
  });

  it('returns no courses when no year is active', async () => {
    academicApi.listSections.and.returnValue(of([]));
    expect(await service.sectionsForCourse('art')).toEqual({ course: null, sections: [] });
  });

  it('does not expose all years when loading current sections fails', async () => {
    academicApi.listSections.and.returnValue(throwError(() => new Error('Unavailable')));
    await expectAsync(service.loadCurrentYearAssignments()).toBeRejected();
  });

  it('keeps assignment history available to existing detail screens', async () => {
    expect((await service.loadMyAssignments()).length).toBe(3);
  });
});
