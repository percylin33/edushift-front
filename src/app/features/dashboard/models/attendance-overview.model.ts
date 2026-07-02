/**
 * UI-side projections for `GET /v1/attendance/dashboard/overview`
 * (Sprint 6 / FE-6.4). Mirrors the backend
 * `DashboardOverviewResponse` 1:1 with timestamps narrowed from
 * ISO-8601 strings to {@link Date} so the template can format them
 * without ad-hoc parsing.
 *
 * The raw shapes match the backend records verbatim and live in this
 * file so consumers in the dashboard feature don't have to reach into
 * the attendance feature for a one-off DTO.
 */

import { AttendanceSessionSlot } from '@features/attendance/models';

export type { AttendanceSessionSlot };

// =============================================================================
// Raw wire shapes (verbatim from the Spring records)
// =============================================================================

export interface AttendanceTopSectionRaw {
  sectionPublicUuid: string;
  sectionName: string;
  /** Nullable on the wire — the backend tolerates a deleted Grade row. */
  gradeName: string | null;
  absentCount: number;
  enrolledStudents: number;
}

export interface AttendanceRecentSessionRaw {
  sessionPublicUuid: string;
  sectionPublicUuid: string;
  sectionName: string;
  /** ISO date `YYYY-MM-DD`. */
  occurredOn: string;
  slot: AttendanceSessionSlot;
  /** ISO instant. */
  closedAt: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalRecords: number;
}

export interface AttendanceDashboardOverviewRaw {
  /** ISO instant — the moment the snapshot was computed server-side. */
  generatedAt: string;
  /** Percentage in `[0.00, 100.00]`. `0.00` when no class today. */
  attendanceRateToday: number;
  /**
   * Denominator of {@link attendanceRateToday}. `0` means "no class
   * today" — the FE renders "—%" instead of `0%` to disambiguate.
   */
  enrollmentsConsidered: number;
  openSessions: number;
  uniqueStudentsRegisteredToday: number;
  totalAbsencesToday: number;
  topAbsentSections: AttendanceTopSectionRaw[];
  recentClosedSessions: AttendanceRecentSessionRaw[];
}

// =============================================================================
// UI-side shapes
// =============================================================================

export interface AttendanceTopSection {
  sectionPublicUuid: string;
  sectionName: string;
  gradeName?: string;
  absentCount: number;
  enrolledStudents: number;
  /**
   * `absentCount / enrolledStudents` as a percentage, rounded to one
   * decimal. `0` when the section has no enrolled students (defensive
   * — should not happen but the materialised view doesn't enforce it).
   */
  absentRatePct: number;
}

export interface AttendanceRecentSession {
  sessionPublicUuid: string;
  sectionPublicUuid: string;
  sectionName: string;
  occurredOn: Date;
  slot: AttendanceSessionSlot;
  closedAt: Date;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalRecords: number;
}

export interface AttendanceDashboardOverview {
  generatedAt: Date;
  attendanceRateToday: number;
  enrollmentsConsidered: number;
  openSessions: number;
  uniqueStudentsRegisteredToday: number;
  totalAbsencesToday: number;
  topAbsentSections: AttendanceTopSection[];
  recentClosedSessions: AttendanceRecentSession[];
  /** Convenience flag — true when the tenant has no class on `today`. */
  noClassToday: boolean;
}

// =============================================================================
// Adapters
// =============================================================================

/**
 * Translate the raw Spring record into the UI shape: parse timestamps,
 * surface nullable strings as `undefined`, and pre-compute the
 * absent rate per section.
 */
export function toDashboardOverview(
  raw: AttendanceDashboardOverviewRaw,
): AttendanceDashboardOverview {
  return {
    generatedAt: new Date(raw.generatedAt),
    attendanceRateToday: raw.attendanceRateToday,
    enrollmentsConsidered: raw.enrollmentsConsidered,
    openSessions: raw.openSessions,
    uniqueStudentsRegisteredToday: raw.uniqueStudentsRegisteredToday,
    totalAbsencesToday: raw.totalAbsencesToday,
    topAbsentSections: raw.topAbsentSections.map(toTopSection),
    recentClosedSessions: raw.recentClosedSessions.map(toRecentSession),
    noClassToday: raw.enrollmentsConsidered === 0,
  };
}

function toTopSection(raw: AttendanceTopSectionRaw): AttendanceTopSection {
  const rate =
    raw.enrolledStudents > 0 ? Math.round((raw.absentCount / raw.enrolledStudents) * 1000) / 10 : 0;
  return {
    sectionPublicUuid: raw.sectionPublicUuid,
    sectionName: raw.sectionName,
    gradeName: raw.gradeName ?? undefined,
    absentCount: raw.absentCount,
    enrolledStudents: raw.enrolledStudents,
    absentRatePct: rate,
  };
}

function toRecentSession(raw: AttendanceRecentSessionRaw): AttendanceRecentSession {
  return {
    sessionPublicUuid: raw.sessionPublicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    sectionName: raw.sectionName,
    occurredOn: parseLocalDate(raw.occurredOn),
    slot: raw.slot,
    closedAt: new Date(raw.closedAt),
    presentCount: raw.presentCount,
    lateCount: raw.lateCount,
    absentCount: raw.absentCount,
    excusedCount: raw.excusedCount,
    totalRecords: raw.totalRecords,
  };
}

/**
 * Parse a `YYYY-MM-DD` from the wire as a local-midnight {@link Date}.
 * `new Date("2026-06-11")` would return UTC-midnight which displays
 * as "2026-06-10" in negative-offset timezones — using the explicit
 * Y/M/D constructor avoids that off-by-one in the Lima/Bogotá pilot.
 */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
