/**
 * Types for the Centro de Pruebas por Rol (`/help`) — Sprint 17 / F-QA-PLAN.
 *
 * <p>The wizard runs each {@link Capability} as a sequence of {@link CapabilityStep}s
 * against the real backend with the role of the authenticated user. When a step
 * fails the user can persist a structured {@link BugReport}.</p>
 *
 * <p>Convention: {@code capabilityId} = {@code <roleKey>.<modulo>.<accion>}
 * (e.g. {@code sa.dashboard.kpis}, {@code te.attendance.scan}). The roleKey
 * matches {@code MANUAL_ROLES} from help.model.ts.</p>
 */
export type CapabilityStatus =
  | 'live'
  | 'partial'
  | 'planned'
  | 'broken';

export type RoleKey =
  | 'super-admin'
  | 'tenant-admin'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'staff';

export type CapabilityGroup =
  | 'auth'
  | 'academic'
  | 'attendance'
  | 'evaluations'
  | 'lms'
  | 'finance'
  | 'system';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type StepSuccessCriteria =
  | { kind: 'status'; value: number | number[] }
  | { kind: 'bodyContains'; value: string }
  | { kind: 'manualConfirm'; prompt: string };

export interface CapabilityStep {
  id: string;
  label: string;
  description: string;
  endpoint?: { method: HttpMethod; path: string };
  /**
   * If true the wizard executes the HTTP call. If false, the user must
   * confirm manually.
   *
   * <p><strong>Default guidance:</strong> only {@code autoExecute: true}
   * for readonly side-effects (GETs, login, dev-bypass). All mutations
   * (POST/PUT/PATCH/DELETE) default to false.</p>
   *
   * <p>Optional because purely manual confirmation steps ({@code manualConfirm})
   * don't have an HTTP execution path.</p>
   */
  autoExecute?: boolean;
  successCriteria: StepSuccessCriteria;
  defaultPayload?: Record<string, unknown>;
}

export interface Capability {
  id: string;
  roleKey: RoleKey;
  title: string;
  summary: string;
  group: CapabilityGroup;
  status: CapabilityStatus;
  prerequisite?: string;
  steps: CapabilityStep[];
  /** Endpoint that receives a bug report when a step fails. */
  bugReportPath: string;
}

export type StepStatus = 'idle' | 'running' | 'passed' | 'failed' | 'broken' | 'skipped';

export interface StepRunResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  errorMessage?: string;
  durationMs: number;
  manual?: boolean;
  prompt?: string;
}

export type BugReportSeverity = 'BLOCKER' | 'MAJOR' | 'MINOR' | 'COSMETIC';
export type BugReportStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface BugReport {
  id: string;
  createdAt: string;
  tenantId: string | null;
  actorId: string;
  capabilityId: string;
  stepId: string;
  stepLabel?: string | null;
  severity: BugReportSeverity;
  status: BugReportStatus;
  notes?: string | null;
  request?: Record<string, unknown> | null;
}

export interface CreateBugReportRequest {
  capabilityId: string;
  stepId: string;
  stepLabel?: string | null;
  severity: BugReportSeverity;
  notes?: string | null;
  request?: Record<string, unknown> | null;
}

export interface PagedBugReports {
  content: BugReport[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
