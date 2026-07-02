/**
 * Lifecycle status of a {@link com.edushift.modules.auth.entity.User}.
 * Mirrors the backend enum (`UserStatus.java`) one-to-one.
 *
 * Only `ACTIVE` users can authenticate; the rest map to specific 401 codes
 * surfaced by the backend (`USER_LOCKED`, `USER_SUSPENDED`, `USER_INACTIVE`,
 * `EMAIL_NOT_VERIFIED`).
 */
export enum UserStatus {
  Active = 'ACTIVE',
  Locked = 'LOCKED',
  Suspended = 'SUSPENDED',
  Inactive = 'INACTIVE',
  PendingVerification = 'PENDING_VERIFICATION',
}
