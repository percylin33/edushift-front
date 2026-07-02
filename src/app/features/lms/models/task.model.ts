/**
 * LMS task lifecycle (BE-7a.2).
 *
 * <p>Mirrors the backend {@code TaskLifecycle} enum verbatim. The state
 * machine enforced server-side is:
 * <pre>
 *   DRAFT  ──publish──▶  PUBLISHED  ──close──▶  CLOSED
 *    │                       │
 *    └─ edit allowed ─┐       └─ new submissions accepted
 *                     │           (while {@code dueAt > now})
 *    edit forbidden once PUBLISHED unless {@code dueAt} is in the future.
 * </pre>
 */
export enum TaskLifecycle {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
  Closed = 'CLOSED',
}

/**
 * Per-student submission lifecycle, surfaced to STUDENT/PARENT in
 * "Mis tareas" (FE-7a.1 Scenario 4) and consumed by the badge in
 * the task detail (FE-7a.2 — Sprint 7a deliverable #2).
 *
 * <p>The backend derives {@code LATE} server-side: any submission
 * persisted after {@code dueAt} lands in this state regardless of the
 * submitter's intent. {@code RETURNED} is set by a TEACHER
 * {@code PATCH /submissions/{uuid}/return} and re-enables
 * {@code PATCH /submissions/{uuid}} on the student side.
 */
export enum SubmissionStatus {
  Pending = 'PENDING',
  Submitted = 'SUBMITTED',
  Late = 'LATE',
  Graded = 'GRADED',
  Returned = 'RETURNED',
}

/**
 * Numeric grade bands for the per-student tabs.
 *
 * <p>Mirrors the {@code SubmissionStatus} group used by the listing
 * filter in "Mis tareas" (Todas / Pendientes / Entregadas / Calificadas /
 * Atrasadas). {@code Pending} means "no submission yet, dueAt in the
 * future"; {@code Late} covers "no submission and dueAt already passed"
 * AND "submission after dueAt".
 */
export type StudentAssignmentBucket = 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';

/* --------------------------------------------------------------------------
 * Wire shapes — these mirror the JSON returned by the backend. Keep them
 * verbatim; the adapter in this file is the only layer that may massage
 * the data before it lands in the domain model.
 * ------------------------------------------------------------------------ */

/** {@code AssignmentResponseRaw} — full task (BE-7a.2). */
export interface TaskResponseRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  coursePublicUuid: string;
  periodPublicUuid: string;
  title: string;
  description: string | null;
  /** ISO-8601 timestamp. {@code null} until PUBLISHED for some flows. */
  dueAt: string | null;
  /** Decimal score; > 0 per business rule. */
  maxScore: number;
  /** {@code true} ⇒ PATCH /submissions/{uuid} allowed after GRADED. */
  allowResubmissions: boolean;
  /** True if a file attachment is expected (just a hint, not enforced). */
  requiresAttachment: boolean;
  lifecycle: TaskLifecycle;
  /** Public UUID of the section's primary teacher at creation time. */
  createdByTeacherPublicUuid: string;
  createdAt: string;
  updatedAt: string | null;
  /** Submission counter — only present on listing endpoints. */
  submissionsCount?: number;
}

/** {@code AssignmentSummaryRaw} — listing projection (BE-7a.2). */
export interface TaskSummaryRaw {
  publicUuid: string;
  title: string;
  dueAt: string | null;
  maxScore: number;
  lifecycle: TaskLifecycle;
  submissionsCount: number;
  /** Denormalized label for the section (server-side join). */
  sectionLabel: string | null;
  /** Denormalized label for the course. */
  courseLabel: string | null;
  createdAt: string;
}

/**
 * {@code CreateAssignmentRequest} body for
 * {@code POST /v1/lms/assignments}.
 */
export interface CreateTaskRequest {
  sectionPublicUuid: string;
  coursePublicUuid: string;
  periodPublicUuid: string;
  title: string;
  description?: string | null;
  dueAt: string;
  maxScore: number;
  allowResubmissions: boolean;
  requiresAttachment: boolean;
}

/** Body for {@code PATCH /v1/lms/assignments/{uuid}}. All optional. */
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  dueAt?: string;
  maxScore?: number;
  allowResubmissions?: boolean;
  requiresAttachment?: boolean;
}

/* --------------------------------------------------------------------------
 * Domain models — what the components consume.
 * ------------------------------------------------------------------------ */

/** Compact task used in listing views (TEACHER). */
export interface TaskRow {
  publicUuid: string;
  title: string;
  dueAt: Date | null;
  maxScore: number;
  lifecycle: TaskLifecycle;
  submissionsCount: number;
  sectionLabel: string | null;
  courseLabel: string | null;
  createdAt: Date;
}

/**
 * Full task payload (TEACHER/STUDENT detail). Mirrors
 * {@link TaskResponseRaw} with date strings → Date for ergonomic access
 * in the template.
 */
export interface TaskDetail {
  publicUuid: string;
  sectionPublicUuid: string;
  coursePublicUuid: string;
  periodPublicUuid: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  maxScore: number;
  allowResubmissions: boolean;
  requiresAttachment: boolean;
  lifecycle: TaskLifecycle;
  createdByTeacherPublicUuid: string;
  createdAt: Date;
  updatedAt: Date | null;
  submissionsCount: number;
}

/* --------------------------------------------------------------------------
 * Adapters
 * ------------------------------------------------------------------------ */

/**
 * Convert the listing wire-shape into the domain row. Normalizes Jackson's
 * {@code null} (empty-optional convention) to {@code undefined} where the
 * component expects it.
 */
export function toTaskRow(raw: TaskSummaryRaw): TaskRow {
  return {
    publicUuid: raw.publicUuid,
    title: raw.title,
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    maxScore: raw.maxScore,
    lifecycle: raw.lifecycle,
    submissionsCount: raw.submissionsCount,
    sectionLabel: raw.sectionLabel ?? null,
    courseLabel: raw.courseLabel ?? null,
    createdAt: new Date(raw.createdAt),
  };
}

export function toTaskDetail(raw: TaskResponseRaw): TaskDetail {
  return {
    publicUuid: raw.publicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    coursePublicUuid: raw.coursePublicUuid,
    periodPublicUuid: raw.periodPublicUuid,
    title: raw.title,
    description: raw.description ?? null,
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    maxScore: raw.maxScore,
    allowResubmissions: raw.allowResubmissions,
    requiresAttachment: raw.requiresAttachment,
    lifecycle: raw.lifecycle,
    createdByTeacherPublicUuid: raw.createdByTeacherPublicUuid,
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
    submissionsCount: raw.submissionsCount ?? 0,
  };
}

/* --------------------------------------------------------------------------
 * Pure helpers — kept here so the spec and the UI agree on rules.
 * ------------------------------------------------------------------------ */

/** Is the task still mutable from a TEACHER's perspective? */
export function isTaskEditable(detail: Pick<TaskDetail, 'lifecycle' | 'dueAt'>): boolean {
  if (detail.lifecycle === TaskLifecycle.Draft) return true;
  if (detail.lifecycle === TaskLifecycle.Closed) return false;
  // PUBLISHED but dueAt in the future → edits allowed (BE-7a.2 spec).
  return detail.dueAt instanceof Date && detail.dueAt.getTime() > Date.now();
}

/** Is the lifecycle terminal? */
export function isTaskTerminal(lifecycle: TaskLifecycle): boolean {
  return lifecycle === TaskLifecycle.Closed;
}

/** All lifecycles for the filter dropdown (in display order). */
export const ALL_TASK_LIFECYCLES: readonly TaskLifecycle[] = [
  TaskLifecycle.Draft,
  TaskLifecycle.Published,
  TaskLifecycle.Closed,
] as const;
