import { ApiResponse } from '@core/models';

/**
 * One entry in the manual index returned by
 * `GET /api/v1/help/manuals`. Mirrors `ManualIndexEntry` on the backend.
 */
export interface ManualIndexEntry {
  role: string;
  title: string;
  summary: string;
  /** Relative path inside the manuals root, e.g. `/manuales/tenant-admin/README.md`. */
  url: string;
  /** ISO-8601 date string (YYYY-MM-DD). */
  updatedAt: string;
  /** `live` for fully covered manuals, `partial` for coverage gaps. */
  status: 'live' | 'partial';
}

/**
 * One chapter (README or one of the 3 chapter files) of a role manual.
 * Returned by `GET /api/v1/help/manuals/{role}/{file}`.
 */
export interface ManualChapter {
  role: string;
  /** Path of the chapter relative to the manuals root, e.g. `tenant-admin/01-onboarding-y-acceso.md`. */
  path: string;
  title: string;
  /** Raw markdown source — to be rendered by the FE. */
  content: string;
  updatedAt: string;
}

/** Canonical role keys, in display order. */
export const MANUAL_ROLES: ReadonlyArray<string> = [
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
  'STAFF',
];

export type ManualChapterFile =
  | 'README.md'
  | '01-onboarding-y-acceso.md'
  | '02-flujos-esenciales.md'
  | '03-autoevaluacion.md';

/** All chapter filenames, in display order. */
export const MANUAL_CHAPTER_FILES: ReadonlyArray<ManualChapterFile> = [
  'README.md',
  '01-onboarding-y-acceso.md',
  '02-flujos-esenciales.md',
  '03-autoevaluacion.md',
];

export interface ApiEnvelope<T> extends ApiResponse<T> {}

/**
 * One progress row returned by
 * `GET /api/v1/help/progress/{role}/{file}`.
 */
export interface HelpProgressItem {
  itemId: string;
  checked: boolean;
  updatedAt: string;
}

/**
 * Body for `PUT /api/v1/help/progress/{role}/{file}`.
 */
export interface SetProgressRequest {
  itemId: string;
  checked: boolean;
}

/**
 * One feedback record returned by
 * `GET /api/v1/help/feedback/{role}` and `POST /api/v1/help/feedback`.
 */
export interface HelpFeedback {
  publicUuid: string;
  role: string;
  chapterFile: string | null;
  body: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
}

/**
 * Body for `POST /api/v1/help/feedback`.
 */
export interface CreateFeedbackRequest {
  role: string;
  chapterFile: string | null;
  body: string;
}