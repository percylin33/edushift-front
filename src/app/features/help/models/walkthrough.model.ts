/**
 * Walkthrough guides — parsed from `docs/modules/*-walkthrough.md`.
 *
 * <p>Each guide is a Markdown file with the same structure: pre-condiciones,
 * índice de features, and per-feature tables. The parser extracts the
 * capability tables (the ones with `| # | Acción UI | Endpoint BE | … |`)
 * and exposes each row as a {@link WalkthroughStep}.</p>
 *
 * <p>The feature lives under `edushift-front/src/app/features/help/guides/`
 * and is mounted at `/help/guides/:roleKey` from the help feature.</p>
 */

export type RoleKey =
  | 'super-admin'
  | 'tenant-admin'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'staff';

export interface WalkthroughStep {
  /** Stable id derived from the row order within the feature. */
  id: string;
  /** Step number inside the feature table (1-indexed). */
  index: number;
  /** What to do in the UI. */
  action: string;
  /** Endpoint BE exercised (or `—`). */
  endpoint: string;
  /** Payload / data needed. */
  payload: string;
  /** Observable success criterion. */
  successCriterion: string;
  /** `data-testid` selector (or `—` / "FE: añadir …" notes). */
  testId: string;
  /** Free-form notes. */
  notes: string;
}

export interface WalkthroughFeature {
  /** Feature heading, e.g. `F1. Login con X-Tenant-Slug`. */
  heading: string;
  /** Capability id parsed from the line `### Capability: \`<id>\``. */
  capabilityId: string | null;
  /** Steps table (already parsed). */
  steps: WalkthroughStep[];
  /** Free-form body content (pre-condiciones, negative cases, notes). */
  body: string;
}

export interface Walkthrough {
  roleKey: RoleKey;
  /** File slug used for asset path, e.g. `tenant-admin`. */
  slug: string;
  title: string;
  /** Free-form body content from the top of the file (intro). */
  intro: string;
  features: WalkthroughFeature[];
}

/** One persisted checkbox entry: `${capabilityId}:${stepId}`. */
export interface WalkthroughProgress {
  /** Map keyed by `${capabilityId}:${stepId}`. */
  completed: Record<string, boolean>;
}

export const WALKTHROUGH_FILES: ReadonlyArray<{ roleKey: RoleKey; slug: string; title: string }> = [
  { roleKey: 'super-admin', slug: 'super-admin', title: 'SUPER_ADMIN' },
  { roleKey: 'tenant-admin', slug: 'tenant-admin', title: 'TENANT_ADMIN' },
  { roleKey: 'teacher', slug: 'teacher', title: 'TEACHER' },
  { roleKey: 'student', slug: 'student', title: 'STUDENT' },
  { roleKey: 'parent', slug: 'parent', title: 'PARENT' },
  { roleKey: 'staff', slug: 'staff', title: 'STAFF' },
];

export const WALKTHROUGH_PROGRESS_STORAGE_KEY = 'edushift.qa.walkthroughProgress';