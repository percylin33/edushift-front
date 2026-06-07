import { StudentEnrollmentStatus } from '@core/enums';

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.8)
// =============================================================================

/**
 * RAW backend {@code EnrollmentListItem} record devuelto por
 * {@code GET /v1/students/{uuid}/enrollments}.
 *
 * <p>Lean projection para el historial: omite audit timestamps +
 * notes. La row representa la matrícula completa (ACTIVE o
 * terminal).</p>
 */
export interface EnrollmentListItemRaw {
  publicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  sectionPublicUuid: string;
  sectionName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  /** {@code LocalDate} ISO (yyyy-MM-dd). */
  enrolledAt: string | null;
  /** {@code LocalDate} ISO; {@code null} cuando la row está activa. */
  withdrawnAt: string | null;
  status: StudentEnrollmentStatus;
  /** Derivado server-side de {@code status === ACTIVE}. */
  active: boolean;
}

/**
 * RAW backend {@code EnrollmentResponse}. Devuelto por POST de
 * creación y POST de withdraw. Superset de
 * {@link EnrollmentListItemRaw} con {@code studentDocumentNumber},
 * {@code notes} y audit timestamps.
 */
export interface EnrollmentResponseRaw {
  publicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  studentDocumentNumber: string;
  sectionPublicUuid: string;
  sectionName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  enrolledAt: string | null;
  withdrawnAt: string | null;
  status: StudentEnrollmentStatus;
  active: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * RAW backend {@code SectionStudentRosterItem} — projection del
 * roster activo {@code GET /v1/academic/sections/{uuid}/students}.
 *
 * <p>Sólo incluye matrículas {@code ACTIVE} (transferred / graduated
 * forman parte del historial del estudiante, no del roster vivo).</p>
 */
export interface SectionStudentRosterItemRaw {
  enrollmentPublicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  studentDocumentNumber: string;
  studentDocumentType: string;
  studentEmail: string | null;
  enrolledAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** UI-side row para la tabla de historial del student-detail. */
export interface EnrollmentRow {
  publicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  sectionPublicUuid: string;
  sectionName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  enrolledAt?: Date;
  withdrawnAt?: Date;
  status: StudentEnrollmentStatus;
  active: boolean;
}

/** UI-side detail con notes y timestamps de audit. */
export interface EnrollmentDetail extends EnrollmentRow {
  studentDocumentNumber: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** UI-side row del roster por sección (tab Roster en section-detail). */
export interface SectionStudentRosterItem {
  enrollmentPublicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  studentDocumentNumber: string;
  studentDocumentType: string;
  studentEmail?: string;
  enrolledAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/students/{studentUuid}/enrollments}. El
 * back valida en orden:
 * <ol>
 *   <li>{@code section.year == academicYearPublicUuid} (409
 *       {@code ENROLLMENT_YEAR_MISMATCH}).</li>
 *   <li>{@code enrolledAt} ∈ [year.startDate, year.endDate] (409
 *       {@code ENROLLMENT_DATE_OUT_OF_YEAR}).</li>
 *   <li>No hay otra ACTIVE para el mismo
 *       {@code (student, academicYear)} (409
 *       {@code STUDENT_ALREADY_ENROLLED}).</li>
 * </ol>
 */
export interface CreateEnrollmentRequest {
  sectionPublicUuid: string;
  academicYearPublicUuid: string;
  /** ISO {@code yyyy-MM-dd}. */
  enrolledAt: string;
  /** Free-form, max 1000 chars. */
  notes?: string;
}

/**
 * Body de {@code POST /v1/enrollments/{publicUuid}/withdraw}. El
 * {@code status} debe ser un valor terminal
 * ({@link StudentEnrollmentStatus#Withdrawn},
 * {@link StudentEnrollmentStatus#Transferred} o
 * {@link StudentEnrollmentStatus#Graduated}). {@code ACTIVE} es 400
 * {@code INVALID_WITHDRAW_STATUS}.
 */
export interface WithdrawEnrollmentRequest {
  status: StudentEnrollmentStatus;
  /** ISO {@code yyyy-MM-dd}. {@code >= enrolledAt}. */
  withdrawnAt: string;
}
