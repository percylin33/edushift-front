/**
 * Models del feature {@code gradebook} (FE-5B.4).
 *
 * <p>Espejo de los DTOs Java de `evaluations.gradebook`:
 * `GradeBookResponse`, `GradeBookStudentEntry`,
 * `GradeBookEvaluationEntry`, `GradeBookCellEntry`.</p>
 *
 * <p>El backend devuelve la matriz como tres listas independientes
 * (`students`, `evaluations`, `cells`) — el FE las indexa por
 * `(studentUuid, evalUuid)` para hacer el lookup O(1) en cada celda.</p>
 */
import { EvaluationKind, EvaluationScale, EvaluationStatus } from '../../evaluations/models';

// ===========================================================================
// Raw shapes
// ===========================================================================

export interface GradeBookStudentEntryRaw {
  publicUuid: string;
  fullName: string;
  weightedAverage: string | null;
}

export interface GradeBookEvaluationEntryRaw {
  publicUuid: string;
  name: string;
  kind: EvaluationKind;
  scale: EvaluationScale;
  status: EvaluationStatus;
  weight: string;
  scheduledDate: string;
}

export interface GradeBookCellEntryRaw {
  studentPublicUuid: string;
  evaluationPublicUuid: string;
  score: string | null;
  literal: string | null;
  recordedAt: string | null;
}

export interface GradeBookResponseRaw {
  assignmentPublicUuid: string;
  sectionPublicUuid: string;
  sectionName: string;
  coursePublicUuid: string;
  courseName: string;
  students: GradeBookStudentEntryRaw[];
  evaluations: GradeBookEvaluationEntryRaw[];
  cells: GradeBookCellEntryRaw[];
}

// ===========================================================================
// UI shapes
// ===========================================================================

export interface GradeBookStudent {
  publicUuid: string;
  fullName: string;
  /** Promedio ponderado (solo SCORE_0_20 publicadas/cerradas). null si no aplica. */
  weightedAverage: number | null;
}

export interface GradeBookEvaluation {
  publicUuid: string;
  name: string;
  kind: EvaluationKind;
  scale: EvaluationScale;
  status: EvaluationStatus;
  weight: number;
  scheduledDate: Date;
}

export interface GradeBookCell {
  studentPublicUuid: string;
  evaluationPublicUuid: string;
  score: number | null;
  literal: string | null;
  recordedAt: Date | null;
}

export interface GradeBook {
  assignmentPublicUuid: string;
  sectionPublicUuid: string;
  sectionName: string;
  coursePublicUuid: string;
  courseName: string;
  students: GradeBookStudent[];
  evaluations: GradeBookEvaluation[];
  /**
   * Mapa {@code "studentUuid::evalUuid" → cell} para lookup O(1) en
   * el render de la matriz. Se construye en {@link toGradeBook}.
   */
  cellIndex: ReadonlyMap<string, GradeBookCell>;
}

// ===========================================================================
// Adapters
// ===========================================================================

function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function cellKey(studentUuid: string, evaluationUuid: string): string {
  return `${studentUuid}::${evaluationUuid}`;
}

export function toGradeBook(raw: GradeBookResponseRaw): GradeBook {
  const cells: GradeBookCell[] = raw.cells.map((c) => ({
    studentPublicUuid: c.studentPublicUuid,
    evaluationPublicUuid: c.evaluationPublicUuid,
    score: parseDecimal(c.score),
    literal: c.literal,
    recordedAt: c.recordedAt ? new Date(c.recordedAt) : null,
  }));

  const cellIndex = new Map<string, GradeBookCell>();
  for (const cell of cells) {
    cellIndex.set(cellKey(cell.studentPublicUuid, cell.evaluationPublicUuid), cell);
  }

  return {
    assignmentPublicUuid: raw.assignmentPublicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    sectionName: raw.sectionName,
    coursePublicUuid: raw.coursePublicUuid,
    courseName: raw.courseName,
    students: raw.students.map((s) => ({
      publicUuid: s.publicUuid,
      fullName: s.fullName,
      weightedAverage: parseDecimal(s.weightedAverage),
    })),
    evaluations: raw.evaluations.map((e) => ({
      publicUuid: e.publicUuid,
      name: e.name,
      kind: e.kind,
      scale: e.scale,
      status: e.status,
      weight: Number(e.weight) || 0,
      scheduledDate: new Date(e.scheduledDate),
    })),
    cellIndex,
  };
}
