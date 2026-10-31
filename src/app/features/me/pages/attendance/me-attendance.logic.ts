import {
  MeAttendanceRecord,
  MeAttendanceStatus,
  MeJustificationStatus,
} from '../../models/me-attendance.model';

export type MeAttendanceView = 'calendar' | 'list' | 'history';

export interface MeAttendanceSummary {
  readonly total: number;
  readonly ratePercent: number | null;
  readonly attended: number;
  readonly late: number;
  readonly latePending: number;
  readonly lateToRegularize: number;
  readonly absences: number;
  readonly justifiedAbsences: number;
  readonly pendingAbsences: number;
  readonly rejectedAbsences: number;
  readonly absencesToRegularize: number;
}

export interface MeAttendanceDayGroup {
  readonly dateKey: string;
  readonly records: readonly MeAttendanceRecord[];
  readonly worst: MeAttendanceStatus;
}

export interface MeAttendanceCalendarCell {
  readonly dateKey: string;
  readonly day: number;
  readonly inMonth: boolean;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const SEVERITY: Record<MeAttendanceStatus, number> = {
  ABSENT: 4,
  LATE: 3,
  EXCUSED: 2,
  PRESENT: 1,
};

export function attendanceMonthLabel(month: number): string {
  return MONTHS[month - 1] ?? '';
}

export function localDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDayTitle(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAYS[date.getDay()] ?? '';
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${label}, ${day} de ${MONTHS[month - 1] ?? ''}`;
}

export function formatRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

/** A rejected request cannot be sent again: the API rejects any existing justification. */
export function canSubmitJustification(record: MeAttendanceRecord): boolean {
  return (
    (record.status === 'ABSENT' || record.status === 'LATE') && record.justificationStatus == null
  );
}

export function countsTowardRate(record: MeAttendanceRecord): boolean {
  return (
    record.status === 'PRESENT' ||
    record.status === 'EXCUSED' ||
    record.justificationStatus === 'APPROVED'
  );
}

/** Approved absences read as justified. A late mark stays a late mark. */
export function displayStatus(record: MeAttendanceRecord): MeAttendanceStatus {
  if (record.status === 'ABSENT' && record.justificationStatus === 'APPROVED') {
    return 'EXCUSED';
  }
  return record.status;
}

export function statusLabel(status: MeAttendanceStatus): string {
  switch (status) {
    case 'PRESENT':
      return 'Presente';
    case 'LATE':
      return 'Tardanza';
    case 'ABSENT':
      return 'Falta';
    case 'EXCUSED':
      return 'Justificada';
  }
}

export function justificationLabel(status: MeJustificationStatus | null): string {
  switch (status) {
    case 'PENDING':
      return 'Pendiente de revisión';
    case 'APPROVED':
      return 'Aprobada';
    case 'REJECTED':
      return 'Rechazada';
    default:
      return 'Sin solicitud';
  }
}

export function statusBadgeClass(status: MeAttendanceStatus): string {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    case 'LATE':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    case 'ABSENT':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
    case 'EXCUSED':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300';
  }
}

export function summarizeMeAttendance(records: readonly MeAttendanceRecord[]): MeAttendanceSummary {
  let attended = 0;
  let late = 0;
  let latePending = 0;
  let lateToRegularize = 0;
  let absences = 0;
  let justifiedAbsences = 0;
  let pendingAbsences = 0;
  let rejectedAbsences = 0;
  let absencesToRegularize = 0;
  let rateHits = 0;

  for (const record of records) {
    if (countsTowardRate(record)) {
      rateHits += 1;
    }
    if (record.status === 'PRESENT' || record.status === 'LATE') {
      attended += 1;
    }
    if (record.status === 'LATE') {
      late += 1;
      if (record.justificationStatus === 'PENDING') {
        latePending += 1;
      } else if (record.justificationStatus == null) {
        lateToRegularize += 1;
      }
    }
    if (record.status === 'ABSENT' || record.status === 'EXCUSED') {
      absences += 1;
      if (record.status === 'EXCUSED' || record.justificationStatus === 'APPROVED') {
        justifiedAbsences += 1;
      } else if (record.justificationStatus === 'PENDING') {
        pendingAbsences += 1;
      } else if (record.justificationStatus === 'REJECTED') {
        rejectedAbsences += 1;
      } else {
        absencesToRegularize += 1;
      }
    }
  }

  const total = records.length;
  return {
    total,
    ratePercent: total === 0 ? null : Math.round((rateHits * 1000) / total) / 10,
    attended,
    late,
    latePending,
    lateToRegularize,
    absences,
    justifiedAbsences,
    pendingAbsences,
    rejectedAbsences,
    absencesToRegularize,
  };
}

export function sortByOccurredAt(
  records: readonly MeAttendanceRecord[],
  direction: 'asc' | 'desc',
): MeAttendanceRecord[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...records].sort(
    (a, b) => factor * (new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
  );
}

export function worstStatus(records: readonly MeAttendanceRecord[]): MeAttendanceStatus {
  return records.reduce((worst, record) => {
    const current = displayStatus(record);
    return SEVERITY[current] > SEVERITY[worst] ? current : worst;
  }, displayStatus(records[0]));
}

export function groupAttendanceByDay(
  records: readonly MeAttendanceRecord[],
): ReadonlyMap<string, MeAttendanceDayGroup> {
  const buckets = new Map<string, MeAttendanceRecord[]>();
  for (const record of records) {
    const key = localDateKey(record.occurredAt);
    const list = buckets.get(key);
    if (list) {
      list.push(record);
    } else {
      buckets.set(key, [record]);
    }
  }
  const grouped = new Map<string, MeAttendanceDayGroup>();
  for (const [dateKey, dayRecords] of buckets) {
    const sorted = sortByOccurredAt(dayRecords, 'asc');
    grouped.set(dateKey, {
      dateKey,
      records: sorted,
      worst: worstStatus(sorted),
    });
  }
  return grouped;
}

export function buildMonthCells(year: number, month: number): MeAttendanceCalendarCell[] {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: MeAttendanceCalendarCell[] = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(toCell(new Date(year, month - 1, 1 - (firstWeekday - index)), false));
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toCell(new Date(year, month - 1, day), true));
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push(toCell(new Date(year, month - 1, daysInMonth + trailing), false));
    trailing += 1;
  }
  return cells;
}

function toCell(date: Date, inMonth: boolean): MeAttendanceCalendarCell {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    dateKey: `${year}-${month}-${day}`,
    day: date.getDate(),
    inMonth,
  };
}
