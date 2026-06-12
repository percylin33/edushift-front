/**
 * Mirror of the backend `AttendanceSession` aggregate (Sprint 6 / FE-6.1).
 *
 * <h3>Why a raw + adapted split</h3>
 * The backend returns timestamps as ISO 8601 strings; the UI wants
 * `Date` instances for sorting/formatting and nullable fields surfaced
 * as `undefined` to avoid the truthy-zero footgun. The split keeps the
 * service adapter thin and the consumers (pages, components) reading
 * from a single, opinionated shape.
 */

export type AttendanceSessionSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export type AttendanceSessionStatus = 'ACTIVE' | 'CLOSED';

/** Wire format — exactly what the backend returns. */
export interface AttendanceSessionResponseRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  sectionName?: string | null;
  occurredOn: string;
  slot: AttendanceSessionSlot;
  startsAt: string;
  closedAt?: string | null;
  closedByUserId?: string | null;
  status: AttendanceSessionStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** UI-friendly version. */
export interface AttendanceSession {
  publicUuid: string;
  sectionPublicUuid: string;
  sectionName?: string;
  occurredOn: Date;
  slot: AttendanceSessionSlot;
  startsAt: Date;
  closedAt?: Date;
  closedByUserId?: string;
  status: AttendanceSessionStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Body of `POST /v1/attendance/sessions`. */
export interface CreateSessionRequest {
  sectionPublicUuid: string;
  slot: AttendanceSessionSlot;
  /** `yyyy-MM-dd` — backend tolerates ISO instant; we keep the strict form. */
  occurredOn: string;
}

/**
 * Slim wire format returned by `GET /v1/attendance/sessions`
 * (Sprint 6 / BE-6.7).
 *
 * <p>Lighter than {@link AttendanceSessionResponseRaw}: the
 * counters are nullable (only populated for {@code CLOSED} rows)
 * and {@code sectionName} / {@code sectionGradeName} are first-class
 * fields so the FE can render the "sección" column without a
 * separate fetch.</p>
 */
export interface AttendanceSessionListItemRaw {
  publicUuid: string;
  sectionPublicUuid: string;
  sectionName?: string | null;
  sectionGradeName?: string | null;
  occurredOn: string;
  slot: AttendanceSessionSlot;
  status: AttendanceSessionStatus;
  startsAt: string;
  closedAt?: string | null;
  presentCount?: number | null;
  lateCount?: number | null;
  absentCount?: number | null;
  excusedCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * UI-friendly version of {@link AttendanceSessionListItemRaw}.
 * `sectionLabel` is a pre-computed `gradeName · name` string for
 * convenient table rendering.
 */
export interface AttendanceSessionListItem {
  publicUuid: string;
  sectionPublicUuid: string;
  sectionName?: string;
  sectionGradeName?: string;
  sectionLabel: string;
  occurredOn: Date;
  slot: AttendanceSessionSlot;
  status: AttendanceSessionStatus;
  startsAt: Date;
  closedAt?: Date;
  presentCount?: number;
  lateCount?: number;
  absentCount?: number;
  excusedCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
