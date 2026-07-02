import { BulkImportStatus, DocumentType, EnrollmentStatus, Gender } from '@core/enums';

// =============================================================================
// Raw wire shapes — mirror the backend records 1:1
// =============================================================================

/**
 * RAW backend {@code StudentListItem} record returned by
 * {@code GET /v1/students}.
 *
 * <p>Lean projection used by the list table — drops the heavier fields
 * (metadata, address, secondLastName, audit timestamps). The
 * {@link StudentResponseRaw} detail shape carries everything for the
 * detail / edit page.
 */
export interface StudentListItemRaw {
  publicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  enrollmentStatus: EnrollmentStatus;
  enrollmentDate: string | null;
}

/**
 * RAW backend {@code StudentResponse} record returned by detail and
 * mutation endpoints. Superset of {@link StudentListItemRaw}: adds the
 * full demographic profile, address, metadata bag, audit timestamps and
 * the optional {@code userId} link to the {@code users} aggregate.
 */
export interface StudentResponseRaw {
  publicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  fullName: string;
  birthDate: string | null;
  gender: Gender | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  enrollmentStatus: EnrollmentStatus;
  enrollmentDate: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI models — what components consume
// =============================================================================

/**
 * UI-side row shape used by the list table and store. Same fields as
 * {@link StudentListItemRaw} but with timestamps already parsed and
 * nullable-string fields surfaced as {@code undefined} (idiomatic in
 * the rest of the codebase).
 */
export interface StudentRow {
  publicUuid: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  enrollmentStatus: EnrollmentStatus;
  enrollmentDate?: Date;
}

/**
 * UI-side detail shape (superset of {@link StudentRow}) used by the
 * detail page and the edit form. {@code metadata} stays as the raw
 * JSON bag — components that care can narrow it themselves; the form
 * leaves it untouched on edit so admins don't accidentally drop
 * fields they didn't author.
 */
export interface StudentDetail extends StudentRow {
  secondLastName?: string;
  birthDate?: Date;
  gender?: Gender;
  phone?: string;
  address?: string;
  /** Public UUID of the linked user account, when the student has one. */
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Filter set sent to {@code GET /v1/students}. Every field is optional;
 * blanks / undefined are dropped before serialization so the URL stays
 * clean for caching and for the network panel.
 *
 * <p>{@code gradeLevelId} is forward-compat — the backend accepts but
 * ignores it until Sprint 4 wires up the academic catalog. Surfacing
 * it now means the UI doesn't need a follow-up wave once it lands.
 */
export interface StudentListFilters {
  search?: string;
  enrollmentStatus?: EnrollmentStatus;
  gradeLevelId?: string;
  /**
   * Filtra por la sección activa del student (FE-4.7 / BE-4.8).
   * El back acepta un solo UUID; la UI usa un dropdown con las
   * secciones del año activo.
   */
  currentSectionId?: string;
  /**
   * Acota por año académico de la enrollment ACTIVE. Usado en
   * combinación con {@link #currentSectionId} para descartar
   * matrículas pasadas que comparten el mismo public_uuid de
   * sección por re-creación. La UI lo deja implícito (= año
   * activo) en la mayoría de los flows.
   */
  currentAcademicYearId?: string;
}

/**
 * Pagination + sort hint. {@code page} is zero-based to match Spring's
 * {@code Pageable}; {@code sort} uses the Spring shorthand
 * ({@code "field,DIR"}).
 */
export interface StudentListPagination {
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Body of {@code POST /v1/students}. Mirrors the backend
 * {@code CreateStudentRequest} record verbatim.
 *
 * <h3>Field rules</h3>
 * <ul>
 *   <li>{@code documentType} + {@code documentNumber} are <strong>required</strong>
 *       and form the natural identity (uniqueness key per tenant).</li>
 *   <li>{@code firstName} / {@code lastName} required (1..100).</li>
 *   <li>Everything else optional — the entity assumes safe defaults
 *       ({@code enrollmentStatus = PENDING}, etc.).</li>
 * </ul>
 */
export interface CreateStudentRequest {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  address?: string;
  enrollmentStatus?: EnrollmentStatus;
  enrollmentDate?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Patch payload for {@code PUT /v1/students/{publicUuid}}.
 *
 * <p><strong>null = clear</strong> on nullable fields ({@code email},
 * {@code phone}, {@code address}, {@code secondLastName}); we forward
 * {@code undefined} as <em>omitted</em> property (JSON serialization
 * drops the key) to express "no change" — same convention used in
 * {@code UpdateUserRequest}.
 */
export interface UpdateStudentRequest {
  documentType?: DocumentType;
  documentNumber?: string;
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  birthDate?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  address?: string;
  enrollmentStatus?: EnrollmentStatus;
  enrollmentDate?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Bulk-import wire shapes
// =============================================================================

/** Per-row failure produced by the bulk-import worker. */
export interface BulkImportRowErrorRaw {
  /** 1-based row index in the workbook (header row = 1, first data row = 2). */
  row: number;
  /** Stable error code (e.g. {@code STUDENT_DOCUMENT_TAKEN}). */
  code: string;
  /** Human-readable message — already localized server-side. */
  message: string;
}

/**
 * RAW backend {@code BulkImportJobResponse} record. Returned by the
 * upload endpoint (status = {@code PENDING}) and by the polling
 * endpoint as the worker advances.
 */
export interface BulkImportJobResponseRaw {
  publicUuid: string;
  jobType: 'STUDENTS';
  status: BulkImportStatus;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number | null;
  processedRows: number;
  errorRows: number;
  errors: BulkImportRowErrorRaw[] | null;
  failReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
}

/** UI-side bulk-import job (superset of the raw shape with parsed dates). */
export interface BulkImportJob {
  publicUuid: string;
  jobType: 'STUDENTS';
  status: BulkImportStatus;
  fileName: string;
  fileSizeBytes: number;
  totalRows?: number;
  processedRows: number;
  errorRows: number;
  errors: BulkImportRowError[];
  failReason?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt?: Date;
}

export interface BulkImportRowError {
  row: number;
  code: string;
  message: string;
}
