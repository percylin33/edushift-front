/**
 * Models del feature {@code gradebook} (FE-5B.4; F0–F4 formal register).
 *
 * <p>Espejo de los DTOs Java de `evaluations.gradebook`:
 * `GradeBookResponse`, `GradeBookStudentEntry`,
 * `GradeBookEvaluationEntry`, `GradeBookCellEntry`,
 * `GradeBookCategoryEntry`.</p>
 */
import {
  EvaluationKind,
  EvaluationScale,
  EvaluationStatus,
} from '../../evaluations/models';

// ===========================================================================
// Raw shapes
// ===========================================================================

export type PeriodType = 'BIMESTRE' | 'TRIMESTRE' | 'ANUAL';

export type EnrollmentStatus =
  | 'ACTIVE'
  | 'WITHDRAWN'
  | 'TRANSFERRED'
  | 'GRADUATED'
  | string;

export interface GradeBookCategoryEntryRaw {
  publicUuid: string;
  name: string;
  colorToken: string | null;
  sortOrder: number;
  weight: string | number;
  contributesToAverage: boolean;
  allowsTeacherColumns?: boolean;
}

export interface GradeBookStudentEntryRaw {
  publicUuid: string;
  fullName: string;
  weightedAverage: string | null;
  enrollmentStatus?: string | null;
  /** Map categoryUuid → average (keys may arrive as strings). */
  categoryAverages?: Record<string, string | number | null> | null;
  literalAverage?: string | null;
  categoryLiteralAverages?: Record<string, string | null> | null;
}

export interface GradeBookEvaluationEntryRaw {
  publicUuid: string;
  name: string;
  kind: EvaluationKind;
  scale: EvaluationScale;
  status: EvaluationStatus;
  weight: string;
  scheduledDate: string;
  categoryPublicUuid?: string | null;
  categoryName?: string | null;
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
  gradePublicUuid: string | null;
  gradeName: string | null;
  gradeOrdinal: number | null;
  levelCode: string | null;
  coursePublicUuid: string;
  courseName: string;
  teacherFullName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  periodName: string;
  templatePublicUuid?: string | null;
  templateName?: string | null;
  gradingScale?: EvaluationScale | null;
  categories?: GradeBookCategoryEntryRaw[] | null;
  students: GradeBookStudentEntryRaw[];
  evaluations: GradeBookEvaluationEntryRaw[];
  cells: GradeBookCellEntryRaw[];
}

// ===========================================================================
// UI shapes
// ===========================================================================

export interface GradeBookCategory {
  publicUuid: string;
  name: string;
  colorToken: string | null;
  sortOrder: number;
  weight: number;
  contributesToAverage: boolean;
  /** false = la columna la crea el colegio (conducta, examen fijo). */
  allowsTeacherColumns: boolean;
}

export interface GradeBookStudent {
  publicUuid: string;
  fullName: string;
  /** Promedio ponderado (solo SCORE_0_20 publicadas/cerradas). null si no aplica. */
  weightedAverage: number | null;
  enrollmentStatus: EnrollmentStatus;
  /** Promedio por categoría (uuid → valor). */
  categoryAverages: ReadonlyMap<string, number | null>;
  /** Promedio literal AD/A/B/C. null en planilla 0–20. */
  literalAverage: string | null;
  categoryLiteralAverages: ReadonlyMap<string, string | null>;
}

export interface GradeBookEvaluation {
  publicUuid: string;
  name: string;
  kind: EvaluationKind;
  scale: EvaluationScale;
  status: EvaluationStatus;
  weight: number;
  scheduledDate: Date;
  categoryPublicUuid: string | null;
  categoryName: string | null;
}

export interface GradeBookCell {
  studentPublicUuid: string;
  evaluationPublicUuid: string;
  score: number | null;
  literal: string | null;
  recordedAt: Date | null;
}

export interface GradeBookKindGroup {
  kind: EvaluationKind;
  evaluations: GradeBookEvaluation[];
}

export interface GradeBookCategoryGroup {
  /** null = evaluaciones sin categoría asignada. */
  category: GradeBookCategory | null;
  label: string;
  colorToken: string | null;
  evaluations: GradeBookEvaluation[];
  /**
   * Incluye columna Prom. del bloque si contributesToAverage y hay más de una
   * casilla (SINGLE / una sola eval no muestran Prom. redundante).
   */
  showCategoryAverage: boolean;
  /** colspan = evals + (showCategoryAverage ? 1 : 0). */
  colspan: number;
}

export interface GradeBook {
  assignmentPublicUuid: string;
  sectionPublicUuid: string;
  sectionName: string;
  gradePublicUuid: string | null;
  gradeName: string | null;
  gradeOrdinal: number | null;
  levelCode: string | null;
  coursePublicUuid: string;
  courseName: string;
  teacherFullName: string;
  academicPeriodPublicUuid: string;
  periodType: PeriodType;
  periodOrdinal: number;
  periodName: string;
  templatePublicUuid: string | null;
  templateName: string | null;
  gradingScale: EvaluationScale | null;
  categories: GradeBookCategory[];
  students: GradeBookStudent[];
  evaluations: GradeBookEvaluation[];
  /**
   * true cuando el BE envía plantilla/categorías → layout F1b.
   * false → fallback F0 por kind.
   */
  hasCategoryLayout: boolean;
  categoryGroups: GradeBookCategoryGroup[];
  kindGroups: GradeBookKindGroup[];
  cellIndex: ReadonlyMap<string, GradeBookCell>;
}

export interface GradeBookQuery {
  includeWithdrawn?: boolean;
  includeTransferred?: boolean;
}

/** Orden fijo de grupos de columna (F0 formal register). */
export const GRADEBOOK_KIND_ORDER: readonly EvaluationKind[] = [
  EvaluationKind.EXAM,
  EvaluationKind.QUIZ,
  EvaluationKind.TASK,
  EvaluationKind.RUBRIC,
  EvaluationKind.COMPETENCY,
] as const;

export const KIND_GROUP_BAND_CLASS: Record<EvaluationKind, string> = {
  [EvaluationKind.EXAM]: 'kind-band-exam',
  [EvaluationKind.QUIZ]: 'kind-band-quiz',
  [EvaluationKind.TASK]: 'kind-band-task',
  [EvaluationKind.RUBRIC]: 'kind-band-rubric',
  [EvaluationKind.COMPETENCY]: 'kind-band-competency',
};

export const CATEGORY_BAND_CLASS: Record<string, string> = {
  amber: 'cat-band-amber',
  green: 'cat-band-green',
  blue: 'cat-band-blue',
  slate: 'cat-band-slate',
  violet: 'cat-band-violet',
};

export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  WITHDRAWN: 'Ret.',
  TRANSFERRED: 'Trasl.',
  GRADUATED: 'Egr.',
};

// ===========================================================================
// Adapters
// ===========================================================================

function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function cellKey(studentUuid: string, evaluationUuid: string): string {
  return `${studentUuid}::${evaluationUuid}`;
}

export function categoryBandClass(colorToken: string | null | undefined): string {
  if (!colorToken) return 'cat-band-slate';
  return CATEGORY_BAND_CLASS[colorToken] ?? 'cat-band-slate';
}

export function groupEvaluationsByKind(
  evaluations: GradeBookEvaluation[],
): GradeBookKindGroup[] {
  const byKind = new Map<EvaluationKind, GradeBookEvaluation[]>();
  for (const e of evaluations) {
    const list = byKind.get(e.kind);
    if (list) list.push(e);
    else byKind.set(e.kind, [e]);
  }
  const groups: GradeBookKindGroup[] = [];
  for (const kind of GRADEBOOK_KIND_ORDER) {
    const list = byKind.get(kind);
    if (list?.length) {
      groups.push({ kind, evaluations: sortEvaluationsAscending(list) });
    }
  }
  return groups;
}

export function groupEvaluationsByCategory(
  categories: GradeBookCategory[],
  evaluations: GradeBookEvaluation[],
): GradeBookCategoryGroup[] {
  const byCat = new Map<string | null, GradeBookEvaluation[]>();
  for (const e of evaluations) {
    const key = e.categoryPublicUuid;
    const list = byCat.get(key);
    if (list) list.push(e);
    else byCat.set(key, [e]);
  }

  const groups: GradeBookCategoryGroup[] = [];
  for (const cat of categories) {
    const list = sortEvaluationsAscending(byCat.get(cat.publicUuid) ?? []);
    byCat.delete(cat.publicUuid);
    /* Incluir categorías vacías: el docente debe ver la estructura de la
     * plantilla (OPEN sin columnas aún) para poder crear registros ahí. */
    const showAvg = cat.contributesToAverage && list.length > 1;
    const dataCols = list.length + (showAvg ? 1 : 0);
    groups.push({
      category: cat,
      label: cat.name,
      colorToken: cat.colorToken,
      evaluations: list,
      showCategoryAverage: showAvg,
      /* Placeholder de 1 col cuando no hay evaluaciones todavía. */
      colspan: Math.max(1, dataCols),
    });
  }

  // Evals huérfanas / sin categoría
  const uncategorized = byCat.get(null) ?? [];
  for (const [key, list] of byCat) {
    if (key === null) continue;
    uncategorized.push(...list);
  }
  if (uncategorized.length > 0) {
    const sorted = sortEvaluationsAscending(uncategorized);
    groups.push({
      category: null,
      label: 'Sin categoría',
      colorToken: 'slate',
      evaluations: sorted,
      showCategoryAverage: false,
      colspan: sorted.length,
    });
  }

  return groups;
}

/** S1…S10 / labels numéricos en orden ascendente (no por fecha desc). */
export function sortEvaluationsAscending(
  evaluations: GradeBookEvaluation[],
): GradeBookEvaluation[] {
  return [...evaluations].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;
    const byDate = a.scheduledDate.getTime() - b.scheduledDate.getTime();
    if (byDate !== 0) return byDate;
    return a.publicUuid.localeCompare(b.publicUuid);
  });
}

export function toGradeBook(raw: GradeBookResponseRaw): GradeBook {
  const cells: GradeBookCell[] = (raw.cells ?? []).map((c) => ({
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

  const categories: GradeBookCategory[] = (raw.categories ?? []).map((c) => ({
    publicUuid: c.publicUuid,
    name: c.name,
    colorToken: c.colorToken,
    sortOrder: c.sortOrder ?? 0,
    weight: parseDecimal(c.weight) ?? 0,
    contributesToAverage: !!c.contributesToAverage,
    allowsTeacherColumns: c.allowsTeacherColumns !== false,
  }));

  const evaluations = (raw.evaluations ?? []).map((e) => ({
    publicUuid: e.publicUuid,
    name: e.name,
    kind: e.kind,
    scale: e.scale,
    status: e.status,
    weight: Number(e.weight) || 0,
    scheduledDate: new Date(e.scheduledDate),
    categoryPublicUuid: e.categoryPublicUuid ?? null,
    categoryName: e.categoryName ?? null,
  }));

  const hasCategoryLayout = categories.length > 0;

  return {
    assignmentPublicUuid: raw.assignmentPublicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    sectionName: raw.sectionName,
    gradePublicUuid: raw.gradePublicUuid ?? null,
    gradeName: raw.gradeName ?? null,
    gradeOrdinal: raw.gradeOrdinal ?? null,
    levelCode: raw.levelCode ?? null,
    coursePublicUuid: raw.coursePublicUuid,
    courseName: raw.courseName,
    teacherFullName: raw.teacherFullName ?? '',
    academicPeriodPublicUuid: raw.academicPeriodPublicUuid ?? '',
    periodType: raw.periodType ?? 'BIMESTRE',
    periodOrdinal: raw.periodOrdinal ?? 0,
    periodName: raw.periodName ?? '',
    templatePublicUuid: raw.templatePublicUuid ?? null,
    templateName: raw.templateName ?? null,
    gradingScale: raw.gradingScale ?? null,
    categories,
    students: (raw.students ?? []).map((s) => {
      const avgMap = new Map<string, number | null>();
      if (s.categoryAverages) {
        for (const [k, v] of Object.entries(s.categoryAverages)) {
          avgMap.set(k, parseDecimal(v));
        }
      }
      const literalMap = new Map<string, string | null>();
      if (s.categoryLiteralAverages) {
        for (const [k, v] of Object.entries(s.categoryLiteralAverages)) {
          literalMap.set(k, v ?? null);
        }
      }
      return {
        publicUuid: s.publicUuid,
        fullName: s.fullName,
        weightedAverage: parseDecimal(s.weightedAverage),
        enrollmentStatus: (s.enrollmentStatus as EnrollmentStatus) || 'ACTIVE',
        categoryAverages: avgMap,
        literalAverage: s.literalAverage ?? null,
        categoryLiteralAverages: literalMap,
      };
    }),
    evaluations,
    hasCategoryLayout,
    categoryGroups: hasCategoryLayout
      ? groupEvaluationsByCategory(categories, evaluations)
      : [],
    kindGroups: groupEvaluationsByKind(evaluations),
    cellIndex,
  };
}

/** Label de salón con grado: "3° Primaria — 3°A". */
export function formatSalonLabel(
  sectionName: string,
  gradeName: string | null | undefined,
): string {
  const section = sectionName?.trim() || '';
  const grade = gradeName?.trim() || '';
  if (grade && section) return `${grade} — ${section}`;
  return grade || section || '—';
}
