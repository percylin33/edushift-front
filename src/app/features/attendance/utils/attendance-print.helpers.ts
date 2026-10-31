import { AttendanceRecord, AttendanceSessionListItem } from '../models';
import { AttendancePrintRow } from '../models/attendance-report-params.model';

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Presente',
  LATE: 'Tardanza',
  ABSENT: 'Ausente',
  EXCUSED: 'Justificado',
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Pendiente';
  return STATUS_LABELS[status] ?? status;
}

export function recordsToPrintRows(records: AttendanceRecord[]): AttendancePrintRow[] {
  return records.map((r) => ({
    date: r.occurredAt.toLocaleDateString(),
    studentName: r.studentFullName,
    documentNumber: r.studentDocumentNumber,
    status: statusLabel(r.status),
    time: r.occurredAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    notes: r.notes,
  }));
}

export function sessionsToPrintRows(sessions: AttendanceSessionListItem[]): AttendancePrintRow[] {
  return sessions.map((s) => ({
    date: s.occurredOn.toLocaleDateString(),
    sectionName: s.sectionLabel,
    slot: s.slot,
    status: statusLabel(s.status),
    time: s.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));
}

export interface SimpleAttendanceRow {
  occurredAt: string | Date;
  status: string;
  notes?: string | null;
  justificationText?: string | null;
}

export function simpleRowsToPrintRows(rows: SimpleAttendanceRow[]): AttendancePrintRow[] {
  return rows.map((r) => {
    const d = r.occurredAt instanceof Date ? r.occurredAt : new Date(r.occurredAt);
    return {
      date: d.toLocaleDateString(),
      status: statusLabel(r.status),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: r.notes ?? r.justificationText ?? undefined,
    };
  });
}
