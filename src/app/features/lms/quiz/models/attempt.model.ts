/**
 * Quiz attempt lifecycle (BE-7b.2). Mirrors the backend
 * {@code AttemptStatus} enum.
 *
 * <pre>
 *   IN_PROGRESS ──submit──▶ SUBMITTED ──auto-grade──▶ AUTO_GRADED ──manual grade──▶ GRADED
 *        │
 *        └─ time-limit hit ──▶ EXPIRED
 * </pre>
 *
 * <ul>
 *   <li>{@link #InProgress} — student opened the attempt; autosave enabled.
 *       Backend: {@code submitted_at IS NULL}.</li>
 *   <li>{@link #Submitted} — student clicked "Submit final"; awaiting auto-grading.</li>
 *   <li>{@link #AutoGraded} — auto-grader finished MC + TF; SHORT_ANSWER still pending.</li>
 *   <li>{@link #Graded} — all answers graded (manual grade done for SHORT_ANSWER).</li>
 *   <li>{@link #Expired} — time-limit hit (BE-7b.4 job scheduler); closed without submission.</li>
 * </ul>
 */
export enum AttemptStatus {
  InProgress = 'IN_PROGRESS',
  Submitted = 'SUBMITTED',
  AutoGraded = 'AUTO_GRADED',
  Graded = 'GRADED',
  Expired = 'EXPIRED'
}

/**
 * Frontend-derived lifecycle of a single answer row.
 *
 * <p>Mirrors the existence/non-null of the grading fields in
 * {@link AnswerResponseRaw} ({@code pointsAwarded}, {@code gradedAt}).
 * Useful to render chips like "guardado" / "auto-calificado" /
 * "pendiente de revisión" without forcing the template to inspect
 * three fields at once.
 */
export enum AnswerStatus {
  /** No answer has been saved yet (or it was wiped). */
  Empty = 'EMPTY',
  /** Answer saved (autosave), not yet graded. */
  Saved = 'SAVED',
  /** Auto-grader ran (MC/TF deterministic; SHORT_ANSWER keyword-seed). */
  AutoGraded = 'AUTO_GRADED',
  /** A teacher applied a manual grade (SHORT_ANSWER only). */
  ManuallyGraded = 'MANUALLY_GRADED'
}

/**
 * Wire shape for a single answer (Sprint 7b / BE-7b.2). Mirrors
 * {@code com.edushift.modules.quizzes.dto.AnswerResponse}.
 */
export interface AnswerResponseRaw {
  publicUuid: string;
  questionPublicUuid: string;
  /** MC only. */
  selectedOptionId?: string | null;
  /** TF only. */
  selectedBoolean?: boolean | null;
  /** SHORT_ANSWER only. */
  textAnswer?: string | null;
  /** Null until grading ran. */
  correct?: boolean | null;
  /** Null until grading ran. */
  pointsAwarded?: number | null;
  /** UUID of the teacher who applied a manual grade. */
  gradedByUserId?: string | null;
  /** Set when manual grade persisted. */
  gradedAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Wire shape for a full attempt (Sprint 7b / BE-7b.2). Mirrors
 * {@code com.edushift.modules.quizzes.dto.AttemptResponse}.
 */
export interface AttemptResponseRaw {
  publicUuid: string;
  quizPublicUuid: string;
  studentUserId: string;
  submitterUserId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string | null;
  /** Set when the quiz has a time limit. */
  expiresAt?: string | null;
  /** Computed by the service from {@code expiresAt}; null if no time limit. */
  timeRemainingSeconds?: number | null;
  /** Set after the auto-grader ran (status >= SUBMITTED). */
  autoScore?: number | null;
  /** Set after manual grading completed (status = GRADED). */
  manualScore?: number | null;
  /** Final score (autoScore + manualScore). Set when status = GRADED. */
  score?: number | null;
  maxScore?: number | null;
  /** UUID of the teacher who applied the last manual grade. */
  gradedByUserId?: string | null;
  /** Set when status = GRADED. */
  gradedAt?: string | null;
  feedback?: string | null;
  /** Service-computed flag. False for taker pre-grade; true for graders and taker post-grade. */
  revealCorrectness: boolean;
  answers: AnswerResponseRaw[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Wire shape for a teacher-side attempt row (BE-7b.2). Mirrors
 * {@code com.edushift.modules.quizzes.dto.AttemptSummary}.
 */
export interface AttemptSummaryRaw {
  publicUuid: string;
  quizPublicUuid: string;
  studentUserId: string;
  attemptNumber: number;
  status: AttemptStatus;
  autoScore?: number | null;
  manualScore?: number | null;
  score?: number | null;
  maxScore?: number | null;
  /** Number of answers that still need manual grading (SHORT_ANSWER without pointsAwarded). */
  pendingAnswerCount: number;
  startedAt: string;
  submittedAt?: string | null;
  gradedAt?: string | null;
  createdAt?: string | null;
}

/**
 * Wire shape for a row in the manual grading queue (BE-7b.2). Mirrors
 * {@code com.edushift.modules.quizzes.dto.GradingQueueItem}.
 */
export interface GradingQueueItemRaw {
  answerPublicUuid: string;
  attemptPublicUuid: string;
  questionPublicUuid: string;
  studentUserId: string;
  quizTitle: string;
  questionPrompt: string;
  questionPoints: number;
  textAnswer: string;
}

/**
 * Wire shape for the body of {@code PATCH /v1/lms/attempts/{uuid}}
 * (autosave). Mirrors {@code SaveAnswersRequest}.
 */
export interface SaveAnswersRequest {
  answers: AnswerInputRaw[];
}

/**
 * One entry inside {@link SaveAnswersRequest}. Mirrors
 * {@code com.edushift.modules.quizzes.dto.AnswerInput}.
 *
 * <p>Mutually exclusive (DB CHECK enforced on the backend):
 * <ul>
 *   <li>MC — {@link selectedOptionId} non-null.</li>
 *   <li>TF — {@link selectedBoolean} non-null.</li>
 *   <li>SHORT_ANSWER — {@link textAnswer} non-null.</li>
 * </ul>
 */
export interface AnswerInputRaw {
  questionPublicUuid: string;
  /** Hint to the backend; the service re-reads the question row to validate shape. */
  questionType: 'MC' | 'TF' | 'SHORT_ANSWER';
  selectedOptionId?: string | null;
  selectedBoolean?: boolean | null;
  textAnswer?: string | null;
}

/**
 * Wire shape for {@code POST /v1/lms/attempts/{uuid}/grade}. Mirrors
 * {@code ManualGradeAttemptRequest}.
 */
export interface ManualGradeAttemptRequest {
  grades: ManualGradeAnswerRequest[];
  feedback?: string | null;
}

/** Entry inside {@link ManualGradeAttemptRequest}. */
export interface ManualGradeAnswerRequest {
  answerPublicUuid?: string | null;
  /** 0..1000 inclusive, but capped server-side to the question's own points. */
  pointsAwarded: number;
}

// ---------------------------------------------------------------------------
// Domain models (what the UI consumes).
// ---------------------------------------------------------------------------

/** Domain model for a single answer row. */
export interface AnswerRow {
  publicUuid: string;
  questionPublicUuid: string;
  selectedOptionId: string | null;
  selectedBoolean: boolean | null;
  textAnswer: string | null;
  correct: boolean | null;
  pointsAwarded: number | null;
  gradedByUserId: string | null;
  gradedAt: Date | null;
  updatedAt: Date | null;
  /** Derived from grading fields. */
  status: AnswerStatus;
}

/** Domain model for a full attempt. */
export interface AttemptDetail {
  publicUuid: string;
  quizPublicUuid: string;
  studentUserId: string;
  submitterUserId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  expiresAt: Date | null;
  timeRemainingSeconds: number | null;
  autoScore: number | null;
  manualScore: number | null;
  score: number | null;
  maxScore: number | null;
  gradedByUserId: string | null;
  gradedAt: Date | null;
  feedback: string | null;
  revealCorrectness: boolean;
  answers: AnswerRow[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Domain model for a teacher-side attempt row. */
export interface AttemptSummaryRow {
  publicUuid: string;
  quizPublicUuid: string;
  studentUserId: string;
  attemptNumber: number;
  status: AttemptStatus;
  autoScore: number | null;
  manualScore: number | null;
  score: number | null;
  maxScore: number | null;
  pendingAnswerCount: number;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
  createdAt: Date | null;
}

/** Domain model for a manual-grading queue item. */
export interface GradingQueueItem {
  answerPublicUuid: string;
  attemptPublicUuid: string;
  questionPublicUuid: string;
  studentUserId: string;
  quizTitle: string;
  questionPrompt: string;
  questionPoints: number;
  textAnswer: string;
}

/** A pending grade in the FE form (mirrors {@link ManualGradeAnswerRequest}). */
export interface ManualGradeEntry {
  answerPublicUuid: string;
  /** 0..questionPoints, validated client-side. */
  pointsAwarded: number;
  /** Optional per-row note (consumed client-side only; backend only has the attempt-level feedback). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Adapters.
// ---------------------------------------------------------------------------

function parseDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function deriveAnswerStatus(raw: AnswerResponseRaw): AnswerStatus {
  if (raw.pointsAwarded === null || raw.pointsAwarded === undefined) {
    const hasPayload =
      raw.selectedOptionId !== null && raw.selectedOptionId !== undefined
      || raw.selectedBoolean !== null && raw.selectedBoolean !== undefined
      || raw.textAnswer !== null && raw.textAnswer !== undefined;
    return hasPayload ? AnswerStatus.Saved : AnswerStatus.Empty;
  }
  if (raw.gradedByUserId !== null && raw.gradedByUserId !== undefined) {
    return AnswerStatus.ManuallyGraded;
  }
  return AnswerStatus.AutoGraded;
}

export function toAnswerRow(raw: AnswerResponseRaw): AnswerRow {
  return {
    publicUuid: raw.publicUuid,
    questionPublicUuid: raw.questionPublicUuid,
    selectedOptionId: raw.selectedOptionId ?? null,
    selectedBoolean: raw.selectedBoolean ?? null,
    textAnswer: raw.textAnswer ?? null,
    correct: raw.correct ?? null,
    pointsAwarded: raw.pointsAwarded ?? null,
    gradedByUserId: raw.gradedByUserId ?? null,
    gradedAt: parseDate(raw.gradedAt),
    updatedAt: parseDate(raw.updatedAt),
    status: deriveAnswerStatus(raw)
  };
}

export function toAttemptDetail(raw: AttemptResponseRaw): AttemptDetail {
  return {
    publicUuid: raw.publicUuid,
    quizPublicUuid: raw.quizPublicUuid,
    studentUserId: raw.studentUserId,
    submitterUserId: raw.submitterUserId,
    attemptNumber: raw.attemptNumber,
    status: raw.status,
    startedAt: parseDate(raw.startedAt) ?? new Date(0),
    submittedAt: parseDate(raw.submittedAt),
    expiresAt: parseDate(raw.expiresAt),
    timeRemainingSeconds: raw.timeRemainingSeconds ?? null,
    autoScore: raw.autoScore ?? null,
    manualScore: raw.manualScore ?? null,
    score: raw.score ?? null,
    maxScore: raw.maxScore ?? null,
    gradedByUserId: raw.gradedByUserId ?? null,
    gradedAt: parseDate(raw.gradedAt),
    feedback: raw.feedback ?? null,
    revealCorrectness: !!raw.revealCorrectness,
    answers: (raw.answers ?? []).map(toAnswerRow),
    createdAt: parseDate(raw.createdAt),
    updatedAt: parseDate(raw.updatedAt)
  };
}

export function toAttemptSummaryRow(raw: AttemptSummaryRaw): AttemptSummaryRow {
  return {
    publicUuid: raw.publicUuid,
    quizPublicUuid: raw.quizPublicUuid,
    studentUserId: raw.studentUserId,
    attemptNumber: raw.attemptNumber,
    status: raw.status,
    autoScore: raw.autoScore ?? null,
    manualScore: raw.manualScore ?? null,
    score: raw.score ?? null,
    maxScore: raw.maxScore ?? null,
    pendingAnswerCount: raw.pendingAnswerCount,
    startedAt: parseDate(raw.startedAt) ?? new Date(0),
    submittedAt: parseDate(raw.submittedAt),
    gradedAt: parseDate(raw.gradedAt),
    createdAt: parseDate(raw.createdAt)
  };
}

export function toGradingQueueItem(raw: GradingQueueItemRaw): GradingQueueItem {
  return {
    answerPublicUuid: raw.answerPublicUuid,
    attemptPublicUuid: raw.attemptPublicUuid,
    questionPublicUuid: raw.questionPublicUuid,
    studentUserId: raw.studentUserId,
    quizTitle: raw.quizTitle,
    questionPrompt: raw.questionPrompt,
    questionPoints: raw.questionPoints,
    textAnswer: raw.textAnswer
  };
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/** True when the attempt can still accept autosave (PATCH) calls. */
export function isAttemptInProgress(detail: Pick<AttemptDetail, 'status'>): boolean {
  return detail.status === AttemptStatus.InProgress;
}

/** True when the attempt has reached a terminal state (no more writes). */
export function isAttemptFinal(detail: Pick<AttemptDetail, 'status'>): boolean {
  return detail.status === AttemptStatus.Graded || detail.status === AttemptStatus.Expired;
}

/** True when the attempt is awaiting a teacher's manual verdict on SHORT_ANSWER. */
export function isAttemptAwaitingManualGrade(detail: Pick<AttemptDetail, 'status'>): boolean {
  return detail.status === AttemptStatus.AutoGraded;
}

/** True when the attempt is graded and the taker (or anyone with reveal) can see correctness. */
export function canRevealCorrectnessFor(
  detail: Pick<AttemptDetail, 'status' | 'revealCorrectness'>
): boolean {
  return detail.revealCorrectness || detail.status === AttemptStatus.Graded;
}

/** Pretty label for an attempt status (UI strings). */
export const ATTEMPT_STATUS_LABEL: Record<AttemptStatus, string> = {
  [AttemptStatus.InProgress]: 'En progreso',
  [AttemptStatus.Submitted]: 'Enviado',
  [AttemptStatus.AutoGraded]: 'Auto-calificado (pendiente manual)',
  [AttemptStatus.Graded]: 'Calificado',
  [AttemptStatus.Expired]: 'Expirado'
};

/** Tailwind color hint for an attempt status. */
export const ATTEMPT_STATUS_COLOR: Record<AttemptStatus, string> = {
  [AttemptStatus.InProgress]: 'text-blue-700 bg-blue-50 ring-blue-200',
  [AttemptStatus.Submitted]: 'text-amber-700 bg-amber-50 ring-amber-200',
  [AttemptStatus.AutoGraded]: 'text-violet-700 bg-violet-50 ring-violet-200',
  [AttemptStatus.Graded]: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  [AttemptStatus.Expired]: 'text-slate-600 bg-slate-50 ring-slate-200'
};

/** Tailwind dot color for an attempt status. */
export const ATTEMPT_STATUS_DOT: Record<AttemptStatus, string> = {
  [AttemptStatus.InProgress]: 'bg-blue-500',
  [AttemptStatus.Submitted]: 'bg-amber-500',
  [AttemptStatus.AutoGraded]: 'bg-violet-500',
  [AttemptStatus.Graded]: 'bg-emerald-500',
  [AttemptStatus.Expired]: 'bg-slate-400'
};

/** Label for an answer status. */
export const ANSWER_STATUS_LABEL: Record<AnswerStatus, string> = {
  [AnswerStatus.Empty]: 'Sin responder',
  [AnswerStatus.Saved]: 'Guardado',
  [AnswerStatus.AutoGraded]: 'Auto-calificado',
  [AnswerStatus.ManuallyGraded]: 'Calificado'
};

/** Tailwind color for an answer status. */
export const ANSWER_STATUS_COLOR: Record<AnswerStatus, string> = {
  [AnswerStatus.Empty]: 'text-slate-600 bg-slate-50 ring-slate-200',
  [AnswerStatus.Saved]: 'text-blue-700 bg-blue-50 ring-blue-200',
  [AnswerStatus.AutoGraded]: 'text-violet-700 bg-violet-50 ring-violet-200',
  [AnswerStatus.ManuallyGraded]: 'text-emerald-700 bg-emerald-50 ring-emerald-200'
};

export const ALL_ATTEMPT_STATUSES: readonly AttemptStatus[] = [
  AttemptStatus.InProgress,
  AttemptStatus.Submitted,
  AttemptStatus.AutoGraded,
  AttemptStatus.Graded,
  AttemptStatus.Expired
];
