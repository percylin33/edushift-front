import { InvitationStatus, UserRole } from '@core/enums';

/**
 * RAW backend {@code InvitationResponse} record. Used by both the
 * create endpoint (which includes the {@code token}) and the list
 * endpoint (which strips it deliberately — see {@code InvitationResponse.java}
 * javadoc on {@code withoutToken}).
 *
 * <p>Roles travel as {@code String[]}; we narrow to the typed
 * {@link UserRole} union at the boundary, like {@code UsersApiService}
 * does for the regular user payloads.
 */
export interface InvitationResponseRaw {
  publicUuid: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: InvitationStatus;
  /** Only present on the {@code POST /invitations} response. List endpoints null this out. */
  token: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
}

/**
 * UI-side invitation. Dates parsed once at the boundary so cells don't
 * re-parse on every render; roles narrowed to the typed enum so chips
 * can branch without string compares.
 */
export interface Invitation {
  publicUuid: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Convenience derived field — backend doesn't ship a `fullName` for invitations. */
  fullName: string;
  roles: UserRole[];
  status: InvitationStatus;
  /** Present only on the just-created invitation; falsy on every list row. */
  token?: string;
  expiresAt?: Date;
  acceptedAt?: Date;
  cancelledAt?: Date;
  createdAt?: Date;
}

/**
 * Body for {@code POST /v1/users/invitations}. Mirrors the backend
 * record exactly. We send {@link UserRole} values directly because the
 * enum string is already the wire format.
 */
export interface CreateInvitationRequest {
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
}

/**
 * Public preflight response — used by the {@code /invitation/:token}
 * accept page (FE-3.3).
 */
export interface InvitationPreflightResponseRaw {
  email: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

export interface InvitationPreflight {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tenantName: string;
}

/**
 * Body for {@code POST /v1/users/invitations/accept}. The recipient's
 * password is the high-entropy local secret; the token must be the
 * same one that came in the URL.
 */
export interface AcceptInvitationRequest {
  token: string;
  password: string;
}
