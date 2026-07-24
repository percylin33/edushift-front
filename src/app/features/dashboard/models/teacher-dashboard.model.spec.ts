import { toTeacherDashboardSnapshot } from './teacher-dashboard.model';

describe('toTeacherDashboardSnapshot (Sprint 9B / FE-9B.1)', () => {
	it('parsea raw → ui con timestamps Date', () => {
		const raw = {
			generatedAt: '2026-07-23T15:00:00Z',
			attendanceRateToday: 85,
			enrollmentsConsidered: 200,
			openSessions: 5,
			uniqueStudentsRegisteredToday: 150,
			totalAbsencesToday: 25,
			topAbsentSections: [],
			recentClosedSessions: [],
			mySectionsToday: [
				{
					sessionPublicUuid: null,
					sectionPublicUuid: 's-1',
					sectionName: '5to A',
					occurredOn: '2026-07-23',
					slot: 'MORNING',
					status: 'PENDING',
					enrolledStudents: 30,
					presentCount: 0,
					absentCount: 0,
					closedAt: null,
				},
			],
		};
		const snap = toTeacherDashboardSnapshot(raw as any);
		expect(snap.generatedAt).toBeInstanceOf(Date);
		expect(snap.attendanceRateToday).toBe(85);
		expect(snap.mySectionsToday.length).toBe(1);
		expect(snap.mySectionsToday[0].occurredOn).toBeInstanceOf(Date);
		expect(snap.mySectionsToday[0].status).toBe('PENDING');
		expect(snap.noActiveAssignments).toBeFalse();
	});

	it('detecta substitute teacher (sin asignaciones activas)', () => {
		const raw = {
			generatedAt: '2026-07-23T15:00:00Z',
			attendanceRateToday: 0,
			enrollmentsConsidered: 0,
			openSessions: 0,
			uniqueStudentsRegisteredToday: 0,
			totalAbsencesToday: 0,
			topAbsentSections: [],
			recentClosedSessions: [],
			mySectionsToday: [],
		};
		const snap = toTeacherDashboardSnapshot(raw as any);
		expect(snap.noActiveAssignments).toBeTrue();
	});

	it('parsea closedAt null para sesiones PENDING', () => {
		const raw = {
			generatedAt: '2026-07-23T15:00:00Z',
			attendanceRateToday: 50,
			enrollmentsConsidered: 10,
			openSessions: 1,
			uniqueStudentsRegisteredToday: 5,
			totalAbsencesToday: 2,
			topAbsentSections: [],
			recentClosedSessions: [],
			mySectionsToday: [
				{
					sessionPublicUuid: 'ses-1',
					sectionPublicUuid: 's-2',
					sectionName: '4to B',
					occurredOn: '2026-07-23',
					slot: 'AFTERNOON',
					status: 'ACTIVE',
					enrolledStudents: 10,
					presentCount: 8,
					absentCount: 2,
					closedAt: null,
				},
			],
		};
		const snap = toTeacherDashboardSnapshot(raw as any);
		expect(snap.mySectionsToday[0].closedAt).toBeNull();
		expect(snap.mySectionsToday[0].status).toBe('ACTIVE');
		expect(snap.noActiveAssignments).toBeFalse();
	});
});
