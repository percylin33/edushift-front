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
