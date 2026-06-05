import { UserRole, UserStatus } from '@core/enums';

/**
 * RAW backend {@code UserListItem} record returned by
 * {@code GET /v1/users}. Mirrors {@code UserListItem.java} verbatim:
 * roles travel as a plain {@code String[]} and timestamps as ISO 8601
 * instants. We only narrow the shape into {@link UserRow} (typed roles
 * + Date) once the response is in.
 */
export interface UserListItemRaw {
  publicUuid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  status: UserStatus;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string | null;
}

/**
 * RAW backend {@code UserDetailResponse} record returned by
 * {@code GET /v1/users/{publicUuid}}. Adds the security flags, phone,
 * avatar and {@code updatedAt} that the list view doesn't carry.
 */
export interface UserDetailResponseRaw {
  publicUuid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * UI-side row shape used by the list table and store. Roles narrowed to
 * the typed {@link UserRole} enum so consumers can branch on them
 * without string compares; timestamps parsed once at the boundary so
 * components don't keep re-parsing.
 */
export interface UserRow {
  publicUuid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  status: UserStatus;
  roles: UserRole[];
  lastLoginAt?: Date;
  createdAt?: Date;
}

/**
 * UI-side detail shape (superset of {@link UserRow}) used by the detail
 * page and edit form.
 */
export interface UserDetail extends UserRow {
  phone?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  updatedAt?: Date;
}

/**
 * Filter set sent to {@code GET /v1/users}. Every field is optional;
 * blanks / undefined are dropped before serialization so the URL stays
 * clean for caching and for the network panel.
 */
export interface UserListFilters {
  search?: string;
  status?: UserStatus;
  role?: UserRole;
}

/**
 * Pagination + sort hint sent to the backend. {@code page} is
 * zero-based to match Spring's {@code Pageable}; {@code sort} uses the
 * Spring shorthand ({@code "field,DIR"}). Defaults applied at the
 * service if omitted.
 */
export interface UserListPagination {
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Patch payload for {@code PATCH /v1/users/{publicUuid}}. The backend
 * treats {@code null} as "no change" (not "clear") — we forward
 * {@code undefined} as omitted property so JSON serialization drops
 * the key entirely.
 */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}

/**
 * Wholesale role replacement for {@code POST /v1/users/{publicUuid}/roles}.
 *
 * <p>The backend's {@code AssignRolesRequest} record carries a
 * {@code Set<String>} of role names; {@link UserRole} is already the
 * exact wire string, so we send the enum values directly.
 */
export interface AssignRolesRequest {
  roles: UserRole[];
}
