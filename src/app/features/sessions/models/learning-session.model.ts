// =============================================================================
// Enums
// =============================================================================

export enum SessionStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  [SessionStatus.PLANNED]: 'Planificada',
  [SessionStatus.IN_PROGRESS]: 'En Progreso',
  [SessionStatus.COMPLETED]: 'Completada',
  [SessionStatus.CANCELLED]: 'Cancelada',
};

export const SESSION_STATUS_BADGE_CLASS: Record<SessionStatus, string> = {
  [SessionStatus.PLANNED]: 'badge-neutral',
  [SessionStatus.IN_PROGRESS]: 'badge-primary',
  [SessionStatus.COMPLETED]: 'badge-success',
  [SessionStatus.CANCELLED]: 'badge-danger',
};

// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-5A.4)
// =============================================================================

export interface LearningSessionAssignmentSummaryRaw {
  publicUuid: string;
  teacherName: string;
  courseCode: string;
  sectionName: string;
}

export interface LearningSessionUnitSummaryRaw {
  publicUuid: string;
  name: string;
  displayOrder: number;
}

export interface LearningSessionListItemRaw {
  publicUuid: string;
  version: number;
  title: string;
  scheduledDate: string; // LocalDate "YYYY-MM-DD"
  durationMinutes: number;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  assignment: LearningSessionAssignmentSummaryRaw;
  unit: LearningSessionUnitSummaryRaw;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LearningSessionTeacherRefRaw {
  publicUuid: string;
  firstName: string;
  lastName: string;
}

export interface LearningSessionCourseRefRaw {
  publicUuid: string;
  code: string;
  name: string;
}

export interface LearningSessionSectionRefRaw {
  publicUuid: string;
  name: string;
  gradeName?: string | null;
}

export interface LearningSessionPeriodRefRaw {
  publicUuid: string;
  periodType: string;
  ordinal: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface LearningSessionAssignmentRefRaw {
  publicUuid: string;
  teacher: LearningSessionTeacherRefRaw;
  course: LearningSessionCourseRefRaw;
  section: LearningSessionSectionRefRaw;
  period: LearningSessionPeriodRefRaw;
}

export interface LearningSessionUnitRefRaw {
  publicUuid: string;
  name: string;
  displayOrder: number;
}

export interface LearningSessionCompetencyRefRaw {
  publicUuid: string;
  code: string;
  name: string;
}

export interface LearningSessionCapacityRefRaw {
  publicUuid: string;
  code: string;
  name: string;
  competencyPublicUuid: string;
}

export interface SessionContentDtoRaw {
  objective: string;
  activities: string[];
  materials: string[];
  observations: string;
}

export interface LearningSessionResponseRaw {
  publicUuid: string;
  version: number;
  assignment: LearningSessionAssignmentRefRaw;
  unit: LearningSessionUnitRefRaw;
  title: string;
  objective: string;
  scheduledDate: string;
  durationMinutes: number;
  status: SessionStatus;
  content: SessionContentDtoRaw;
  competencies: LearningSessionCompetencyRefRaw[];
  capacities: LearningSessionCapacityRefRaw[];
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sharedWithGrade?: boolean;
}

export interface SharedLearningSessionRaw {
  publicUuid: string;
  title: string;
  objective: string | null;
  scheduledDate: string;
  durationMinutes: number;
  activities: string[];
  materials: string[];
  competencies: string[];
  authorName: string | null;
  sectionName: string | null;
  gradeName: string | null;
  courseCode: string | null;
  coursePublicUuid: string;
  periodPublicUuid: string;
}

// =============================================================================
// UI shapes
// =============================================================================

export interface LearningSessionRow {
  publicUuid: string;
  version: number;
  title: string;
  scheduledDate: Date;
  durationMinutes: number;
  status: SessionStatus;
  startedAt?: Date;
  endedAt?: Date;
  cancelledAt?: Date;
  teacherName: string;
  courseCode: string;
  sectionName: string;
  unitName: string;
  unitDisplayOrder: number;
}

export interface LearningSessionDetail {
  publicUuid: string;
  version: number;
  assignment: {
    publicUuid: string;
    teacher: { publicUuid: string; firstName: string; lastName: string };
    course: { publicUuid: string; code: string; name: string };
    section: { publicUuid: string; name: string; gradeName?: string | null };
    period: {
      publicUuid: string;
      periodType: string;
      ordinal: number;
      name: string;
      startDate: Date;
      endDate: Date;
    };
  };
  unit: { publicUuid: string; name: string; displayOrder: number };
  title: string;
  objective: string;
  scheduledDate: Date;
  durationMinutes: number;
  status: SessionStatus;
  content: {
    objective: string;
    activities: string[];
    materials: string[];
    observations: string;
  };
  competencies: { publicUuid: string; code: string; name: string }[];
  capacities: { publicUuid: string; code: string; name: string; competencyPublicUuid: string }[];
  startedAt?: Date;
  endedAt?: Date;
  cancelledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  sharedWithGrade: boolean;
}

export interface SharedLearningSession {
  publicUuid: string;
  title: string;
  objective: string;
  scheduledDate: string;
  durationMinutes: number;
  activities: string[];
  materials: string[];
  competencies: string[];
  authorName: string;
  sectionName: string;
  gradeName: string;
  courseCode: string;
  coursePublicUuid: string;
  periodPublicUuid: string;
}

// =============================================================================
// Request & Filter shapes
// =============================================================================

export interface LearningSessionFilters {
  teacherUuid?: string;
  sectionUuid?: string;
  unitUuid?: string;
  periodUuid?: string;
  status?: SessionStatus;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
}

export interface CreateLearningSessionRequest {
  assignmentUuid: string;
  unitUuid: string;
  title: string;
  objective: string;
  scheduledDate: string; // YYYY-MM-DD
  durationMinutes: number;
  competencyUuids: string[];
  capacityUuids: string[];
  content?: {
    objective: string;
    activities: string[];
    materials: string[];
    observations: string;
  };
  /** Optional tenant session template UUID. */
  templateUuid?: string | null;
  applicationSheets?: ApplicationSheetWrite[];
}

export interface UpdateLearningSessionRequest {
  title?: string;
  objective?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  competencyUuids?: string[];
  capacityUuids?: string[];
  content?: {
    objective: string;
    activities: string[];
    materials: string[];
    observations: string;
  };
  sharedWithGrade?: boolean;
  applicationSheets?: ApplicationSheetWrite[];
}

export interface CopyLearningSessionRequest {
  assignmentUuid: string;
  scheduledDate: string;
}

export type ApplicationSheetKind = 'LEARNING' | 'DIAGNOSTIC';

export interface SheetItem {
  kind: 'LINE' | 'CHECKBOX' | 'CHOICE' | string;
  prompt: string;
  choices?: string[];
}

export interface ApplicationSheetContent {
  warmup?: { prompt: string; options: string[] };
  purpose?: { purpose: string; evidence: string; criterion: string };
  activities?: { title: string; moment?: string; instruction?: string; items: SheetItem[] }[];
  selfAssessment?: { prompt?: string; columns: string[]; rows: string[] };
  reflection?: { questions: SheetItem[] };
  closingMessage?: string;
  subtitle?: string;
  situation?: string;
  competencyMatrix?: { competency: string; criterion: string }[];
  tasks?: { competency?: string; title: string; stimulus?: string; items: SheetItem[] }[];
  achievementLevels?: { competency: string; logro: string; proceso: string; inicio: string }[];
  teacherComment?: boolean;
}

export interface ApplicationSheetWrite {
  kind: ApplicationSheetKind;
  grade: string;
  title: string;
  content: ApplicationSheetContent;
}

export interface ApplicationSheetView extends ApplicationSheetWrite {
  publicUuid?: string;
  sheetNumber?: number;
}

export interface GenerateApplicationSheetRequest {
  kind: ApplicationSheetKind;
  grade: string;
  courseName: string;
  topic?: string;
  sessionTitle: string;
  sessionSummary?: string;
  activities: { phase?: string; name: string; description?: string }[];
  competencyNames?: string[];
  evaluationCriteria?: { name: string; description?: string }[];
}

export interface LifecycleRequest {
  version: number;
  reason?: string;
}
