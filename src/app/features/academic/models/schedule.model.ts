// =============================================================================
// Raw wire shapes — espejo 1:1 del backend (BE-5A.3)
// =============================================================================

export interface ScheduleTeacherRefRaw {
  publicUuid: string;
  firstName: string;
  lastName: string;
}

export interface ScheduleCourseRefRaw {
  publicUuid: string;
  code: string;
  name: string;
}

export interface ScheduleSectionRefRaw {
  publicUuid: string;
  name: string;
}

export interface SchedulePeriodRefRaw {
  publicUuid: string;
  periodType: string;
  ordinal: number;
  name: string;
}

/**
 * RAW backend {@code ScheduleSlotItem}.
 * Devuelto por los reverse views:
 * - {@code GET /v1/teachers/{t}/schedule} (teacher es null)
 * - {@code GET /v1/academic/sections/{s}/schedule} (section es null)
 */
export interface ScheduleSlotItemRaw {
  slotPublicUuid: string;
  assignmentPublicUuid: string;
  dayOfWeek: number;
  startTime: string; // "08:00:00"
  endTime: string; // "09:00:00"
  classroom: string | null;
  teacher: ScheduleTeacherRefRaw | null;
  course: ScheduleCourseRefRaw;
  section: ScheduleSectionRefRaw | null;
  period: SchedulePeriodRefRaw;
}

export interface TimeSlotResponseRaw {
  publicUuid: string;
  assignmentPublicUuid: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroom: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// UI shapes
// =============================================================================

export interface ScheduleSlotItem {
  slotPublicUuid: string;
  assignmentPublicUuid: string;
  dayOfWeek: number; // 1 (Lunes) a 7 (Domingo)
  startTime: string;
  endTime: string;
  classroom?: string;
  teacher?: ScheduleTeacherRefRaw;
  course: ScheduleCourseRefRaw;
  section?: ScheduleSectionRefRaw;
  period: SchedulePeriodRefRaw;
}

export interface TimeSlotDetail {
  publicUuid: string;
  assignmentPublicUuid: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroom?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// =============================================================================
// Request shapes
// =============================================================================

export interface CreateTimeSlotRequest {
  dayOfWeek: number;
  startTime: string; // "08:00"
  endTime: string; // "09:00"
  classroom?: string;
}

export interface UpdateTimeSlotRequest {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  classroom?: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export function formatTime(time: string): string {
  if (!time) return '';
  // Asume formato "HH:mm:ss" o "HH:mm"
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return time;
}

export function toScheduleSlotItem(raw: ScheduleSlotItemRaw): ScheduleSlotItem {
  return {
    slotPublicUuid: raw.slotPublicUuid,
    assignmentPublicUuid: raw.assignmentPublicUuid,
    dayOfWeek: raw.dayOfWeek,
    startTime: raw.startTime,
    endTime: raw.endTime,
    classroom: raw.classroom ?? undefined,
    teacher: raw.teacher ?? undefined,
    course: raw.course,
    section: raw.section ?? undefined,
    period: raw.period,
  };
}

// =============================================================================
// Day templates / jornada / workload (schedule module)
// =============================================================================

export type DayBlockType =
  | 'RECESS'
  | 'LUNCH'
  | 'ASSEMBLY'
  | 'GUIDANCE'
  | 'SPECIALIST_RESERVED';

export type RecessPolicy = 'SHARED' | 'STAGGERED';

export const DAY_BLOCK_TYPE_LABELS: Readonly<Record<DayBlockType, string>> = {
  RECESS: 'Recreo',
  LUNCH: 'Almuerzo',
  ASSEMBLY: 'Asamblea',
  GUIDANCE: 'Tutoría',
  SPECIALIST_RESERVED: 'Especialista (reservado)',
};

export const RECESS_POLICY_LABELS: Readonly<Record<RecessPolicy, string>> = {
  SHARED: 'Compartido',
  STAGGERED: 'Escalonado',
};

/** Non-teaching block in reverse week views (recess/lunch/assembly). */
export interface NonTeachingBlockItem {
  blockPublicUuid: string;
  /** Null = applies to all weekdays (Mon–Fri). */
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  blockType: DayBlockType;
  label: string;
  levelCode: string | null;
  gradeName: string | null;
}

/** Suggested academic period (empty cell) from day plan metadata. */
export interface SuggestedPeriodItem {
  ordinal: number;
  startTime: string;
  endTime: string;
  label: string;
}

/** Unified weekly schedule: teaching slots + non-teaching blocks + suggested periods. */
export interface ScheduleWeekView {
  slots: ScheduleSlotItem[];
  nonTeachingBlocks: NonTeachingBlockItem[];
  dayStart?: string | null;
  dayEnd?: string | null;
  periodMinutes?: number | null;
  suggestedPeriods: SuggestedPeriodItem[];
}

export interface ScheduleWeekViewRaw {
  slots: ScheduleSlotItemRaw[];
  nonTeachingBlocks: NonTeachingBlockItem[];
  dayStart?: string | null;
  dayEnd?: string | null;
  periodMinutes?: number | null;
  suggestedPeriods?: SuggestedPeriodItem[];
}

export function toScheduleWeekView(raw: ScheduleWeekViewRaw | null | undefined): ScheduleWeekView {
  return {
    slots: (raw?.slots ?? []).map(toScheduleSlotItem),
    nonTeachingBlocks: raw?.nonTeachingBlocks ?? [],
    dayStart: raw?.dayStart ?? null,
    dayEnd: raw?.dayEnd ?? null,
    periodMinutes: raw?.periodMinutes ?? null,
    suggestedPeriods: raw?.suggestedPeriods ?? [],
  };
}

export interface DayBlockItem {
  publicUuid: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  blockType: DayBlockType;
  label: string;
}

export interface DayTemplate {
  publicUuid: string;
  yearUuid: string;
  levelUuid: string;
  levelCode: string;
  gradeUuid: string | null;
  gradeName: string | null;
  shift: string | null;
  name: string;
  recessShareGroup: string | null;
  dayStart?: string | null;
  dayEnd?: string | null;
  periodMinutes?: number | null;
  blocks: DayBlockItem[];
}

export interface ScheduleSettings {
  recessPolicy: RecessPolicy;
  shareGroupLevelCodes: string[];
}

export interface TeacherWorkloadItem {
  teacherPublicUuid: string;
  firstName: string;
  lastName: string;
  minutesPerWeek: number;
  slotCount: number;
  sectionCount: number;
  courseCount: number;
}

export interface ScheduleWarningItem {
  code: string;
  severity: string;
  message: string;
  sectionUuid: string | null;
  gradeUuid: string | null;
  teacherUuid: string | null;
}

export interface ScheduleSourceDocument {
  publicUuid: string;
  yearUuid: string;
  kind: string;
  parseStatus: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  parsedDraftJson: Record<string, unknown> | null;
  parseError: string | null;
  createdAt: string;
}

export interface CreateDayTemplateRequest {
  yearUuid: string;
  levelUuid: string;
  gradeUuid?: string | null;
  shift?: string | null;
  name: string;
  recessShareGroup?: string | null;
}

export interface UpdateDayTemplateRequest {
  shift?: string | null;
  name?: string | null;
  recessShareGroup?: string | null;
  dayStart?: string | null;
  dayEnd?: string | null;
  periodMinutes?: number | null;
}

/** Body of POST …/day-templates/{uuid}/apply-day-plan (ADR-SCH-12). */
export interface ApplyDayPlanRequest {
  dayStart: string;
  dayEnd: string;
  periodMinutes: number;
  recesses: { startTime: string; endTime: string; label?: string }[];
  lunch?: { startTime: string; endTime: string; label?: string } | null;
}

export interface CreateDayBlockRequest {
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  blockType: DayBlockType;
  label: string;
}

export interface UpdateDayBlockRequest {
  dayOfWeek?: number | null;
  startTime?: string;
  endTime?: string;
  blockType?: DayBlockType;
  label?: string;
}

export interface UpdateScheduleSettingsRequest {
  recessPolicy?: RecessPolicy;
  shareGroupLevelCodes?: string[];
}

export interface CloneScheduleRequest {
  sourceYearUuid: string;
  includeTimeSlots: boolean;
}

/** Weekdays Mon–Fri used when a non-teaching block has null dayOfWeek. */
export const WEEKDAY_VALUES = [1, 2, 3, 4, 5] as const;
