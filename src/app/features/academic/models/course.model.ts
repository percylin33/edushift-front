// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.4)
// =============================================================================

/**
 * RAW backend {@code CourseResponse.CourseLevelRef}. Proyección plana
 * de un level asociado a un course; el backend la incluye en
 * {@code CourseResponse.levels} y {@code CourseListItem.levels} para
 * que la tabla pinte los chips sin un segundo fetch.
 */
export interface CourseLevelRefRaw {
  publicUuid: string;
  code: string;
  name: string;
  ordinal: number;
}

/** RAW backend {@code CourseListItem}. Lean projection con chips de levels. */
export interface CourseListItemRaw {
  publicUuid: string;
  code: string;
  name: string;
  credits: number | null;
  hoursPerWeek: number | null;
  isActive: boolean;
  levels: CourseLevelRefRaw[];
}

/** RAW backend {@code CourseResponse}. Superset con audit + descripción. */
export interface CourseResponseRaw {
  publicUuid: string;
  code: string;
  name: string;
  description: string | null;
  credits: number | null;
  hoursPerWeek: number | null;
  isActive: boolean;
  levels: CourseLevelRefRaw[];
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** Reuso simbólico — la UI usa el mismo shape que el wire. */
export interface CourseLevelRef {
  publicUuid: string;
  code: string;
  name: string;
  ordinal: number;
}

/** UI-side row para la tabla. */
export interface CourseRow {
  publicUuid: string;
  code: string;
  name: string;
  credits?: number;
  hoursPerWeek?: number;
  isActive: boolean;
  levels: CourseLevelRef[];
}

/** UI-side detail — superset usado por el form modal. */
export interface CourseDetail extends CourseRow {
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/academic/courses}.
 *
 * <h3>Validación BE</h3>
 * <ul>
 *   <li>{@code code}: requerido, 1..30, regex
 *       {@code ^[A-Za-z][A-Za-z0-9_]*$}. La UI lo auto-uppercase.</li>
 *   <li>{@code name}: requerido, 1..200.</li>
 *   <li>{@code description}: opcional, max 4000.</li>
 *   <li>{@code credits} y {@code hoursPerWeek}: opcionales,
 *       {@code >= 0}.</li>
 *   <li>{@code isActive}: opcional, default {@code true}.</li>
 *   <li>{@code levelPublicUuids}: requerido, ≥ 1 elemento (invariant
 *       {@code COURSE_NEEDS_AT_LEAST_ONE_LEVEL}, 422).</li>
 * </ul>
 */
export interface CreateCourseRequest {
  code: string;
  name: string;
  description?: string;
  credits?: number;
  hoursPerWeek?: number;
  isActive?: boolean;
  levelPublicUuids: string[];
}

/**
 * Body de {@code PUT /v1/academic/courses/{publicUuid}}.
 *
 * <p>Partial-merge: campos {@code undefined} ⇒ no change. <strong>No
 * incluye levels</strong> — para cambiar la lista de niveles asociados
 * usa {@link UpdateCourseLevelsRequest} en
 * {@code POST /courses/{uuid}/levels} (replace semantics).</p>
 */
export interface UpdateCourseRequest {
  code?: string;
  name?: string;
  description?: string;
  credits?: number;
  hoursPerWeek?: number;
  isActive?: boolean;
}

/**
 * Body de {@code POST /v1/academic/courses/{publicUuid}/levels}.
 *
 * <p>Replace semantics: la lista <em>sobrescribe</em> el set actual.
 * El BE rechaza array vacío con 422
 * {@code COURSE_NEEDS_AT_LEAST_ONE_LEVEL}.</p>
 */
export interface UpdateCourseLevelsRequest {
  levelPublicUuids: string[];
}

/** Filtros para {@code GET /v1/academic/courses}. */
export interface CourseListFilters {
  /** Solo cursos asociados a este nivel (publicUuid). */
  levelPublicUuid?: string;
  /** Filtrar por flag de activación. */
  isActive?: boolean;
  /** Búsqueda client-side por {@code code} o {@code name} (BE no lo soporta). */
  search?: string;
}

// =============================================================================
// Validation helpers
// =============================================================================

/**
 * Regex client-side espejo del backend
 * ({@code CreateCourseRequest.code @Pattern}). El usuario lo verá
 * uppercaseado en la UI, pero la validación acepta ambos casos para
 * dar error de regex antes de tirar el submit y evitar el round-trip.
 */
export const COURSE_CODE_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Longitud máxima del code (espejo del Size BE). */
export const COURSE_CODE_MAX_LENGTH = 30;

/** Longitud máxima del name. */
export const COURSE_NAME_MAX_LENGTH = 200;

/** Longitud máxima de la descripción. */
export const COURSE_DESCRIPTION_MAX_LENGTH = 4000;
