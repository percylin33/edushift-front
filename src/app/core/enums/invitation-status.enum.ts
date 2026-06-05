/**
 * Computed lifecycle of a user invitation. Mirrors the backend
 * {@code InvitationStatus} enum verbatim — the value is derived
 * server-side from the {@code (acceptedAt, cancelledAt, expiresAt)}
 * trio and shipped as one of these four labels.
 *
 * <p>Treat the value as read-only on the client: there is no PATCH
 * endpoint to flip it; only {@code cancel} (PENDING → CANCELLED) and
 * {@code accept} (PENDING → ACCEPTED). EXPIRED is purely time-driven.
 */
export enum InvitationStatus {
  Pending   = 'PENDING',
  Accepted  = 'ACCEPTED',
  Cancelled = 'CANCELLED',
  Expired   = 'EXPIRED'
}
