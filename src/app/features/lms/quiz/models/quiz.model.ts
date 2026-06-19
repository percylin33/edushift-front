/**
 * Quiz lifecycle (BE-7b.0). Mirrors the backend {@code QuizStatus} enum.
 *
 * <p>State machine enforced server-side:
 * <pre>
 *   DRAFT  ──publish──▶  PUBLISHED  ──close──▶  CLOSED
 * </pre>
 *
 * <p>Editing is only allowed in DRAFT (BE-7b.1); once PUBLISHED, only
 * {@code dueAt} and {@code maxAttempts} may be patched.
 */
export enum QuizStatus {
  Draft     = 'DRAFT',
  Published = 'PUBLISHED',
  Closed    = 'CLOSED'
}

/**
 * Question types (BE-7b.0). Mirrors {@code QuestionType} enum.
 *
 * <ul>
 *   <li>{@link MultipleChoice} — 2-6 options, exactly one with
 *       {@code isCorrect=true} (DB trigger enforces invariant).</li>
 *   <li>{@link TrueFalse} — uses {@code correctBoolean} column;
 *       no {@code lms_quiz_options} rows.</li>
 *   <li>{@link ShortAnswer} — uses {@code expectedKeywords} (CSV)
 *       for keyword-match auto-grading (BE-7b.2).</li>
 * </ul>
 */
export enum QuestionType {
  MultipleChoice = 'MC',
  TrueFalse      = 'TF',
  ShortAnswer    = 'SHORT_ANSWER'
}

/* --------------------------------------------------------------------------
 * Wire shapes — mirror backend JSON. The adapter layer is the only place
 * that may massage dates / nulls before the data lands in the domain model.
 * ------------------------------------------------------------------------ */

/**
 * {@code QuizResponseRaw} (BE-7b.1) — full quiz detail with nested
 * questions and options.
 */
export interface QuizResponseRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  dueAt: string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  maxScore: number;
  ownerPublicUuid: string;
  publishedAt: string | null;
  closedAt: string | null;
  questionCount: number;
  totalPoints: number;
  revealCorrectness: boolean;
  questions: QuestionResponseRaw[];
  createdAt: string;
  updatedAt: string | null;
}

/**
 * {@code QuestionResponseRaw} (BE-7b.1) — full question projection.
 *
 * <p>{@code correctText} / {@code correctBoolean} / {@code expectedKeywords}
 * are only returned to users with grading authority
 * ({@code LMS_QUIZ_GRADE}); the backend drops them for taker responses
 * (FE-7b.2). The FE should not assume they are present.
 */
export interface QuestionResponseRaw {
  publicUuid: string;
  type: QuestionType;
  prompt: string;
  points: number;
  position: number;
  correctText: string | null;
  expectedKeywords: string | null;
  correctBoolean: boolean | null;
  options: OptionResponseRaw[];
}

/**
 * {@code OptionResponseRaw} (BE-7b.1) — full option projection.
 *
 * <p>{@code isCorrect} and {@code explanation} are only returned to
 * graders.
 */
export interface OptionResponseRaw {
  publicUuid: string;
  label: string;
  isCorrect: boolean | null;
  explanation: string | null;
  position: number;
}

/**
 * {@code QuizSummaryRaw} (BE-7b.1) — listing projection (no questions).
 */
export interface QuizSummaryRaw {
  publicUuid: string;
  title: string;
  status: QuizStatus;
  dueAt: string | null;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  maxScore: number;
  ownerPublicUuid: string;
  questionCount: number;
  totalPoints: number;
  createdAt: string;
}

/**
 * {@code CreateQuizRequest} body for
 * {@code POST /v1/lms/sections/{uuid}/quizzes}.
 */
export interface CreateQuizRequest {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  timeLimitMinutes?: number | null;
  maxAttempts: number;
  maxScore: number;
  questions?: CreateQuestionRequest[];
}

/**
 * {@code CreateQuestionRequest} body for
 * {@code POST /v1/lms/quizzes/{uuid}/questions}.
 */
export interface CreateQuestionRequest {
  type: QuestionType;
  prompt: string;
  points: number;
  position?: number;
  correctText?: string | null;
  expectedKeywords?: string | null;
  correctBoolean?: boolean | null;
  options?: CreateOptionRequest[];
}

/**
 * {@code CreateOptionRequest} — sub-payload for MC options.
 */
export interface CreateOptionRequest {
  label: string;
  isCorrect: boolean;
  explanation?: string | null;
}

/**
 * Body for {@code PATCH /v1/lms/quizzes/{uuid}}. All optional; empty
 * PATCH triggers {@code QUIZ_RECORD_EMPTY_PATCH}.
 */
export interface UpdateQuizRequest {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  timeLimitMinutes?: number | null;
  maxAttempts?: number;
  maxScore?: number;
}

/**
 * Body for {@code POST /v1/lms/questions/{uuid}/options}.
 */
export interface AddOptionRequest {
  label: string;
  isCorrect: boolean;
  explanation?: string | null;
}

/* --------------------------------------------------------------------------
 * Domain models — what the components consume.
 * ------------------------------------------------------------------------ */

/** Compact quiz used in listing views (TEACHER). */
export interface QuizRow {
  publicUuid: string;
  title: string;
  status: QuizStatus;
  dueAt: Date | null;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  maxScore: number;
  ownerPublicUuid: string;
  questionCount: number;
  totalPoints: number;
  createdAt: Date;
}

/** MC option domain model. */
export interface OptionRow {
  publicUuid: string;
  label: string;
  isCorrect: boolean | null;
  explanation: string | null;
  position: number;
}

/** Question domain model with options nested. */
export interface QuestionRow {
  publicUuid: string;
  type: QuestionType;
  prompt: string;
  points: number;
  position: number;
  correctText: string | null;
  expectedKeywords: string | null;
  correctBoolean: boolean | null;
  options: OptionRow[];
}

/** Full quiz payload (TEACHER detail) with questions and options. */
export interface QuizDetail {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  dueAt: Date | null;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  maxScore: number;
  ownerPublicUuid: string;
  publishedAt: Date | null;
  closedAt: Date | null;
  questionCount: number;
  totalPoints: number;
  revealCorrectness: boolean;
  questions: QuestionRow[];
  createdAt: Date;
  updatedAt: Date | null;
}

/* --------------------------------------------------------------------------
 * Adapters
 * ------------------------------------------------------------------------ */

export function toOptionRow(raw: OptionResponseRaw): OptionRow {
  return {
    publicUuid: raw.publicUuid,
    label: raw.label,
    isCorrect: raw.isCorrect ?? null,
    explanation: raw.explanation ?? null,
    position: raw.position
  };
}

export function toQuestionRow(raw: QuestionResponseRaw): QuestionRow {
  return {
    publicUuid: raw.publicUuid,
    type: raw.type,
    prompt: raw.prompt,
    points: raw.points,
    position: raw.position,
    correctText: raw.correctText ?? null,
    expectedKeywords: raw.expectedKeywords ?? null,
    correctBoolean: raw.correctBoolean ?? null,
    options: (raw.options ?? []).map(toOptionRow)
  };
}

export function toQuizRow(raw: QuizSummaryRaw): QuizRow {
  return {
    publicUuid: raw.publicUuid,
    title: raw.title,
    status: raw.status,
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    timeLimitMinutes: raw.timeLimitMinutes ?? null,
    maxAttempts: raw.maxAttempts,
    maxScore: raw.maxScore,
    ownerPublicUuid: raw.ownerPublicUuid,
    questionCount: raw.questionCount,
    totalPoints: raw.totalPoints,
    createdAt: new Date(raw.createdAt)
  };
}

export function toQuizDetail(raw: QuizResponseRaw): QuizDetail {
  return {
    publicUuid: raw.publicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    title: raw.title,
    description: raw.description ?? null,
    status: raw.status,
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    timeLimitMinutes: raw.timeLimitMinutes ?? null,
    maxAttempts: raw.maxAttempts,
    maxScore: raw.maxScore,
    ownerPublicUuid: raw.ownerPublicUuid,
    publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
    closedAt: raw.closedAt ? new Date(raw.closedAt) : null,
    questionCount: raw.questionCount,
    totalPoints: raw.totalPoints,
    revealCorrectness: raw.revealCorrectness,
    questions: (raw.questions ?? []).map(toQuestionRow),
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null
  };
}

/* --------------------------------------------------------------------------
 * Pure helpers — UI rules mirrored from BE so client + server agree.
 * ------------------------------------------------------------------------ */

/** Is the quiz still mutable from a TEACHER's perspective? */
export function isQuizEditable(detail: Pick<QuizDetail, 'status'>): boolean {
  return detail.status === QuizStatus.Draft;
}

/** Can the quiz be published? Only DRAFT with at least 1 question. */
export function isQuizPublishable(detail: Pick<QuizDetail, 'status' | 'questions'>): boolean {
  return detail.status === QuizStatus.Draft && detail.questions.length > 0;
}

/** Can the quiz be closed? Only PUBLISHED. */
export function isQuizCloseable(detail: Pick<QuizDetail, 'status'>): boolean {
  return detail.status === QuizStatus.Published;
}

/** All quiz statuses for the filter dropdown (in display order). */
export const ALL_QUIZ_STATUSES: readonly QuizStatus[] = [
  QuizStatus.Draft,
  QuizStatus.Published,
  QuizStatus.Closed
] as const;

/** Display labels for the question types (used by the wizard). */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.MultipleChoice]: 'Opción múltiple',
  [QuestionType.TrueFalse]:      'Verdadero / Falso',
  [QuestionType.ShortAnswer]:    'Respuesta corta'
};
