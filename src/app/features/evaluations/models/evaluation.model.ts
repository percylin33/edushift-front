import { ApiResponse } from '@core/models';

// =============================================================================
// Enums (espejo del backend Sprint 5B / BE-5B.1)
// =============================================================================

/**
 * Naturaleza pedagógica de la evaluation. Determina qué `scale` es
 * coherente (matriz `kind × scale` validada server-side).
 *
 * Ver `EvaluationKind.java` y ADR-5B.2 en `docs/modules/evaluations.md`.
 */
export enum EvaluationKind {
  TASK = 'TASK',
  QUIZ = 'QUIZ',
  EXAM = 'EXAM',
  RUBRIC = 'RUBRIC',
  COMPETENCY = 'COMPETENCY',
}

/**
 * Escala de calificación. `SCORE_0_20` es numérica (BigDecimal con 2 decimales);
 * los `LITERAL_*` son qualitative (e.g. AD/A/B/C/D según escala MINEDU).
 */
export enum EvaluationScale {
  SCORE_0_20 = 'SCORE_0_20',
  LITERAL_AD = 'LITERAL_AD',
  LITERAL_NA = 'LITERAL_NA',
  LITERAL_A_B_C_D = 'LITERAL_A_B_C_D',
}

/**
 * Lifecycle de la evaluation. `CLOSED` es 100% terminal (no hay reopen,
 * ADR-5B.7). Las transiciones se exponen vía endpoints dedicados
 * (`/publish`, `/close`).
 */
export enum EvaluationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
}

// =============================================================================
// Label maps + badge classes
// =============================================================================

export const EVALUATION_KIND_LABELS: Record<EvaluationKind, string> = {
  [EvaluationKind.TASK]: 'Tarea',
  [EvaluationKind.QUIZ]: 'Práctica',
  [EvaluationKind.EXAM]: 'Examen',
  [EvaluationKind.RUBRIC]: 'Rúbrica',
  [EvaluationKind.COMPETENCY]: 'Competencia',
};

export const EVALUATION_SCALE_LABELS: Record<EvaluationScale, string> = {
  [EvaluationScale.SCORE_0_20]: 'Vigesimal (0-20)',
  [EvaluationScale.LITERAL_AD]: 'Literal AD/A/B/C',
  [EvaluationScale.LITERAL_NA]: 'NA / Logrado / En proceso',
  [EvaluationScale.LITERAL_A_B_C_D]: 'Literal A/B/C/D',
};

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  [EvaluationStatus.DRAFT]: 'Borrador',
  [EvaluationStatus.PUBLISHED]: 'Publicada',
  [EvaluationStatus.CLOSED]: 'Cerrada',
};

export const EVALUATION_STATUS_BADGE_CLASS: Record<EvaluationStatus, string> = {
  [EvaluationStatus.DRAFT]: 'badge-secondary',
  [EvaluationStatus.PUBLISHED]: 'badge-info',
  [EvaluationStatus.CLOSED]: 'badge-success',
};

export const EVALUATION_KIND_BADGE_CLASS: Record<EvaluationKind, string> = {
  [EvaluationKind.TASK]: 'badge-info',
  [EvaluationKind.QUIZ]: 'badge-warning',
  [EvaluationKind.EXAM]: 'badge-danger',
  [EvaluationKind.RUBRIC]: 'badge-primary',
  [EvaluationKind.COMPETENCY]: 'badge-secondary',
};

/**
 * Matriz `kind × scale` aceptada por el backend. La replicamos en el
 * frontend para validar antes de enviar y para limitar el `<select>` de
 * `scale` cuando el usuario elige `kind`.
 *
 * Servidor: `EvaluationServiceImpl.assertKindScaleCoherent`.
 */
export const ALLOWED_SCALES_BY_KIND: Record<EvaluationKind, EvaluationScale[]> = {
  [EvaluationKind.TASK]: [
    EvaluationScale.SCORE_0_20,
    EvaluationScale.LITERAL_NA,
    EvaluationScale.LITERAL_A_B_C_D,
  ],
  [EvaluationKind.QUIZ]: [EvaluationScale.SCORE_0_20],
  [EvaluationKind.EXAM]: [EvaluationScale.SCORE_0_20],
  [EvaluationKind.RUBRIC]: [
    EvaluationScale.LITERAL_AD,
    EvaluationScale.LITERAL_A_B_C_D,
    EvaluationScale.LITERAL_NA,
  ],
  [EvaluationKind.COMPETENCY]: [EvaluationScale.LITERAL_AD, EvaluationScale.LITERAL_A_B_C_D],
};

// =============================================================================
// Raw wire shapes (JSON tal cual viene del backend)
// =============================================================================

/** RAW backend {@code EvaluationResponse.AssignmentRef}. */
export interface AssignmentRefRaw {
  publicUuid: string;
  label: string;
}

/** RAW backend {@code EvaluationResponse} (BE-5B.1 + BE-5B.4 plug del gradeCount). */
export interface EvaluationResponseRaw {
  publicUuid: string;
  assignment: AssignmentRefRaw;
  unitPublicUuid: string | null;
  learningSessionPublicUuid: string | null;
  kind: EvaluationKind;
  name: string;
  description: string | null;
  /** Number como string (BigDecimal serializado). */
  weight: string;
  /** ISO local date `YYYY-MM-DD`. */
  scheduledDate: string;
  /** ISO local date `YYYY-MM-DD` o null. */
  dueDate: string | null;
  scale: EvaluationScale;
  status: EvaluationStatus;
  /** ISO instant. */
  publishedAt: string | null;
  /** ISO instant. */
  closedAt: string | null;
  isActive: boolean;
  /** Sprint 5B / BE-5B.4: número real de grade records persistidos. */
  gradeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** RAW backend {@code EvaluationListItem}. */
export interface EvaluationListItemRaw {
  publicUuid: string;
  kind: EvaluationKind;
  name: string;
  weight: string;
  scheduledDate: string;
  dueDate: string | null;
  scale: EvaluationScale;
  status: EvaluationStatus;
  gradeCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// UI shapes (post-adapter: ISO → Date / number)
// =============================================================================

/** Compact reference al `TeacherAssignment` padre (UI). */
export interface AssignmentRef {
  publicUuid: string;
  /**
   * Label denormalizado por el backend, e.g.
   * `"MAT-1A · Bimestre 1"`.
   */
  label: string;
}

/** Detail completo de una evaluation, post-adapter. */
export interface EvaluationDetail {
  publicUuid: string;
  assignment: AssignmentRef;
  unitPublicUuid?: string;
  learningSessionPublicUuid?: string;
  kind: EvaluationKind;
  name: string;
  description?: string;
  /** Numeric weight con hasta 2 decimales (e.g. 25, 33.33). */
  weight: number;
  scheduledDate: Date;
  dueDate?: Date;
  scale: EvaluationScale;
  status: EvaluationStatus;
  publishedAt?: Date;
  closedAt?: Date;
  isActive: boolean;
  gradeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Row del listing por assignment (FE-5B.1). */
export interface EvaluationRow {
  publicUuid: string;
  kind: EvaluationKind;
  name: string;
  weight: number;
  scheduledDate: Date;
  dueDate?: Date;
  scale: EvaluationScale;
  status: EvaluationStatus;
  gradeCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

/**
 * Body de `POST /v1/academic/teacher-assignments/{assignmentUuid}/evaluations`.
 * Validación full server-side; el FE replica las reglas críticas (rangos
 * de `weight`, matriz `kind × scale`).
 */
export interface CreateEvaluationRequest {
  kind: EvaluationKind;
  name: string;
  description?: string;
  /** En [0, 999.99] con 2 decimales. */
  weight: number;
  /** ISO local date `YYYY-MM-DD`. */
  scheduledDate: string;
  /** ISO local date `YYYY-MM-DD`. Opcional; si presente debe ser ≥ scheduledDate. */
  dueDate?: string;
  scale: EvaluationScale;
  /** Public UUID del Unit anchor (opcional). */
  unitPublicUuid?: string;
  /** Public UUID del LearningSession anchor (opcional). */
  learningSessionPublicUuid?: string;
}

/**
 * Body de `PUT /v1/academic/evaluations/{publicUuid}`.
 *
 * Patch parcial: `null`/`undefined` ignorados. La editability matrix
 * (DRAFT libre / PUBLISHED `description`+`dueDate` / CLOSED read-only)
 * se enforce server-side; el FE oculta los inputs no editables.
 *
 * Para "limpiar" un anchor pasar string vacío (ADR-5B.4).
 */
export interface UpdateEvaluationRequest {
  kind?: EvaluationKind;
  name?: string;
  description?: string;
  weight?: number;
  scheduledDate?: string;
  dueDate?: string;
  scale?: EvaluationScale;
  /** Pasar `''` para desanclar. */
  unitPublicUuid?: string;
  /** Pasar `''` para desanclar. */
  learningSessionPublicUuid?: string;
  isActive?: boolean;
}

/** Filtros del `GET …/evaluations?status&from&to&isActive`. */
export interface EvaluationFilters {
  status?: EvaluationStatus;
  isActive?: boolean;
  /** ISO local date. */
  from?: string;
  /** ISO local date. */
  to?: string;
}

// =============================================================================
// Adapters (raw → UI)
// =============================================================================

/** Parsea un ISO local-date `YYYY-MM-DD` como Date local (00:00 local time). */
function parseLocalDate(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

function parseInstant(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  return new Date(s);
}

export function toEvaluationDetail(raw: EvaluationResponseRaw): EvaluationDetail {
  return {
    publicUuid: raw.publicUuid,
    assignment: { ...raw.assignment },
    unitPublicUuid: raw.unitPublicUuid ?? undefined,
    learningSessionPublicUuid: raw.learningSessionPublicUuid ?? undefined,
    kind: raw.kind,
    name: raw.name,
    description: raw.description ?? undefined,
    weight: parseFloat(raw.weight),
    scheduledDate: parseLocalDate(raw.scheduledDate)!,
    dueDate: parseLocalDate(raw.dueDate),
    scale: raw.scale,
    status: raw.status,
    publishedAt: parseInstant(raw.publishedAt),
    closedAt: parseInstant(raw.closedAt),
    isActive: raw.isActive,
    gradeCount: raw.gradeCount ?? 0,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export function toEvaluationRow(raw: EvaluationListItemRaw): EvaluationRow {
  return {
    publicUuid: raw.publicUuid,
    kind: raw.kind,
    name: raw.name,
    weight: parseFloat(raw.weight),
    scheduledDate: parseLocalDate(raw.scheduledDate)!,
    dueDate: parseLocalDate(raw.dueDate),
    scale: raw.scale,
    status: raw.status,
    gradeCount: raw.gradeCount ?? 0,
    isActive: raw.isActive,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Computa `EvaluationStatus` siguientes legales desde un current.
 * Espejo del enum helper backend `EvaluationStatus.legalNext()`.
 */
export function legalNextStatuses(current: EvaluationStatus): EvaluationStatus[] {
  switch (current) {
    case EvaluationStatus.DRAFT:
      return [EvaluationStatus.PUBLISHED];
    case EvaluationStatus.PUBLISHED:
      return [EvaluationStatus.CLOSED];
    case EvaluationStatus.CLOSED:
      return [];
  }
}

/**
 * `true` si la evaluation acepta PUT en al menos algún campo.
 * (DRAFT → cualquier campo, PUBLISHED → description + dueDate,
 *  CLOSED → ninguno; ver ADR-5B.7 / editability matrix).
 */
export function isEvaluationEditable(status: EvaluationStatus): boolean {
  return status !== EvaluationStatus.CLOSED;
}

/**
 * `true` si la evaluation soporta DELETE soft. Solo DRAFT (gates
 * `EVAL_PUBLISHED_NOT_DELETABLE` en PUBLISHED, `EVAL_CLOSED` en CLOSED).
 */
export function isEvaluationDeletable(status: EvaluationStatus): boolean {
  return status === EvaluationStatus.DRAFT;
}

// Type alias para que el envelope esté disponible al servicio.
export type EvaluationDetailEnvelope = ApiResponse<EvaluationResponseRaw>;
