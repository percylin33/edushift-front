/**
 * Models del feature {@code grade-records} (FE-5B.3).
 *
 * <p>Espejo de los DTOs Java del módulo `evaluations.graderecord`:
 * `GradeRecordResponse`, `GradeRecordListItem`, `CreateGradeRecordRequest`,
 * `UpdateGradeRecordRequest`, `BulkGradeRecordRequest`,
 * `BulkGradeRecordResponse`, `GradeRecordFilters`.</p>
 *
 * <p>El BE valida shape por scale; aquí re-implementamos el subset
 * crítico para feedback inmediato (mirror de
 * {@code GradeRecordServiceImpl.LITERAL_*_VALUES} en el backend):</p>
 * <ul>
 *   <li>{@code SCORE_0_20} ⇒ {@code score} obligatorio en [0, 20] con ≤2 decimales.</li>
 *   <li>{@code LITERAL_AD} ⇒ {@code literal} ∈ {@code AD|A}.</li>
 *   <li>{@code LITERAL_NA} ⇒ {@code literal} ∈ {@code NA|A}.</li>
 *   <li>{@code LITERAL_A_B_C_D} ⇒ {@code literal} ∈ {@code A|B|C|D}.</li>
 *   <li>Comments siempre opcional, max 1000 chars.</li>
 * </ul>
 *
 * <h3>Manejo de tipos</h3>
 * <ul>
 *   <li>El BE serializa {@code BigDecimal} como string (vía Jackson) — aquí lo
 *       parseamos a {@code number} para los inputs y lo serializamos como string
 *       al enviar (nunca usar JS {@code Number} para pasar al wire — perdemos
 *       precisión decimal).</li>
 *   <li>{@code Instant} llega como ISO-8601 string; lo convertimos a {@code Date} en
 *       el adapter para mostrar.</li>
 * </ul>
 */
import { EvaluationScale, EvaluationStatus } from '../../evaluations/models';

// ===========================================================================
// Constantes
// ===========================================================================

export const SCORE_MIN = 0;
export const SCORE_MAX = 20;
export const COMMENTS_MAX_LENGTH = 1000;
export const BULK_MAX_ROWS = 200;

/**
 * Set de literales válidos por scale. Mirror de
 * `LiteralValidationService` en el backend.
 */
export const ALLOWED_LITERALS_BY_SCALE: Record<EvaluationScale, readonly string[]> = {
  [EvaluationScale.SCORE_0_20]: [],
  [EvaluationScale.LITERAL_AD]: ['AD', 'A'],
  [EvaluationScale.LITERAL_NA]: ['NA', 'A'],
  [EvaluationScale.LITERAL_A_B_C_D]: ['A', 'B', 'C', 'D'],
};

// ===========================================================================
// Raw (over-the-wire) shapes
// ===========================================================================

export interface GradeRecordListItemRaw {
  publicUuid: string;
  studentPublicUuid: string;
  studentFirstName: string;
  studentLastName: string;
  studentSecondLastName: string | null;
  score: string | null;
  literal: string | null;
  comments: string | null;
  recordedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GradeRecordResponseRaw {
  publicUuid: string;
  evaluation: {
    publicUuid: string;
    name: string;
    scale: EvaluationScale;
    status: EvaluationStatus;
  };
  student: {
    publicUuid: string;
    firstName: string;
    lastName: string;
    secondLastName: string | null;
  };
  score: string | null;
  literal: string | null;
  comments: string | null;
  recordedAt: string | null;
  recordedByUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BulkGradeRecordResponseRaw {
  requested: number;
  created: number;
  updated: number;
  records: GradeRecordResponseRaw[];
}

// ===========================================================================
// UI shapes (adapted)
// ===========================================================================

export interface GradeRecordRow {
  publicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  studentLastName: string;
  studentFirstName: string;
  score: number | null;
  literal: string | null;
  comments: string | null;
  recordedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GradeRecordDetail extends GradeRecordRow {
  evaluation: {
    publicUuid: string;
    name: string;
    scale: EvaluationScale;
    status: EvaluationStatus;
  };
  recordedByUserId: string | null;
}

export interface BulkGradeRecordSummary {
  requested: number;
  created: number;
  updated: number;
  records: GradeRecordDetail[];
}

// ===========================================================================
// Request DTOs
// ===========================================================================

export interface CreateGradeRecordRequest {
  studentPublicUuid: string;
  /** Para SCORE_0_20. */
  score?: number | null;
  /** Para LITERAL_*. */
  literal?: string | null;
  comments?: string | null;
}

export interface UpdateGradeRecordRequest {
  score?: number | null;
  literal?: string | null;
  comments?: string | null;
}

export interface BulkGradeRecordRequest {
  records: CreateGradeRecordRequest[];
}

export interface GradeRecordFilters {
  studentPublicUuid?: string;
  sectionPublicUuid?: string;
  isActive?: boolean;
}

// ===========================================================================
// Adapters
// ===========================================================================

/**
 * Formato pedagógico ES-PE: "Apellido Paterno [Materno], Nombre".
 *
 * <p>El sort default en el roster es por apellido paterno asc — esto
 * mantiene consistencia con el listing de students del Sprint 3.</p>
 */
function fmtName(first: string, last: string, second: string | null): string {
  const lasts = [last, second].filter((s): s is string => !!s).join(' ');
  return `${lasts}, ${first}`;
}

function parseDecimal(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toGradeRecordRow(raw: GradeRecordListItemRaw): GradeRecordRow {
  return {
    publicUuid: raw.publicUuid,
    studentPublicUuid: raw.studentPublicUuid,
    studentFullName: fmtName(raw.studentFirstName, raw.studentLastName, raw.studentSecondLastName),
    studentFirstName: raw.studentFirstName,
    studentLastName: raw.studentLastName,
    score: parseDecimal(raw.score),
    literal: raw.literal,
    comments: raw.comments,
    recordedAt: raw.recordedAt ? new Date(raw.recordedAt) : null,
    isActive: raw.isActive,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export function toGradeRecordDetail(raw: GradeRecordResponseRaw): GradeRecordDetail {
  return {
    publicUuid: raw.publicUuid,
    studentPublicUuid: raw.student.publicUuid,
    studentFullName: fmtName(
      raw.student.firstName,
      raw.student.lastName,
      raw.student.secondLastName,
    ),
    studentFirstName: raw.student.firstName,
    studentLastName: raw.student.lastName,
    score: parseDecimal(raw.score),
    literal: raw.literal,
    comments: raw.comments,
    recordedAt: raw.recordedAt ? new Date(raw.recordedAt) : null,
    isActive: raw.isActive,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    evaluation: raw.evaluation,
    recordedByUserId: raw.recordedByUserId,
  };
}

export function toBulkSummary(raw: BulkGradeRecordResponseRaw): BulkGradeRecordSummary {
  return {
    requested: raw.requested,
    created: raw.created,
    updated: raw.updated,
    records: raw.records.map(toGradeRecordDetail),
  };
}

// ===========================================================================
// Validación cliente (espejo del BE)
// ===========================================================================

/**
 * Devuelve un mensaje legible si el payload es inválido para la scale
 * dada, o `null` si todo OK. NO valida la matrix lifecycle (eso lo gatea
 * el server con `GRADE_EVAL_CLOSED`).
 */
export function validateGradeShape(
  scale: EvaluationScale,
  payload: { score?: number | null; literal?: string | null },
): string | null {
  const hasScore = payload.score !== null && payload.score !== undefined;
  const hasLiteral = !!payload.literal && payload.literal.trim().length > 0;

  if (!hasScore && !hasLiteral) {
    return 'Debes ingresar un valor (nota o literal).';
  }

  if (scale === EvaluationScale.SCORE_0_20) {
    if (!hasScore) return 'Esta evaluación requiere una nota numérica.';
    if (hasLiteral) return 'Esta evaluación no admite literal, solo nota numérica.';
    if (payload.score! < SCORE_MIN || payload.score! > SCORE_MAX) {
      return `La nota debe estar entre ${SCORE_MIN} y ${SCORE_MAX}.`;
    }
    return null;
  }

  // LITERAL_* + BINARY_PASS_FAIL
  if (hasScore) {
    return 'Esta evaluación no admite nota numérica, solo literal.';
  }
  const allowed = ALLOWED_LITERALS_BY_SCALE[scale];
  if (allowed.length === 0) {
    return 'Escala no soportada en cliente.';
  }
  if (!allowed.includes(payload.literal!.toUpperCase())) {
    return `Literal inválido. Permitidos: ${allowed.join(', ')}.`;
  }
  return null;
}

/**
 * Indica si la evaluation acepta cambios en sus grade-records. CLOSED
 * ⇒ read-only (servidor responde con 409 GRADE_EVAL_CLOSED). DRAFT y
 * PUBLISHED son writeables.
 */
export function areGradesEditable(status: EvaluationStatus): boolean {
  return status !== EvaluationStatus.CLOSED;
}
