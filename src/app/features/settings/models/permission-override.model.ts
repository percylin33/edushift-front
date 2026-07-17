import { UserRole } from '@core/enums';

/**
 * D1 / F0.5 — Outbound shape for {@code GET /v1/tenants/me/permission-overrides}.
 *
 * See {@code docs/qa/12-custom-permissions-feature.md} §G.2 for the
 * field semantics (tri-state: platform default on/off vs explicit
 * TA override on/off).
 */
export interface RolePermissionOverrideResponse {
  publicUuid: string | null;
  role: UserRole;
  authority: string;
  granted: boolean;
  isOverride: boolean;
  updatedAt: string | null;
}

/**
 * D1 / F0.5 — Body for {@code PUT /v1/tenants/me/permission-overrides}.
 */
export interface UpsertPermissionOverrideRequest {
  role: UserRole;
  authority: string;
  granted: boolean;
}
