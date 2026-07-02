/**
 * Mirror of the backend `AttendanceRecord` aggregate (Sprint 6 / FE-6.1).
 *
 * <h3>Idempotency</h3>
 * The backend's `POST /sessions/{id}/check-in` is idempotent: a second
 * scan of the same student within the same session returns the
 * pre-existing record with `wasIdempotent: true` on the wrapping
 * envelope. The adapter extracts the inner record and preserves the
 * flag on a separate signal so the UI can show a different feedback
 * chip ("Ya marcado a las HH:MM") vs. a fresh check-in ("PRESENTE").
 */

export type AttendanceRecordStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface AttendanceRecordResponseRaw {
  publicUuid: string;
  sessionPublicUuid: string;
  studentPublicUuid: string;
  studentFullName?: string | null;
  studentDocumentNumber?: string | null;
  status: AttendanceRecordStatus;
  occurredAt: string;
  scannedByUserId?: string | null;
  editedByUserId?: string | null;
  editedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  publicUuid: string;
  sessionPublicUuid: string;
  studentPublicUuid: string;
  studentFullName?: string;
  studentDocumentNumber?: string;
  status: AttendanceRecordStatus;
  occurredAt: Date;
  scannedByUserId?: string;
  editedByUserId?: string;
  editedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Body of `PUT /v1/attendance/records/{publicUuid}`. */
export interface UpdateRecordRequest {
  status: AttendanceRecordStatus;
  notes?: string;
}
