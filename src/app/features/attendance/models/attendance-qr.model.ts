/**
 * Mirror of the backend `AttendanceQrInfo` record (Sprint 6 / FE-6.3).
 *
 * <h3>Where the JWT lives</h3>
 * The raw JWT token (`qrToken`) is **not** stored on this type: it
 * is downloaded as binary (`image/png` or `image/svg+xml`) and
 * rendered directly by the print/export flow. The metadata below is
 * what the UI needs to drive the "rotate / reissue" CTA and to render
 * "QR emitido hace 3 días" hints in the credential card.
 *
 * <h3>Why no `publicUuid` / `version` / `active`</h3>
 * The backend's `student_attendance_qr` table intentionally has no
 * `public_uuid` (see V30 migration comments): the QR is not exposed
 * as a REST resource with its own URL, only rendered as an image.
 * Hence the read-only `/info` endpoint returns just the lifecycle
 * timestamps + the revoked-reason of the previous row when relevant.
 */

export type QrRevokedReason = 'ROTATED' | 'LOST' | 'ADMIN_REVOKE';

export interface AttendanceQrInfoResponseRaw {
  studentPublicUuid: string;
  issuedAt: string;
  previousRevokedAt?: string | null;
  previousRevokedReason?: QrRevokedReason | null;
}

export interface AttendanceQrInfo {
  studentPublicUuid: string;
  issuedAt: Date;
  previousRevokedAt?: Date;
  previousRevokedReason?: QrRevokedReason;
}

/** Body of `POST /v1/attendance/sessions/{id}/check-in`. */
export interface CheckInRequest {
  qrToken: string;
  sessionPublicUuid: string;
}
