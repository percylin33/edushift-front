import { SubmissionStatus } from './task.model';

/**
 * `Submission` model + DTOs for the LMS module (BE-7a.2 / FE-7a.2).
 *
 * <h3>Why a separate file from {@link task.model.ts}</h3>
 * Even though {@code SubmissionStatus} lives in `task.model.ts` (it's
 * tightly coupled to the task lifecycle concept), the submission
 * itself, its attachment projection and the grade/return request
 * bodies deserve their own file. Keeps the import graph small and the
 * `SubmissionsStore` doesn't need to drag the full Task model.
 */

/** {@code SubmissionResponseRaw} — full submission payload. */
export interface SubmissionResponseRaw {
  publicUuid: string;
  assignmentPublicUuid: string;
  studentPublicUuid: string;
  /** Public UUID of the actor who hit POST. May be the student or their guardian. */
  submittedByUserPublicUuid: string;
  /** Only set when {@code submittedByUserPublicUuid} is a guardian acting for the student. */
  submittedForStudentPublicUuid: string | null;
  status: SubmissionStatus;
  /** Free-form answer body, up to 5000 chars. */
  textContent: string | null;
  /** Denormalized on the read path for convenience — server joins file_objects. */
  attachment: SubmissionAttachmentRaw | null;
  /** 1-based. Incrementa con cada re-entrega. */
  version: number;
  /** Decimal 0..maxScore. {@code null} until graded. */
  grade: number | null;
  /** Free-form TEACHER feedback; {@code null} until graded or returned. */
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  gradedByTeacherPublicUuid: string | null;
  /** Set by the server on {@code RETURNED} lifecycle hop. */
  returnedAt: string | null;
  returnedByTeacherPublicUuid: string | null;
}

/** {@code SubmissionAttachmentRaw} — file_object projection embedded in the read shape. */
export interface SubmissionAttachmentRaw {
  publicUuid: string;
  /** Original filename as uploaded. */
  filename: string;
  /** Bytes. */
  sizeBytes: number;
  /** MIME type, lowercased. */
  contentType: string;
  /** Public download URL (signed, time-limited). */
  downloadUrl: string;
}

/** {@code SubmissionSummaryRaw} — listing projection (BE-7a.2). */
export interface SubmissionSummaryRaw {
  publicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  studentAvatarUrl: string | null;
  status: SubmissionStatus;
  version: number;
  submittedAt: string;
  grade: number | null;
  hasAttachment: boolean;
}

/**
 * Domain {@code Submission} (full payload). Mirrors
 * {@link SubmissionResponseRaw} with ISO strings → {@code Date}.
 */
export interface Submission {
  publicUuid: string;
  assignmentPublicUuid: string;
  studentPublicUuid: string;
  submittedByUserPublicUuid: string;
  submittedForStudentPublicUuid: string | null;
  status: SubmissionStatus;
  textContent: string | null;
  attachment: SubmissionAttachment | null;
  version: number;
  grade: number | null;
  feedback: string | null;
  submittedAt: Date;
  gradedAt: Date | null;
  gradedByTeacherPublicUuid: string | null;
  returnedAt: Date | null;
  returnedByTeacherPublicUuid: string | null;
}

/** Domain projection of the attachment. */
export interface SubmissionAttachment {
  publicUuid: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  downloadUrl: string;
}

/** Compact row used in the TEACHER listing / STUDENT "Mis tareas" preview. */
export interface SubmissionRow {
  publicUuid: string;
  studentPublicUuid: string;
  studentFullName: string;
  studentAvatarUrl: string | null;
  status: SubmissionStatus;
  version: number;
  submittedAt: Date;
  grade: number | null;
  hasAttachment: boolean;
}

/**
 * Body for {@code POST /v1/lms/assignments/{uuid}/submissions}.
 *
 * <p>Send as {@code multipart/form-data} when {@code attachment} is
 * present; the JSON-only form is for text-only entregas. Backend
 * enforces: at least one of {@code textContent} / {@code attachment}.
 */
export interface CreateSubmissionRequest {
  textContent?: string | null;
  /** For PARENT acting on behalf: the student's public UUID. */
  submittedForStudentPublicUuid?: string | null;
  /** Multipart file part named "attachment". Omit for text-only. */
  attachment?: File | null;
}

/** Body for {@code PATCH /v1/lms/submissions/{uuid}} (re-submit). */
export interface UpdateSubmissionRequest {
  textContent?: string | null;
  attachment?: File | null;
}

/** Body for {@code PATCH /v1/lms/submissions/{uuid}/grade}. */
export interface GradeSubmissionRequest {
  /** Decimal 0..maxScore. Server enforces range. */
  grade: number;
  feedback?: string | null;
}

/** Body for {@code PATCH /v1/lms/submissions/{uuid}/return}. */
export interface ReturnSubmissionRequest {
  feedback?: string | null;
}

/* --------------------------------------------------------------------------
 * Adapters
 * ------------------------------------------------------------------------ */

export function toSubmission(raw: SubmissionResponseRaw): Submission {
  return {
    publicUuid: raw.publicUuid,
    assignmentPublicUuid: raw.assignmentPublicUuid,
    studentPublicUuid: raw.studentPublicUuid,
    submittedByUserPublicUuid: raw.submittedByUserPublicUuid,
    submittedForStudentPublicUuid: raw.submittedForStudentPublicUuid ?? null,
    status: raw.status,
    textContent: raw.textContent ?? null,
    attachment: raw.attachment ? toAttachment(raw.attachment) : null,
    version: raw.version,
    grade: raw.grade ?? null,
    feedback: raw.feedback ?? null,
    submittedAt: new Date(raw.submittedAt),
    gradedAt: raw.gradedAt ? new Date(raw.gradedAt) : null,
    gradedByTeacherPublicUuid: raw.gradedByTeacherPublicUuid ?? null,
    returnedAt: raw.returnedAt ? new Date(raw.returnedAt) : null,
    returnedByTeacherPublicUuid: raw.returnedByTeacherPublicUuid ?? null,
  };
}

export function toAttachment(raw: SubmissionAttachmentRaw): SubmissionAttachment {
  return {
    publicUuid: raw.publicUuid,
    filename: raw.filename,
    sizeBytes: raw.sizeBytes,
    contentType: raw.contentType,
    downloadUrl: raw.downloadUrl,
  };
}

export function toSubmissionRow(raw: SubmissionSummaryRaw): SubmissionRow {
  return {
    publicUuid: raw.publicUuid,
    studentPublicUuid: raw.studentPublicUuid,
    studentFullName: raw.studentFullName,
    studentAvatarUrl: raw.studentAvatarUrl ?? null,
    status: raw.status,
    version: raw.version,
    submittedAt: new Date(raw.submittedAt),
    grade: raw.grade ?? null,
    hasAttachment: !!raw.hasAttachment,
  };
}

/* --------------------------------------------------------------------------
 * Pure helpers
 * ------------------------------------------------------------------------ */

/** Whitelist of MIME types accepted by the submission upload. */
export const ALLOWED_ATTACHMENT_MIME: ReadonlyArray<string> = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
] as const;

/** Max attachment size in bytes (25 MB). Mirrors backend's `lms.submission.max-file-size`. */
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

/** Human-readable form of {@link MAX_ATTACHMENT_SIZE_BYTES}. */
export const MAX_ATTACHMENT_SIZE_LABEL = '25 MB';

/**
 * True iff the submission is in a state where a re-entrega is allowed:
 * the server-side predicate is `(status=RETURNED OR allowResubmissions=true)
 * AND now < dueAt`. Here we only have the local view; the server is the
 * source of truth and will respond 409 if the policy rejects the POST.
 */
export function canResubmit(status: SubmissionStatus, allowResubmissions: boolean): boolean {
  if (status === SubmissionStatus.Returned) return true;
  if (status === SubmissionStatus.Graded && allowResubmissions) return true;
  return status === SubmissionStatus.Pending;
}

/** Bucket for the per-student tab counts (FE-7a.1 Scenario 4). */
export type SubmissionBucket = 'PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE';

export function toBucket(status: SubmissionStatus, isLate: boolean): SubmissionBucket {
  if (status === SubmissionStatus.Graded) return 'GRADED';
  if (isLate || status === SubmissionStatus.Late) return 'LATE';
  if (status === SubmissionStatus.Submitted || status === SubmissionStatus.Returned) {
    return 'SUBMITTED';
  }
  return 'PENDING';
}
