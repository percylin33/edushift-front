/**
 * Mirror of the backend `AttendanceStudentLookupItem` DTO
 * (Sprint 6 / BE-6.8 — manual fallback picker).
 *
 * <p>Lean projection returned by
 * {@code GET /v1/attendance/students/lookup}. The shape intentionally
 * omits PII (no email, no birthDate, no address) since the auxiliary
 * only needs enough to disambiguate the kid in front of them.
 */
export interface AttendanceStudentLookupItem {
  studentPublicUuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  documentNumber: string;
  sectionPublicUuid: string;
  sectionName: string;
  gradeName: string;
  levelName: string;
}

/** Query params for `GET /v1/attendance/students/lookup`. */
export interface StudentLookupFilters {
  q?: string;
  levelPublicUuid?: string;
  gradePublicUuid?: string;
  sectionPublicUuid?: string;
}

/**
 * Spring Data `Page<T>` wire shape — minimal projection used by this
 * endpoint only. Kept inline to avoid coupling the attendance module
 * to other features' page envelopes (which sometimes embed extra
 * metadata).
 */
export interface AttendanceStudentLookupPage {
  content: AttendanceStudentLookupItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
