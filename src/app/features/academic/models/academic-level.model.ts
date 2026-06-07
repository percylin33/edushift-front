// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-4.2)
// =============================================================================

/**
 * RAW backend {@code GradeResponse} record. Self-contained (incluye
 * {@code levelPublicUuid}) para que el FE no tenga que recordar el
 * level padre al pasar un grade entre componentes.
 */
export interface GradeResponseRaw {
  publicUuid: string;
  levelPublicUuid: string;
  name: string;
  ordinal: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * RAW backend {@code AcademicLevelResponse}. Incluye los grades
 * embebidos (sorted por {@code ordinal asc}) — un solo round-trip
 * carga el catálogo completo.
 */
export interface AcademicLevelResponseRaw {
  publicUuid: string;
  code: string;
  name: string;
  ordinal: number;
  grades: GradeResponseRaw[];
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** UI-side grade. Fechas parseadas, nullable a {@code undefined}. */
export interface Grade {
  publicUuid: string;
  levelPublicUuid: string;
  name: string;
  ordinal: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/** UI-side academic level con sus grades anidados. */
export interface AcademicLevel {
  publicUuid: string;
  code: string;
  name: string;
  ordinal: number;
  grades: Grade[];
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes — Levels
// =============================================================================

/**
 * Body de {@code POST /v1/academic/levels}.
 *
 * <h3>Validación BE</h3>
 * <ul>
 *   <li>{@code code}: 1..40, regex {@code ^[A-Za-z][A-Za-z0-9_]*$}.
 *       Normalizado a mayúsculas server-side.</li>
 *   <li>{@code name}: 1..100.</li>
 *   <li>{@code ordinal}: entero positivo (≥1).</li>
 * </ul>
 */
export interface CreateAcademicLevelRequest {
  code: string;
  name: string;
  ordinal: number;
}

/**
 * Body de {@code PUT /v1/academic/levels/{publicUuid}}.
 * Partial-merge: campos {@code undefined} = no change.
 */
export interface UpdateAcademicLevelRequest {
  code?: string;
  name?: string;
  ordinal?: number;
}

// =============================================================================
// Request shapes — Grades
// =============================================================================

/**
 * Body de {@code POST /v1/academic/levels/{levelUuid}/grades}.
 * El {@code levelUuid} viaja por la URL.
 */
export interface CreateGradeRequest {
  name: string;
  ordinal: number;
}

/**
 * Body de {@code PUT /v1/academic/levels/{levelUuid}/grades/{gradeUuid}}.
 * No hay campo para mover el grade entre levels (decisión backend).
 */
export interface UpdateGradeRequest {
  name?: string;
  ordinal?: number;
}

/**
 * Body de {@code PATCH /v1/academic/levels/{levelUuid}/grades/reorder}.
 *
 * <p>Cada item especifica el {@code publicUuid} del grade y su nuevo
 * {@code ordinal}. La lista debe cubrir todos los grades del level
 * (el backend valida cobertura y rechaza duplicados con
 * {@code GRADE_REORDER_INVALID}).</p>
 */
export interface GradeReorderRequest {
  items: Array<{
    publicUuid: string;
    ordinal: number;
  }>;
}
