import { SectionTeacherItem, AssignmentRow } from '@features/teachers/models';
import { ScheduleSlotItem } from '../models';

/** Option for the TimeSlot create/edit assignment dropdown (year-collapsed). */
export interface TimeSlotAssignmentOption {
  /** Representative assignment UUID (lowest period ordinal). */
  publicUuid: string;
  label: string;
  /** All period-scoped assignments for the same teacher × course (± section). */
  relatedAssignmentPublicUuids: string[];
  teacherPublicUuid?: string;
  coursePublicUuid?: string;
  sectionPublicUuid?: string;
}

/** Normalize "08:00" / "08:00:00" for equality checks. */
export function normalizeScheduleTime(value: string): string {
  if (!value) return value;
  const parts = value.split(':');
  return `${(parts[0] ?? '00').padStart(2, '0')}:${(parts[1] ?? '00').padStart(2, '0')}`;
}

/**
 * One dropdown option per (teacher × course), with all period-scoped
 * assignment UUIDs for year-wide TimeSlot replication.
 */
export function groupSectionTeachersAsYearOptions(
  teachers: readonly SectionTeacherItem[],
): TimeSlotAssignmentOption[] {
  type Acc = {
    teacherPublicUuid: string;
    coursePublicUuid: string;
    label: string;
    periodOrdinal: number;
    publicUuid: string;
    related: string[];
  };
  const byKey = new Map<string, Acc>();

  for (const t of teachers) {
    const key = `${t.teacherPublicUuid}|${t.coursePublicUuid}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        teacherPublicUuid: t.teacherPublicUuid,
        coursePublicUuid: t.coursePublicUuid,
        label: `${t.courseCode} — ${t.courseName} · ${t.teacherFullName}`,
        periodOrdinal: t.periodOrdinal,
        publicUuid: t.assignmentPublicUuid,
        related: [t.assignmentPublicUuid],
      });
      continue;
    }
    if (!existing.related.includes(t.assignmentPublicUuid)) {
      existing.related.push(t.assignmentPublicUuid);
    }
    if (t.periodOrdinal < existing.periodOrdinal) {
      existing.periodOrdinal = t.periodOrdinal;
      existing.publicUuid = t.assignmentPublicUuid;
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    .map((g) => ({
      publicUuid: g.publicUuid,
      label: g.label,
      relatedAssignmentPublicUuids: g.related,
      teacherPublicUuid: g.teacherPublicUuid,
      coursePublicUuid: g.coursePublicUuid,
    }));
}

/**
 * One dropdown option per (section × course) for a teacher's assignment list.
 */
export function groupTeacherAssignmentsAsYearOptions(
  assignments: readonly AssignmentRow[],
): TimeSlotAssignmentOption[] {
  type Acc = {
    sectionPublicUuid: string;
    coursePublicUuid: string;
    label: string;
    periodOrdinal: number;
    publicUuid: string;
    related: string[];
  };
  const byKey = new Map<string, Acc>();

  for (const a of assignments) {
    const key = `${a.sectionPublicUuid}|${a.coursePublicUuid}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        sectionPublicUuid: a.sectionPublicUuid,
        coursePublicUuid: a.coursePublicUuid,
        label: `${a.courseCode} — ${a.courseName} · ${a.sectionName}`,
        periodOrdinal: a.periodOrdinal,
        publicUuid: a.publicUuid,
        related: [a.publicUuid],
      });
      continue;
    }
    if (!existing.related.includes(a.publicUuid)) {
      existing.related.push(a.publicUuid);
    }
    if (a.periodOrdinal < existing.periodOrdinal) {
      existing.periodOrdinal = a.periodOrdinal;
      existing.publicUuid = a.publicUuid;
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    .map((g) => ({
      publicUuid: g.publicUuid,
      label: g.label,
      relatedAssignmentPublicUuids: g.related,
      coursePublicUuid: g.coursePublicUuid,
      sectionPublicUuid: g.sectionPublicUuid,
    }));
}

/**
 * Collapse identical weekly blocks that were replicated across bimestres
 * so the grid shows one card per (course × teacher × day × window).
 */
export function dedupeYearScheduleSlots(
  slots: readonly ScheduleSlotItem[],
): ScheduleSlotItem[] {
  const byKey = new Map<string, ScheduleSlotItem>();

  for (const slot of slots) {
    const teacherId = slot.teacher?.publicUuid ?? '';
    const sectionId = slot.section?.publicUuid ?? '';
    const key = [
      slot.course.publicUuid,
      teacherId,
      sectionId,
      String(slot.dayOfWeek),
      normalizeScheduleTime(slot.startTime),
      normalizeScheduleTime(slot.endTime),
    ].join('|');

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, slot);
      continue;
    }
    const prevOrd = prev.period?.ordinal ?? Number.MAX_SAFE_INTEGER;
    const nextOrd = slot.period?.ordinal ?? Number.MAX_SAFE_INTEGER;
    if (nextOrd < prevOrd) {
      byKey.set(key, slot);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return normalizeScheduleTime(a.startTime).localeCompare(
      normalizeScheduleTime(b.startTime),
    );
  });
}

/** Slots that share the same weekly pattern as {@code pivot} (across periods). */
export function findSiblingYearSlots(
  allSlots: readonly ScheduleSlotItem[],
  pivot: ScheduleSlotItem,
): ScheduleSlotItem[] {
  const teacherId = pivot.teacher?.publicUuid ?? '';
  const sectionId = pivot.section?.publicUuid ?? '';
  const start = normalizeScheduleTime(pivot.startTime);
  const end = normalizeScheduleTime(pivot.endTime);
  return allSlots.filter((s) => {
    const sameCourse = s.course.publicUuid === pivot.course.publicUuid;
    const sameTeacher = (s.teacher?.publicUuid ?? '') === teacherId;
    const sameSection = (s.section?.publicUuid ?? '') === sectionId;
    const sameDay = s.dayOfWeek === pivot.dayOfWeek;
    const sameWindow =
      normalizeScheduleTime(s.startTime) === start &&
      normalizeScheduleTime(s.endTime) === end;
    return sameCourse && sameTeacher && sameSection && sameDay && sameWindow;
  });
}
