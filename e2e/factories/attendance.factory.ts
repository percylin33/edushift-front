import { APIRequestContext } from '@playwright/test';
import { CreatedEntity, seqId } from './_shared';

/**
 * Factories for the attendance module:
 *   - {@link makeAttendanceSession} — POST /attendance/sessions
 *   - {@link makeAttendanceRecord} — POST /attendance/sessions/{uuid}/check-in
 *   - {@link makeManualCheckIn} — POST /attendance/manual-check-in
 *
 * Used by attendance UI + RBAC + tenant-isolation specs.
 */

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export async function makeAttendanceSession(
  api: APIRequestContext,
  args: {
    sectionPublicUuid: string;
    occurredOn?: string;            // ISO yyyy-MM-dd
    slot?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'FULL_DAY';
    startsAt?: string;
    notes?: string;
  },
): Promise<CreatedEntity> {
  const id = seqId('att');
  const payload = {
    sectionPublicUuid: args.sectionPublicUuid,
    occurredOn: args.occurredOn ?? new Date().toISOString().slice(0, 10),
    slot: args.slot ?? 'FULL_DAY',
    startsAt: args.startsAt,
    notes: args.notes ?? `auto ${id}`,
  };
  const res = await api.post('/api/v1/attendance/sessions', { data: payload });
  if (!res.ok()) {
    throw new Error(`makeAttendanceSession failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.patch(`/api/v1/attendance/sessions/${publicUuid}/close`);
    },
  };
}

/**
 * Manually register a check-in for a student in an attendance session.
 * Returns the check-in record's publicUuid (different from the session).
 */
export async function makeManualCheckIn(
  api: APIRequestContext,
  args: {
    sessionPublicUuid: string;
    studentPublicUuid: string;
    status?: AttendanceStatus;
  },
): Promise<CreatedEntity> {
  const payload = {
    studentPublicUuid: args.studentPublicUuid,
    status: args.status ?? 'PRESENT',
  };
  const res = await api.post(`/api/v1/attendance/sessions/${args.sessionPublicUuid}/check-in`, {
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`makeManualCheckIn failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload,
    cleanup: async () => {
      await api.delete(`/api/v1/attendance/records/${publicUuid}`).catch(() => undefined);
    },
  };
}

/**
 * Justify an existing attendance record. Used by the PARENT / STUDENT
 * self-service justification flows.
 */
export async function makeJustification(
  api: APIRequestContext,
  args: { recordPublicUuid: string; reason: string },
): Promise<CreatedEntity> {
  const res = await api.post(`/api/v1/attendance/records/${args.recordPublicUuid}/justify`, {
    data: { reason: args.reason },
  });
  if (!res.ok()) {
    throw new Error(`makeJustification failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const publicUuid: string = body.data.publicUuid;
  return {
    publicUuid,
    payload: { recordPublicUuid: args.recordPublicUuid, reason: args.reason },
    cleanup: async () => {
      // Approving the justification is a separate endpoint — no
      // delete-pending path. Cleanup is a no-op for this handle.
    },
  };
}
