/**
 * Mirror of the backend `StudentAttendanceQr` aggregate (Sprint 6 / FE-6.1).
 *
 * <h3>Where the JWT lives</h3>
 * The raw JWT token (`qrToken`) is **not** stored on this type: it
 * is downloaded as binary (`image/png` or `image/svg+xml`) and
 * rendered directly by the print/export flow. The metadata below is
 * what the UI needs to drive the "rotate / reissue" CTA and to render
 * "QR emitido hace 3 días" hints in the credential card.
 */

export type QrRevokedReason =
  | 'STUDENT_REQUEST'
  | 'ADMIN_ROTATION'
  | 'COMPROMISED'
  | 'GRADUATED'
  | 'WITHDRAWN';

export interface AttendanceQrInfoResponseRaw {
  publicUuid: string;
  studentPublicUuid: string;
  version: number;
  issuedAt: string;
  revokedAt?: string | null;
  revokedReason?: QrRevokedReason | null;
  lastRotatedAt?: string | null;
  active: boolean;
}

export interface AttendanceQrInfo {
  publicUuid: string;
  studentPublicUuid: string;
  version: number;
  issuedAt: Date;
  revokedAt?: Date;
  revokedReason?: QrRevokedReason;
  lastRotatedAt?: Date;
  active: boolean;
}

/** Body of `POST /v1/attendance/sessions/{id}/check-in`. */
export interface CheckInRequest {
  qrToken: string;
  sessionPublicUuid: string;
}
