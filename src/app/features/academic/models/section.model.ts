import { AcademicYearStatus } from './academic-year.model';

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.3)
// =============================================================================

/**
 * RAW backend {@code SectionListItem}. Lean projection con labels
 * desnormalizados ({@code academicYearName}, {@code gradeName},
 * {@code levelCode}) para que la tabla renderice sin un segundo fetch.
 */
export interface SectionListItemRaw {
  publicUuid: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  /** Status del año serializado como string ({@code PLANNING|ACTIVE|CLOSED}). */
  academicYearStatus: AcademicYearStatus;
  gradePublicUuid: string;
  gradeName: string;
  gradeOrdinal: number;
  levelPublicUuid: string;
  levelCode: string;
  name: string;
  capacity: number | null;
  displayOrder: number | null;
}

/**
 * RAW backend {@code SectionResponse}. Superset de
 * {@link SectionListItemRaw} con audit timestamps + {@code levelName}.
 */
export interface SectionResponseRaw {
  publicUuid: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  academicYearStatus: AcademicYearStatus;
  gradePublicUuid: string;
  gradeName: string;
  gradeOrdinal: number;
  levelPublicUuid: string;
  levelCode: string;
  levelName: string;
  name: string;
  capacity: number | null;
  displayOrder: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** UI-side row consumido por la tabla. */
export interface SectionRow {
  publicUuid: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  academicYearStatus: AcademicYearStatus;
  gradePublicUuid: string;
  gradeName: string;
  gradeOrdinal: number;
  levelPublicUuid: string;
  levelCode: string;
  name: string;
  capacity?: number;
  displayOrder?: number;
}

/** UI-side detail (superset de {@link SectionRow}). */
export interface SectionDetail extends SectionRow {
  levelName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/academic/sections}.
 *
 * <h3>Validación BE</h3>
 * <ul>
 *   <li>{@code academicYearPublicUuid} y {@code gradePublicUuid} requeridos.</li>
 *   <li>{@code name}: 1..40 caracteres, único en {@code (year, grade)}.</li>
 *   <li>{@code capacity} y {@code displayOrder}: enteros positivos opcionales.</li>
 * </ul>
 */
export interface CreateSectionRequest {
  academicYearPublicUuid: string;
  gradePublicUuid: string;
  name: string;
  capacity?: number;
  displayOrder?: number;
}

/**
 * Body de {@code PUT /v1/academic/sections/{publicUuid}}.
 *
 * <p>Partial-merge: campos {@code undefined} ⇒ no change. Para mover
 * la sección a otro {@code (year, grade)} hay que borrarla y re-crearla
 * (decisión BE — los moves cross-tuple disrumpen las matrículas).</p>
 *
 * <p><strong>Nota sobre {@code capacity}</strong>: el backend rechaza
 * {@code capacity = 0} con validación. Para "limpiar" capacity hay que
 * omitirlo del payload (no enviar {@code null}). DEBT-API-1.</p>
 */
export interface UpdateSectionRequest {
  name?: string;
  capacity?: number;
  displayOrder?: number;
}

/**
 * Filtros para {@code GET /v1/academic/sections}.
 *
 * <p>Si {@code academicYearPublicUuid} se omite el backend usa el año
 * {@code ACTIVE} por default. Si se pasan {@code gradeId} y
 * {@code levelId} a la vez, {@code gradeId} gana (scope más estricto)
 * — lo replicamos en la UI escondiendo el filtro de level cuando hay
 * grade seleccionado.</p>
 */
export interface SectionListFilters {
  academicYearPublicUuid?: string;
  gradePublicUuid?: string;
  levelPublicUuid?: string;
  /** Búsqueda client-side por {@code name} (el backend no la soporta nativa). */
  search?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Indica si la sección admite mutaciones según el status de su año.
 * El backend rechaza con 409 {@code ACADEMIC_YEAR_LOCKED} si el año
 * está {@code CLOSED}, así que la UI lo refleja proactivamente.
 */
export function isSectionMutable(status: AcademicYearStatus): boolean {
  return status !== AcademicYearStatus.Closed;
}
