import { PeriodType } from '@features/academic/models';

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.7)
// =============================================================================

/**
 * RAW backend {@code AssignmentListItem} record devuelto por
 * {@code GET /v1/teachers/{uuid}/assignments}.
 *
 * <p>Proyección lean: omite los timestamps de audit + {@code notes}
 * + el {@code courseName} (queda solo el {@code courseCode} para la
 * tabla). El detalle se trae con {@link AssignmentResponseRaw}.</p>
 */
export interface AssignmentListItemRaw {
  publicUuid: string;
  teacherPublicUuid: string;
  teacherFullName: string;
  sectionPublicUuid: string;
  sectionName: string;
  coursePublicUuid: string;
  courseCode: string;
  courseName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  /** ISO instant. */
  assignedAt: string | null;
  /** ISO instant; {@code null} cuando la assignment está activa. */
  unassignedAt: string | null;
  active: boolean;
}

/**
 * RAW backend {@code AssignmentResponse}. Devuelto por el POST de
 * creación. Superset de {@link AssignmentListItemRaw} con
 * {@code academicYear*}, {@code periodName}, {@code notes} y audit
 * timestamps.
 */
export interface AssignmentResponseRaw {
  publicUuid: string;
  teacherPublicUuid: string;
  teacherFullName: string;
  sectionPublicUuid: string;
  sectionName: string;
  coursePublicUuid: string;
  courseCode: string;
  courseName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  periodName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  assignedAt: string | null;
  unassignedAt: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * RAW backend {@code SectionTeacherItem} — projection de la reverse-view
 * {@code GET /v1/academic/sections/{uuid}/teachers}. Una row por
 * {@code (teacher, course, period)} activo.
 */
export interface SectionTeacherItemRaw {
  assignmentPublicUuid: string;
  teacherPublicUuid: string;
  teacherFullName: string;
  teacherEmail: string | null;
  coursePublicUuid: string;
  courseCode: string;
  courseName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  assignedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** UI-side row para la tabla del tab Asignaciones del teacher-detail. */
export interface AssignmentRow {
  publicUuid: string;
  teacherPublicUuid: string;
  teacherFullName: string;
  sectionPublicUuid: string;
  sectionName: string;
  coursePublicUuid: string;
  courseCode: string;
  courseName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  assignedAt?: Date;
  unassignedAt?: Date;
  active: boolean;
}

/** UI-side detail (superset). */
export interface AssignmentDetail extends AssignmentRow {
  periodName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** UI-side row del reverse-view por sección (tab Docentes en section-detail). */
export interface SectionTeacherItem {
  assignmentPublicUuid: string;
  teacherPublicUuid: string;
  teacherFullName: string;
  teacherEmail?: string;
  coursePublicUuid: string;
  courseCode: string;
  courseName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  assignedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/teachers/{teacherUuid}/assignments}.
 *
 * <p>El {@code teacher} viene en path; los tres UUIDs anclan la
 * assignment a una tupla {@code (section, course, period)}. El back
 * valida en orden:</p>
 * <ol>
 *   <li>Teacher con {@code employmentStatus = ACTIVE} (409
 *       {@code TEACHER_NOT_ACTIVE} caso contrario).</li>
 *   <li>{@code section.year == period.year} (409
 *       {@code ASSIGNMENT_YEAR_MISMATCH}).</li>
 *   <li>Course aplicable al level del grade de la sección (409
 *       {@code COURSE_NOT_APPLICABLE_TO_SECTION_LEVEL}).</li>
 *   <li>No hay otra row activa para esta tupla (409
 *       {@code ASSIGNMENT_ALREADY_ACTIVE}).</li>
 * </ol>
 */
export interface CreateAssignmentRequest {
  sectionPublicUuid: string;
  coursePublicUuid: string;
  academicPeriodPublicUuid: string;
  /** Free-form, max 1000 chars. */
  notes?: string;
}

/** Filtros del {@code GET /teachers/{uuid}/assignments?periodId=&active=true|false}. */
export interface AssignmentListFilters {
  /** Filter por publicUuid del periodo. */
  periodId?: string;
  /**
   * Cuando {@code true} (default del back), excluye las soft-ended.
   * Cuando {@code false}, incluye historial completo.
   */
  active?: boolean;
}

/**
 * Filtro de la reverse-view
 * {@code GET /sections/{uuid}/teachers?periodId=…}.
 */
export interface SectionTeachersFilters {
  periodId?: string;
}
