import { TestBed } from '@angular/core/testing';
import { ApiService } from '@core/services';
import { firstValueFrom, of } from 'rxjs';
import { AcademicApiService } from './academic-api.service';

describe('AcademicApiService', () => {
  let service: AcademicApiService;
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [AcademicApiService, { provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(AcademicApiService);
  });

  function answer(value: unknown): void {
    api.get.and.returnValue(of(value));
  }

  it('serializes optional filters only when supplied', async () => {
    answer([]);
    await firstValueFrom(service.listYears());
    expect(api.get.calls.mostRecent().args[1]).toEqual({ status: undefined });

    await firstValueFrom(
      service.listSections({ academicYearPublicUuid: 'year-1', gradePublicUuid: 'grade-1' }),
    );
    expect(api.get.calls.mostRecent().args[1]).toEqual({
      academicYearId: 'year-1',
      gradeId: 'grade-1',
      levelId: undefined,
    });

    await firstValueFrom(service.listCourses({ levelPublicUuid: 'level-1', isActive: false }));
    expect(api.get.calls.mostRecent().args[1]).toEqual({ levelId: 'level-1', isActive: 'false' });
    await firstValueFrom(service.listCompetencies('course-1'));
    expect(api.get.calls.mostRecent().args[1]).toEqual({ isActive: undefined });
    await firstValueFrom(service.listCompetencies('course-1', true));
    expect(api.get.calls.mostRecent().args[1]).toEqual({ isActive: 'true' });
    await firstValueFrom(service.listCapacities('comp-1', false));
    expect(api.get.calls.mostRecent().args[1]).toEqual({ isActive: 'false' });
    await firstValueFrom(service.listAssignments({ activeOnly: false }));
    expect(api.get.calls.mostRecent().args[1]).toEqual({
      teacherId: undefined,
      sectionId: undefined,
      courseId: undefined,
      periodId: undefined,
      active: 'false',
    });
    await firstValueFrom(service.getTeacherSchedule('teacher-1'));
    expect(api.get.calls.mostRecent().args[1]).toEqual({ periodId: undefined });
    await firstValueFrom(service.getSectionSchedule('section-1', 'period-1'));
    expect(api.get.calls.mostRecent().args[1]).toEqual({ periodId: 'period-1' });
  });

  it('maps levels, grades and sections with and without optional data', async () => {
    answer([
      { publicUuid: 'level-1', code: 'P', name: 'Primaria', ordinal: 1, grades: undefined },
      {
        publicUuid: 'level-2',
        code: 'S',
        name: 'Secundaria',
        ordinal: 2,
        grades: [{ publicUuid: 'grade-1', levelPublicUuid: 'level-2', name: '1', ordinal: 1 }],
      },
    ]);
    const levels = await firstValueFrom(service.listLevels());
    expect(levels[0].grades).toEqual([]);
    expect(levels[1].grades[0].publicUuid).toBe('grade-1');
    expect(levels[0].createdAt).toBeUndefined();

    answer([
      { publicUuid: 'section-1', name: 'A', capacity: null, displayOrder: null },
      { publicUuid: 'section-2', name: 'B', capacity: 30, displayOrder: 2 },
    ]);
    const sections = await firstValueFrom(service.listSections());
    expect(sections[0].capacity).toBeUndefined();
    expect(sections[0].displayOrder).toBeUndefined();
    expect(sections[1].capacity).toBe(30);

    answer({
      data: {
        publicUuid: 'section-3',
        name: 'C',
        capacity: 25,
        displayOrder: 3,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: 'invalid-date',
      },
    });
    const section = await firstValueFrom(service.getSection('section-3'));
    expect(section.capacity).toBe(25);
    expect(section.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(section.updatedAt).toBeUndefined();
  });

  it('adapts course and period details, including nullable values and ordered levels', async () => {
    answer([
      { publicUuid: 'course-1', code: 'MAT', name: 'Matemática', isActive: true, levels: [] },
      {
        publicUuid: 'course-2',
        code: 'COM',
        name: 'Comunicación',
        isActive: true,
        credits: 4,
        hoursPerWeek: 6,
        color: '#123456',
        icon: 'book',
        levels: [
          { publicUuid: 'l2', ordinal: 2 },
          { publicUuid: 'l1', ordinal: 1 },
        ],
      },
    ]);
    const courses = await firstValueFrom(service.listCourses());
    expect(courses[0]).toEqual(
      jasmine.objectContaining({ credits: undefined, hoursPerWeek: undefined }),
    );
    expect(courses[1].levels.map((level) => level.ordinal)).toEqual([1, 2]);

    answer({
      data: {
        publicUuid: 'course-3',
        code: 'CIE',
        name: 'Ciencia',
        description: null,
        credits: null,
        hoursPerWeek: null,
        color: null,
        icon: null,
        isActive: false,
        levels: [],
      },
    });
    const course = await firstValueFrom(service.getCourse('course-3'));
    expect(course.description).toBeUndefined();
    expect(course.color).toBeUndefined();

    answer({
      data: {
        publicUuid: 'period-1',
        academicYearPublicUuid: 'year-1',
        academicYearName: '2026',
        periodType: 'BIMESTRE',
        ordinal: 1,
        name: 'I Bimestre',
        startDate: '2026-03-01',
        endDate: '2026-05-31',
        createdAt: null,
        updatedAt: null,
      },
    });
    const period = await firstValueFrom(service.getPeriod('period-1'));
    expect(period.startDate).toEqual(new Date(2026, 2, 1));
    expect(period.createdAt).toBeUndefined();
  });

  it('maps unit dates, descriptions and competency catalog fallbacks', async () => {
    answer([
      {
        publicUuid: 'unit-1',
        name: 'Unidad 1',
        displayOrder: 1,
        startDate: null,
        endDate: '',
        isActive: true,
      },
      {
        publicUuid: 'unit-2',
        name: 'Unidad 2',
        displayOrder: 2,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        isActive: true,
      },
    ]);
    const units = await firstValueFrom(service.listUnits('course-1'));
    expect(units[0].startDate).toBeUndefined();
    expect(units[1].endDate).toEqual(new Date(2026, 3, 30));

    answer({
      data: {
        publicUuid: 'unit-3',
        course: { publicUuid: 'course-1', code: 'MAT', name: 'Matemática' },
        name: 'Unidad 3',
        description: null,
        displayOrder: 3,
        startDate: '2026-05-01',
        endDate: null,
        isActive: true,
        sessionCount: 0,
      },
    });
    const unit = await firstValueFrom(service.getUnit('unit-3'));
    expect(unit.description).toBeUndefined();
    expect(unit.startDate).toEqual(new Date(2026, 4, 1));
    expect(unit.endDate).toBeUndefined();

    answer([
      {
        publicUuid: 'comp-1',
        code: 'C1',
        name: 'Competencia',
        displayOrder: 1,
        isActive: true,
        capacityCount: 0,
        origin: null,
        createdBy: undefined,
      },
      {
        publicUuid: 'comp-2',
        code: 'C2',
        name: 'Otra',
        displayOrder: 2,
        isActive: true,
        capacityCount: 1,
        origin: 'TEACHER',
        createdBy: 'user-1',
        sourceCatalogVersion: 'v1',
        sourceCatalogCode: 'S1',
        sourceLevelCode: 'L1',
        sourceCycleCodes: ['C1'],
        sourceContentStatus: 'ACTIVE',
      },
    ]);
    const competencies = await firstValueFrom(service.listCompetencies('course-1'));
    expect(competencies[0]).toEqual(
      jasmine.objectContaining({ origin: 'INSTITUTIONAL', createdBy: null }),
    );
    expect(competencies[1].sourceCatalogVersion).toBe('v1');
  });

  it('maps competency and capacity detail metadata for both catalog and legacy rows', async () => {
    answer({
      data: {
        publicUuid: 'comp-1',
        course: { publicUuid: 'course-1', code: 'MAT', name: 'Matemática' },
        code: 'C1',
        name: 'Competencia',
        description: null,
        displayOrder: 1,
        isActive: true,
        capacities: [
          { publicUuid: 'cap-1', code: 'CAP1', name: 'Capacidad', displayOrder: 1, isActive: true },
          {
            publicUuid: 'cap-2',
            code: 'CAP2',
            name: 'Otra capacidad',
            displayOrder: 2,
            isActive: true,
            sourceCatalogVersion: 'v2',
            sourceCatalogCode: 'C2',
            sourceContentStatus: 'ACTIVE',
          },
        ],
        origin: null,
        createdBy: null,
      },
    });
    const competency = await firstValueFrom(service.getCompetency('comp-1'));
    expect(competency.origin).toBe('INSTITUTIONAL');
    expect(competency.capacities[0].sourceCatalogVersion).toBeNull();
    expect(competency.capacities[1].sourceCatalogCode).toBe('C2');

    answer([
      {
        publicUuid: 'cap-3',
        competency: { publicUuid: 'comp-1', code: 'C1', name: 'Competencia' },
        code: 'CAP3',
        name: 'Capacidad nueva',
        description: null,
        displayOrder: 3,
        isActive: true,
        sourceCatalogVersion: undefined,
        sourceCatalogCode: undefined,
        sourceContentStatus: undefined,
      },
    ]);
    const capacity = await firstValueFrom(service.listCapacities('comp-1'));
    expect(capacity[0].sourceCatalogVersion).toBeNull();
    expect(capacity[0].description).toBeUndefined();
  });

  it('maps optional schedule fields and time slot dates', async () => {
    answer([
      {
        slotPublicUuid: 'slot-1',
        assignmentPublicUuid: 'assignment-1',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:00',
        course: { publicUuid: 'course-1' },
        period: { publicUuid: 'period-1' },
      },
      {
        slotPublicUuid: 'slot-2',
        assignmentPublicUuid: 'assignment-2',
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '10:00',
        classroom: 'Aula 2',
        teacher: { name: 'Ana' },
        course: { publicUuid: 'course-2' },
        section: { publicUuid: 'section-2' },
        period: { publicUuid: 'period-2' },
      },
    ]);
    const schedule = await firstValueFrom(service.getTeacherSchedule('teacher-1', 'period-1'));
    expect(schedule[0]).toEqual(
      jasmine.objectContaining({ classroom: undefined, teacher: undefined, section: undefined }),
    );
    expect(schedule[1].classroom).toBe('Aula 2');

    answer({
      data: {
        publicUuid: 'slot-3',
        assignmentPublicUuid: 'assignment-3',
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '11:00',
        classroom: null,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: 'bad-date',
      },
    });
    const timeSlot = await firstValueFrom(service.getTimeSlot('slot-3'));
    expect(timeSlot.classroom).toBeUndefined();
    expect(timeSlot.createdAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    expect(timeSlot.updatedAt).toBeUndefined();
  });
});
