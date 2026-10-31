/**
 * UI-side projections for `GET /v1/dashboard/teacher`
 * (Sprint 9B / FE-9B.1). Mirrors the backend
 * `TeacherDashboardResponse` 1:1 with timestamps narrowed from
 * ISO-8601 strings to {@link Date} so the template can format them
 * without ad-hoc parsing.
 *
 * The shape is intentionally a strict subset of
 * {@link AttendanceDashboardOverview} so the FE can share widgets
 * (top absent sections, recent closed sessions). The only teacher-
 * specific block is `mySectionsToday` — the "Mis secciones hoy"
 * list that gives the teacher a one-click path to "Open session".
 */

import { AttendanceSessionSlot } from '@features/attendance/models';
export type { AttendanceSessionSlot };

// =============================================================================
// Raw wire shapes (verbatim from the Spring records)
// =============================================================================

/**
 * One row of the "Mis secciones hoy" widget (Sprint 9B / BE-9B.1).
 * Mirrors the backend {@code MySessionItem} record.
 */
export interface TeacherMySessionRaw {
	/** Public UUID of the session, or null when no session has been
	 *  opened for this section/slot today. */
	sessionPublicUuid: string | null;
	sectionPublicUuid: string;
	sectionName: string;
	/** Nullable when the grade row was removed after section creation. */
	gradeName: string | null;
	/** ISO date `YYYY-MM-DD`. */
	occurredOn: string;
	slot: AttendanceSessionSlot;
	/** Session status (`PENDING` when no session exists yet, `ACTIVE`
	 *  when one is open and waiting for close, `CLOSED` once closed). */
	status: string;
	enrolledStudents: number;
	presentCount: number;
	absentCount: number;
	/** ISO instant. `null` for `PENDING` sessions (never closed). */
	closedAt: string | null;
}

export interface TeacherDashboardSnapshotRaw {
	/** ISO instant — the moment the snapshot was computed server-side. */
	generatedAt: string;
	attendanceRateToday: number;
	enrollmentsConsidered: number;
	openSessions: number;
	uniqueStudentsRegisteredToday: number;
	totalAbsencesToday: number;
	/** Subset of the admin widget, restricted to the teacher's
	 *  sections. */
	topAbsentSections: import('./attendance-overview.model').AttendanceTopSectionRaw[];
	/** Subset of the admin widget, restricted to the teacher's
	 *  sections. */
	recentClosedSessions: import('./attendance-overview.model').AttendanceRecentSessionRaw[];
	/** Teacher-specific: list of sections the teacher must attend to
	 *  today (PENDING = needs to open, ACTIVE = needs to close). */
	mySectionsToday: TeacherMySessionRaw[];
}

// =============================================================================
// UI-side shapes
// =============================================================================

export interface TeacherMySession {
	sessionPublicUuid: string | null;
	sectionPublicUuid: string;
	sectionName: string;
	gradeName?: string;
	occurredOn: Date;
	slot: AttendanceSessionSlot;
	/** 'PENDING' | 'ACTIVE' | 'CLOSED'. The template branches on this
	 *  to render the right CTA ("Abrir sesion" vs "Cerrar sesion"). */
	status: 'PENDING' | 'ACTIVE' | 'CLOSED';
	enrolledStudents: number;
	presentCount: number;
	absentCount: number;
	closedAt: Date | null;
}

export interface TeacherDashboardSnapshot {
	generatedAt: Date;
	attendanceRateToday: number;
	enrollmentsConsidered: number;
	openSessions: number;
	uniqueStudentsRegisteredToday: number;
	totalAbsencesToday: number;
	topAbsentSections: import('./attendance-overview.model').AttendanceTopSection[];
	recentClosedSessions: import('./attendance-overview.model').AttendanceRecentSession[];
	mySectionsToday: TeacherMySession[];
	/** Convenience flag — true when the teacher has zero active
	 *  assignments (e.g. substitute teacher mid-quarter). The FE
	 *  renders "Sin asignaciones activas" instead of the four KPIs. */
	noActiveAssignments: boolean;
}

// =============================================================================
// Adapters
// =============================================================================

/**
 * Translate the raw Spring record into the UI shape: parse timestamps
 * and detect the empty case. Top-absent + recent-closed are delegated
 * to the admin's {@link toDashboardOverview} adapter (DRY: same wire
 * shape, no teacher-specific projection needed).
 */
export function toTeacherDashboardSnapshot(
	raw: TeacherDashboardSnapshotRaw,
): TeacherDashboardSnapshot {
	return {
		generatedAt: new Date(raw.generatedAt),
		attendanceRateToday: raw.attendanceRateToday,
		enrollmentsConsidered: raw.enrollmentsConsidered,
		openSessions: raw.openSessions,
		uniqueStudentsRegisteredToday: raw.uniqueStudentsRegisteredToday,
		totalAbsencesToday: raw.totalAbsencesToday,
		topAbsentSections: raw.topAbsentSections.map(toTopSectionReuse),
		recentClosedSessions: raw.recentClosedSessions.map(toRecentSessionReuse),
		mySectionsToday: raw.mySectionsToday.map(toMySession),
		noActiveAssignments:
			raw.topAbsentSections.length === 0
				&& raw.recentClosedSessions.length === 0
				&& raw.mySectionsToday.length === 0
				&& raw.openSessions === 0,
	};
}

// Local thin re-exports to avoid a circular import via
// attendance-overview.model; the conversion logic is identical to
// the admin dashboard's.
import {
	toTopSection as toTopSectionReuse,
	toRecentSession as toRecentSessionReuse,
} from './attendance-overview.model';

function toMySession(raw: TeacherMySessionRaw): TeacherMySession {
	const status = (raw.status as TeacherMySession['status']);
	return {
		sessionPublicUuid: raw.sessionPublicUuid,
		sectionPublicUuid: raw.sectionPublicUuid,
		sectionName: raw.sectionName,
		gradeName: raw.gradeName ?? undefined,
		occurredOn: parseLocalDate(raw.occurredOn),
		slot: raw.slot,
		status: status ?? 'PENDING',
		enrolledStudents: raw.enrolledStudents,
		presentCount: raw.presentCount,
		absentCount: raw.absentCount,
		closedAt: raw.closedAt ? new Date(raw.closedAt) : null,
	};
}

function parseLocalDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}
