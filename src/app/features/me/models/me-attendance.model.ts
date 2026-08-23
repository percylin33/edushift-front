export type MeAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type MeJustificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MeAttendanceRecord {
  readonly publicUuid: string;
  readonly sessionPublicUuid: string | null;
  readonly status: MeAttendanceStatus;
  readonly occurredAt: string;
  readonly notes: string | null;
  readonly justificationStatus: MeJustificationStatus | null;
  readonly justificationText: string | null;
  readonly approvedAt: string | null;
}
