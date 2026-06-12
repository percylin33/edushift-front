/**
 * Mirror of the backend `ManualCheckInRequest` DTO
 * (Sprint 6 / BE-6.8 — manual fallback).
 *
 * <p>Used by `POST /v1/attendance/manual-check-in`. The backend
 * auto-resolves the target session from the student's current ACTIVE
 * enrollment, so the FE only needs to send the student UUID. The
 * optional fields exist mainly for the admin UX (override the resolved
 * slot/day or force a status).
 */
import { AttendanceRecordStatus } from './attendance-record.model';
import { AttendanceSessionSlot } from './attendance-session.model';

export interface ManualCheckInRequest {
  studentPublicUuid: string;
  /**
   * Optional override for the slot. When omitted, the backend infers
   * {@code MORNING} before noon and {@code AFTERNOON} otherwise.
   */
  slot?: AttendanceSessionSlot;
  /**
   * Optional override for the day. When omitted, the backend defaults
   * to today (`LocalDate.now()` server-side).
   */
  occurredOn?: string;
  /** Optional override for the precise scan instant (ISO-8601). */
  occurredAt?: string;
  /**
   * TENANT_ADMIN-only override that bypasses the PRESENT/LATE
   * computation. Mirrors the same field on the QR check-in flow.
   */
  forcedStatus?: AttendanceRecordStatus;
}
