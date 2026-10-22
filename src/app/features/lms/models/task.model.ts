/**
 * LMS task lifecycle (BE-7a.2 + V105).
 *
 * Backend uses DRAFT / PUBLISHED / ARCHIVED. FE displays ARCHIVED as Closed.
 */
export enum TaskLifecycle {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
  Closed = 'ARCHIVED',
}

export enum SubmissionStatus {
  Pending = 'PENDING',
  Submitted = 'SUBMITTED',
  Late = 'LATE',
  Graded = 'GRADED',
  Returned = 'RETURNED',
}

export type StudentAssignmentBucket = 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';

/** Wire shape from {@code TaskResponse} (BE). */
export interface TaskResponseRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  attachmentPublicUuid?: string | null;
  ownerPublicUuid: string;
  allowResubmission?: boolean;
  allowResubmissions?: boolean;
  status: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string | null;
  teacherAssignmentPublicUuid?: string | null;
  coursePublicUuid?: string | null;
  courseName?: string | null;
  periodLabel?: string | null;
  // legacy / optional FE fields
  maxScore?: number;
  lifecycle?: TaskLifecycle;
  createdByTeacherPublicUuid?: string;
  submissionsCount?: number;
  gradedSubmissionsCount?: number;
  periodPublicUuid?: string;
  requiresAttachment?: boolean;
}

/** Wire shape from {@code TaskSummary} (BE). */
export interface TaskSummaryRaw {
  publicUuid: string;
  title: string;
  dueAt: string | null;
  hasAttachment?: boolean;
  ownerPublicUuid?: string;
  status?: string;
  lifecycle?: TaskLifecycle;
  createdAt: string;
  teacherAssignmentPublicUuid?: string | null;
  coursePublicUuid?: string | null;
  courseName?: string | null;
  periodLabel?: string | null;
  maxScore?: number;
  submissionsCount?: number;
  gradedSubmissionsCount?: number;
  sectionLabel?: string | null;
  courseLabel?: string | null;
}

/** Body for {@code POST /sections/{uuid}/tasks}. */
export interface CreateTaskRequest {
  sectionPublicUuid: string;
  title: string;
  description?: string | null;
  dueAt: string;
  attachmentPublicUuid?: string | null;
  teacherAssignmentPublicUuid: string;
  // kept optional for transitional callers
  coursePublicUuid?: string;
  periodPublicUuid?: string;
  maxScore?: number;
  allowResubmissions?: boolean;
  requiresAttachment?: boolean;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  dueAt?: string;
  maxScore?: number;
  allowResubmissions?: boolean;
  requiresAttachment?: boolean;
  attachmentPublicUuid?: string | null;
}

export interface TaskRow {
  publicUuid: string;
  title: string;
  dueAt: Date | null;
  maxScore: number;
  lifecycle: TaskLifecycle;
  submissionsCount: number;
  gradedSubmissionsCount: number;
  sectionLabel: string | null;
  courseLabel: string | null;
  courseName: string | null;
  periodLabel: string | null;
  teacherAssignmentPublicUuid: string | null;
  createdAt: Date;
}

export interface TaskDetail {
  publicUuid: string;
  sectionPublicUuid: string;
  coursePublicUuid: string;
  periodPublicUuid: string;
  title: string;
  description: string | null;
  attachmentPublicUuid: string | null;
  dueAt: Date | null;
  maxScore: number;
  allowResubmissions: boolean;
  requiresAttachment: boolean;
  lifecycle: TaskLifecycle;
  createdByTeacherPublicUuid: string;
  createdAt: Date;
  updatedAt: Date | null;
  submissionsCount: number;
  gradedSubmissionsCount: number;
  teacherAssignmentPublicUuid: string | null;
  courseName: string | null;
  periodLabel: string | null;
}

function mapLifecycle(status: string | TaskLifecycle | undefined): TaskLifecycle {
  if (status === 'DRAFT' || status === TaskLifecycle.Draft) return TaskLifecycle.Draft;
  if (status === 'PUBLISHED' || status === TaskLifecycle.Published) return TaskLifecycle.Published;
  return TaskLifecycle.Closed;
}

export function toTaskRow(raw: TaskSummaryRaw): TaskRow {
  const submissionsCount = raw.submissionsCount ?? 0;
  const gradedSubmissionsCount = raw.gradedSubmissionsCount ?? 0;
  return {
    publicUuid: raw.publicUuid,
    title: raw.title,
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    maxScore: raw.maxScore ?? 0,
    lifecycle: mapLifecycle(raw.status ?? raw.lifecycle),
    submissionsCount,
    gradedSubmissionsCount,
    sectionLabel: raw.sectionLabel ?? null,
    courseLabel: raw.courseLabel ?? raw.courseName ?? null,
    courseName: raw.courseName ?? raw.courseLabel ?? null,
    periodLabel: raw.periodLabel ?? null,
    teacherAssignmentPublicUuid: raw.teacherAssignmentPublicUuid ?? null,
    createdAt: new Date(raw.createdAt),
  };
}

export function toTaskDetail(raw: TaskResponseRaw): TaskDetail {
  return {
    publicUuid: raw.publicUuid,
    sectionPublicUuid: raw.sectionPublicUuid,
    coursePublicUuid: raw.coursePublicUuid ?? '',
    periodPublicUuid: raw.periodPublicUuid ?? '',
    title: raw.title,
    description: raw.description ?? null,
    attachmentPublicUuid: raw.attachmentPublicUuid ?? null,
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    maxScore: raw.maxScore ?? 0,
    allowResubmissions: raw.allowResubmissions ?? raw.allowResubmission ?? true,
    requiresAttachment: raw.requiresAttachment ?? !!raw.attachmentPublicUuid,
    lifecycle: mapLifecycle(raw.status ?? raw.lifecycle),
    createdByTeacherPublicUuid: raw.createdByTeacherPublicUuid ?? raw.ownerPublicUuid,
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
    submissionsCount: raw.submissionsCount ?? 0,
    gradedSubmissionsCount: raw.gradedSubmissionsCount ?? 0,
    teacherAssignmentPublicUuid: raw.teacherAssignmentPublicUuid ?? null,
    courseName: raw.courseName ?? null,
    periodLabel: raw.periodLabel ?? null,
  };
}

export function isTaskEditable(detail: Pick<TaskDetail, 'lifecycle' | 'dueAt'>): boolean {
  return detail.lifecycle === TaskLifecycle.Draft;
}

export function isTaskTerminal(lifecycle: TaskLifecycle): boolean {
  return lifecycle === TaskLifecycle.Closed;
}

export const ALL_TASK_LIFECYCLES: readonly TaskLifecycle[] = [
  TaskLifecycle.Draft,
  TaskLifecycle.Published,
  TaskLifecycle.Closed,
] as const;
