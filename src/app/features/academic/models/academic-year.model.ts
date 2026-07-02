/**
 * Lifecycle de un AcademicYear. Espejo del enum backend en
 * {@code com.edushift.modules.academic.year.entity.AcademicYearStatus}.
 *
 * Transiciones permitidas (Sprint 4 / BE-4.1):
 * <ul>
 *   <li>{@code PLANNING} → {@code ACTIVE}: via {@code POST /activate}.
 *       Si otro año estaba {@code ACTIVE}, se cierra automáticamente
 *       en la misma transacción.</li>
 *   <li>{@code ACTIVE} → {@code CLOSED}: efecto colateral de activar
 *       otro año (no hay endpoint dedicado de close).</li>
 *   <li>{@code CLOSED} es terminal (ADR-04.4): no se reabre, no acepta
 *       updates ni se puede re-activar.</li>
 * </ul>
 */
export enum AcademicYearStatus {
  Planning = 'PLANNING',
  Active = 'ACTIVE',
  Closed = 'CLOSED',
}

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend
// =============================================================================

/**
 * RAW backend {@code AcademicYearListItem} record returned by
 * {@code GET /v1/academic/years}. Lean projection sin audit timestamps.
 */
export interface AcademicYearListItemRaw {
  publicUuid: string;
  name: string;
  status: AcademicYearStatus;
  startDate: string;
  endDate: string;
}

/**
 * RAW backend {@code AcademicYearResponse} record. Superset del list
 * item: incluye audit timestamps que la pantalla de detalle muestra.
 */
export interface AcademicYearResponseRaw {
  publicUuid: string;
  name: string;
  status: AcademicYearStatus;
  startDate: string;
  endDate: string;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI models
// =============================================================================

/** UI-side row shape consumed por la tabla de años. */
export interface AcademicYearRow {
  publicUuid: string;
  name: string;
  status: AcademicYearStatus;
  startDate: Date;
  endDate: Date;
}

/** UI-side detail shape (superset de {@link AcademicYearRow}). */
export interface AcademicYearDetail extends AcademicYearRow {
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de {@code POST /v1/academic/years}. El backend siempre lo crea
 * con {@code status = PLANNING}.
 */
export interface CreateAcademicYearRequest {
  name: string;
  /** ISO date {@code YYYY-MM-DD}. */
  startDate: string;
  /** ISO date {@code YYYY-MM-DD}. {@code startDate < endDate} obligatorio. */
  endDate: string;
}

/**
 * Body de {@code PUT /v1/academic/years/{publicUuid}}.
 *
 * <p>Partial-merge: campos {@code undefined} = no change. El backend
 * rechaza con 409 {@code ACADEMIC_YEAR_LOCKED} si el año está
 * {@code CLOSED}.</p>
 */
export interface UpdateAcademicYearRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
}

/** Filtro opcional para {@code GET /v1/academic/years?status=...}. */
export interface AcademicYearListFilters {
  status?: AcademicYearStatus;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Indica si el año puede recibir mutaciones (PUT, DELETE) según
 * el contrato BE-4.1: {@code CLOSED} es terminal, los demás son
 * editables.
 */
export function isYearMutable(status: AcademicYearStatus): boolean {
  return status !== AcademicYearStatus.Closed;
}

/** Indica si el año puede pasar a ACTIVE via {@code POST /activate}. */
export function isYearActivatable(status: AcademicYearStatus): boolean {
  return status === AcademicYearStatus.Planning || status === AcademicYearStatus.Active;
}
