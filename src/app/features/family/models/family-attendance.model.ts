import type { AttendanceRecordStatus } from '../../attendance/models/attendance-record.model';

export type FamilyAttendanceJustificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FamilyAttendanceRecordRaw {
  publicUuid: string;
  sessionPublicUuid: string | null;
  studentPublicUuid: string;
  studentFullName: string | null;
  status: AttendanceRecordStatus;
  occurredAt: string;
  notes: string | null;
  justificationStatus: FamilyAttendanceJustificationStatus | null;
  justificationText: string | null;
  approvedAt: string | null;
}

export interface FamilyAttendanceRecord {
  publicUuid: string;
  sessionPublicUuid?: string;
  studentPublicUuid: string;
  studentFullName?: string;
  status: AttendanceRecordStatus;
  occurredAt: Date;
  notes?: string;
  justificationStatus?: FamilyAttendanceJustificationStatus;
  justificationText?: string;
  approvedAt?: Date;
}

export function toFamilyAttendanceRecord(raw: FamilyAttendanceRecordRaw): FamilyAttendanceRecord {
  return {
    publicUuid: raw.publicUuid,
    sessionPublicUuid: raw.sessionPublicUuid ?? undefined,
    studentPublicUuid: raw.studentPublicUuid,
    studentFullName: raw.studentFullName ?? undefined,
    status: raw.status,
    occurredAt: new Date(raw.occurredAt),
    notes: raw.notes ?? undefined,
    justificationStatus: raw.justificationStatus ?? undefined,
    justificationText: raw.justificationText ?? undefined,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt) : undefined,
  };
}
