// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-5A.1)
// =============================================================================

/**
 * RAW backend {@code UnitListItem}. Lean projection devuelta por
 * {@code GET /v1/academic/courses/&#123;courseUuid&#125;/units}. Trae
 * sólo lo necesario para pintar la fila draggable + el chip de
 * "N sesiones" (BE-5A.4 ya activó {@code sessionCount}).
 */
export interface UnitListItemRaw {
  publicUuid: string;
  name: string;
  displayOrder: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sessionCount: number;
}

/**
 * RAW backend {@code UnitResponse.CourseRef}. Embebido en el detail
 * para que el form / breadcrumb no requiera un segundo fetch.
 */
export interface UnitCourseRefRaw {
  publicUuid: string;
  code: string;
  name: string;
}

/**
 * RAW backend {@code UnitResponse}. Superset de
 * {@link UnitListItemRaw} con {@code description}, {@code course} y
 * timestamps de auditoría. Devuelta por POST/GET-by-id/PUT y dentro
 * de {@code reorder} (que retorna la lista completa post-commit).
 */
export interface UnitResponseRaw {
  publicUuid: string;
  course: UnitCourseRefRaw;
  name: string;
  description: string | null;
  displayOrder: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sessionCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

/** Reuso simbólico — la UI usa el mismo shape que el wire. */
export interface UnitCourseRef {
  publicUuid: string;
  code: string;
  name: string;
}

/**
 * UI-side row para la lista draggable. Reflejo de {@link UnitListItemRaw}
 * con fechas convertidas a {@link Date} y nullables como
 * {@code undefined} (igual convención que el resto del módulo academic).
 */
export interface UnitRow {
  publicUuid: string;
  name: string;
  displayOrder: number;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  sessionCount: number;
}

/**
 * UI-side detail — superset usado por el form modal (carga descripción
 * + audit que el list item no incluye).
 */
export interface UnitDetail extends UnitRow {
  course: UnitCourseRef;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/academic/courses/&#123;courseUuid&#125;/units}.
 *
 * <h3>Validación BE</h3>
 * <ul>
 *   <li>{@code name}: requerido, 1..200, único por curso (case-insensitive).
 *       Conflicto → 409 {@code UNIT_NAME_EXISTS}.</li>
 *   <li>{@code description}: opcional, max 4000.</li>
 *   <li>{@code displayOrder}: opcional, ≥ 1. Si se omite, el BE
 *       appendea al final ({@code max(displayOrder) + 1}).</li>
 *   <li>{@code startDate}/{@code endDate}: opcionales; si ambas
 *       presentes, {@code endDate >= startDate}
 *       ({@code UNIT_DATE_INVERTED}, 400).</li>
 *   <li>{@code isActive}: opcional, default {@code true}.</li>
 * </ul>
 */
export interface CreateUnitRequest {
  name: string;
  description?: string;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

/**
 * Body de {@code PUT /v1/academic/units/&#123;publicUuid&#125;}.
 *
 * <p>Partial-merge: campos {@code undefined} ⇒ no change. <strong>No
 * incluye displayOrder</strong> — el reorder usa endpoint dedicado
 * para evitar colisiones en el unique parcial
 * {@code uk_academic_units_course_order_active}.</p>
 */
export interface UpdateUnitRequest {
  name?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

/**
 * Item del payload de {@code PATCH .../units/reorder}. Refleja el
 * record interno {@code UnitReorderRequest.Item} del BE.
 */
export interface UnitReorderItem {
  publicUuid: string;
  displayOrder: number;
}

/**
 * Body de {@code PATCH /v1/academic/courses/&#123;courseUuid&#125;/units/reorder}.
 *
 * <p>Espeja {@link UnitReorderRequest} del BE. La lista debe ser no
 * vacía. El backend aplica una estrategia two-pass (igual que
 * {@code GradeReorderRequest}, BE-4.2) para no romper el unique
 * parcial.</p>
 *
 * <h3>Errores conocidos</h3>
 * <ul>
 *   <li>409 {@code UNIT_OUT_OF_COURSE} — algún UUID no pertenece al
 *       curso.</li>
 *   <li>409 {@code UNIT_REORDER_INVALID} — ordinales o UUIDs
 *       duplicados en el payload.</li>
 *   <li>409 {@code UNIT_ORDER_TAKEN} — colisión en el flush final
 *       (concurrencia).</li>
 * </ul>
 */
export interface UnitReorderRequest {
  items: UnitReorderItem[];
}

// =============================================================================
// Validation helpers
// =============================================================================

/** Longitud máxima del nombre (espejo del {@code @Size} BE). */
export const UNIT_NAME_MAX_LENGTH = 200;

/** Longitud máxima de la descripción. */
export const UNIT_DESCRIPTION_MAX_LENGTH = 4000;
