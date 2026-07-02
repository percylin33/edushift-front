import {
  toDashboardOverview,
  AttendanceDashboardOverviewRaw,
  AttendanceDashboardOverview,
} from './attendance-overview.model';

describe('toDashboardOverview', () => {
  it('convierte raw a UI shape correctamente', () => {
    const raw: AttendanceDashboardOverviewRaw = {
      generatedAt: '2026-06-11T12:00:00Z',
      attendanceRateToday: 85.5,
      enrollmentsConsidered: 200,
      openSessions: 5,
      uniqueStudentsRegisteredToday: 180,
      totalAbsencesToday: 20,
      topAbsentSections: [
        {
          sectionPublicUuid: 's1',
          sectionName: '5A',
          gradeName: '5to',
          absentCount: 10,
          enrolledStudents: 30,
        },
      ],
      recentClosedSessions: [
        {
          sessionPublicUuid: 'ss1',
          sectionPublicUuid: 's1',
          sectionName: '5A',
          occurredOn: '2026-06-11',
          slot: 'MORNING',
          closedAt: '2026-06-11T11:00:00Z',
          presentCount: 25,
          lateCount: 3,
          absentCount: 2,
          excusedCount: 0,
          totalRecords: 30,
        },
      ],
    };

    const overview = toDashboardOverview(raw);
    expect(overview.generatedAt).toEqual(jasmine.any(Date));
    expect(overview.attendanceRateToday).toBe(85.5);
    expect(overview.noClassToday).toBeFalse();
    expect(overview.topAbsentSections.length).toBe(1);
    expect(overview.topAbsentSections[0].absentRatePct).toBeCloseTo(33.3, 1);
    expect(overview.recentClosedSessions.length).toBe(1);
    expect(overview.recentClosedSessions[0].slot).toBe('MORNING');
  });

  it('setea noClassToday cuando enrollments es 0', () => {
    const raw: AttendanceDashboardOverviewRaw = {
      generatedAt: '',
      attendanceRateToday: 0,
      enrollmentsConsidered: 0,
      openSessions: 0,
      uniqueStudentsRegisteredToday: 0,
      totalAbsencesToday: 0,
      topAbsentSections: [],
      recentClosedSessions: [],
    };
    const overview = toDashboardOverview(raw);
    expect(overview.noClassToday).toBeTrue();
  });
});
