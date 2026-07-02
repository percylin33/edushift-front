import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { toAuthSession } from '@core/adapters';
import { API } from '@core/constants';
import { UserRole } from '@core/enums';
import { ApiResponse, AuthResponseRaw, AuthSession, SpringPage } from '@core/models';
import { ApiService } from '@core/services';
import {
  AcceptInvitationRequest,
  AssignRolesRequest,
  CreateInvitationRequest,
  Invitation,
  InvitationPreflight,
  InvitationPreflightResponseRaw,
  InvitationResponseRaw,
  UpdateUserRequest,
  UserDetail,
  UserDetailResponseRaw,
  UserListFilters,
  UserListItemRaw,
  UserListPagination,
  UserRow,
} from '../models';

/**
 * HTTP boundary for the {@code users} management module
 * ({@code /api/v1/users}).
 *
 * <h3>Why an isolated service</h3>
 * State lives in {@link UsersStore}; this layer is the wire layer only.
 * Mirrors the convention already used by {@code AuthApiService} and
 * {@code TenantApiService}: features keep their HTTP shape conversions
 * in one place so consumers (store, pages, guards) work exclusively
 * with project-internal models.
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #list}            → {@code GET /v1/users}</li>
 *   <li>{@link #get}             → {@code GET /v1/users/{publicUuid}}</li>
 *   <li>{@link #update}          → {@code PATCH /v1/users/{publicUuid}}</li>
 *   <li>{@link #assignRoles}     → {@code POST /v1/users/{publicUuid}/roles}</li>
 *   <li>{@link #disable}         → {@code POST /v1/users/{publicUuid}/disable}</li>
 *   <li>{@link #enable}          → {@code POST /v1/users/{publicUuid}/enable}</li>
 *   <li>{@link #resetPassword}   → {@code POST /v1/users/{publicUuid}/reset-password}</li>
 * </ul>
 *
 * Every response is adapted to a UI-friendly shape (typed roles + Date
 * timestamps) before it leaves the service.
 */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly api = inject(ApiService);

  /**
   * Paginated list with optional filters. Returns Spring's native
   * {@code Page<T>} envelope (no {@code ApiResponse} wrap on the list
   * endpoint — the backend deliberately keeps Spring's shape so
   * pagination clients reuse {@code number/size/totalElements} verbatim).
   */
  list(
    filters: UserListFilters = {},
    pagination: UserListPagination = {},
  ): Observable<SpringPage<UserRow>> {
    const params: Record<string, string | number | undefined> = {
      search: filters.search?.trim() || undefined,
      status: filters.status,
      role: filters.role,
      page: pagination.page,
      size: pagination.size,
      sort: pagination.sort,
    };

    return this.api
      .get<SpringPage<UserListItemRaw>>(API.USERS.ROOT, params)
      .pipe(map((page) => this.toUserPage(page)));
  }

  get(publicUuid: string): Observable<UserDetail> {
    return this.api
      .get<ApiResponse<UserDetailResponseRaw>>(API.USERS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toUserDetail(envelope.data)));
  }

  update(publicUuid: string, patch: UpdateUserRequest): Observable<UserDetail> {
    return this.api
      .patch<ApiResponse<UserDetailResponseRaw>, UpdateUserRequest>(
        API.USERS.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => this.toUserDetail(envelope.data)));
  }

  assignRoles(publicUuid: string, request: AssignRolesRequest): Observable<UserDetail> {
    return this.api
      .post<ApiResponse<UserDetailResponseRaw>, AssignRolesRequest>(
        API.USERS.ROLES(publicUuid),
        request,
      )
      .pipe(map((envelope) => this.toUserDetail(envelope.data)));
  }

  disable(publicUuid: string): Observable<UserDetail> {
    return this.api
      .post<ApiResponse<UserDetailResponseRaw>>(API.USERS.DISABLE(publicUuid))
      .pipe(map((envelope) => this.toUserDetail(envelope.data)));
  }

  enable(publicUuid: string): Observable<UserDetail> {
    return this.api
      .post<ApiResponse<UserDetailResponseRaw>>(API.USERS.ENABLE(publicUuid))
      .pipe(map((envelope) => this.toUserDetail(envelope.data)));
  }

  /**
   * 202 Accepted with no body — Sprint 3 just queues the intent. We
   * return {@code void} to keep callers honest about the asynchronous
   * delivery (the actual reset email lands in Sprint 9 once the
   * notifications module is wired).
   */
  resetPassword(publicUuid: string): Observable<void> {
    return this.api.post<void>(API.USERS.RESET_PASSWORD(publicUuid));
  }

  // ===========================================================================
  // Invitations (FE-3.2 / FE-3.3)
  // ===========================================================================

  /**
   * Create an invitation. The response carries the {@code token} so
   * the caller can copy the link to the clipboard immediately —
   * Sprint 9 will swap this for automatic email delivery and the token
   * can disappear from the response then.
   */
  createInvitation(request: CreateInvitationRequest): Observable<Invitation> {
    return this.api
      .post<ApiResponse<InvitationResponseRaw>, CreateInvitationRequest>(
        API.INVITATIONS.ROOT,
        request,
      )
      .pipe(map((envelope) => this.toInvitation(envelope.data)));
  }

  /**
   * Paginated list of pending invitations. Backend default sort is
   * {@code expiresAt ASC} so soon-to-expire ones bubble up; callers
   * can override via {@code pagination.sort}.
   */
  listInvitations(pagination: UserListPagination = {}): Observable<SpringPage<Invitation>> {
    const params: Record<string, string | number | undefined> = {
      page: pagination.page,
      size: pagination.size,
      sort: pagination.sort,
    };
    return this.api
      .get<SpringPage<InvitationResponseRaw>>(API.INVITATIONS.ROOT, params)
      .pipe(map((page) => this.toInvitationPage(page)));
  }

  cancelInvitation(publicUuid: string): Observable<Invitation> {
    return this.api
      .delete<ApiResponse<InvitationResponseRaw>>(API.INVITATIONS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toInvitation(envelope.data)));
  }

  /**
   * Public preflight — no auth required. Used by the
   * {@code /invitation/:token} page to greet the recipient by name
   * and confirm <em>which school</em> they are joining.
   */
  previewInvitation(token: string): Observable<InvitationPreflight> {
    return this.api
      .get<ApiResponse<InvitationPreflightResponseRaw>>(API.INVITATIONS.BY_TOKEN(token))
      .pipe(map((envelope) => this.toPreflight(envelope.data)));
  }

  /**
   * Public accept — no auth required. Returns an {@link AuthSession}
   * so the SPA can drop the recipient straight into the dashboard.
   */
  acceptInvitation(request: AcceptInvitationRequest): Observable<AuthSession> {
    return this.api
      .post<AuthResponseRaw, AcceptInvitationRequest>(API.INVITATIONS.ACCEPT, request)
      .pipe(map(toAuthSession));
  }

  // ---------------------------------------------------------------------------
  // Adapters (raw wire shape → UI model)
  // ---------------------------------------------------------------------------

  private toUserPage(raw: SpringPage<UserListItemRaw>): SpringPage<UserRow> {
    return {
      ...raw,
      content: raw.content.map((row) => this.toUserRow(row)),
    };
  }

  private toUserRow(raw: UserListItemRaw): UserRow {
    return {
      publicUuid: raw.publicUuid,
      email: raw.email,
      firstName: raw.firstName ?? undefined,
      lastName: raw.lastName ?? undefined,
      fullName: raw.fullName,
      status: raw.status,
      roles: this.narrowRoles(raw.roles),
      lastLoginAt: this.parseDate(raw.lastLoginAt),
      createdAt: this.parseDate(raw.createdAt),
    };
  }

  private toUserDetail(raw: UserDetailResponseRaw): UserDetail {
    return {
      publicUuid: raw.publicUuid,
      email: raw.email,
      firstName: raw.firstName ?? undefined,
      lastName: raw.lastName ?? undefined,
      fullName: raw.fullName,
      phone: raw.phone ?? undefined,
      avatarUrl: raw.avatarUrl ?? undefined,
      status: raw.status,
      emailVerified: raw.emailVerified,
      mfaEnabled: raw.mfaEnabled,
      roles: this.narrowRoles(raw.roles),
      lastLoginAt: this.parseDate(raw.lastLoginAt),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  /**
   * Drop unknown role strings rather than crashing. A backend that adds
   * a new role before the SPA is redeployed should still let the admin
   * list and edit the rest of the row — they just won't see the new
   * role until the typed enum is updated. Forward-compat by design.
   */
  private narrowRoles(raw: string[] | null | undefined): UserRole[] {
    if (!raw || raw.length === 0) return [];
    const known = new Set<string>(Object.values(UserRole));
    return raw.filter((r): r is UserRole => known.has(r));
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  private toInvitationPage(raw: SpringPage<InvitationResponseRaw>): SpringPage<Invitation> {
    return {
      ...raw,
      content: raw.content.map((row) => this.toInvitation(row)),
    };
  }

  private toInvitation(raw: InvitationResponseRaw): Invitation {
    const fullName = `${raw.firstName} ${raw.lastName}`.trim();
    return {
      publicUuid: raw.publicUuid,
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName: fullName || raw.email,
      roles: this.narrowRoles(raw.roles),
      status: raw.status,
      token: raw.token ?? undefined,
      expiresAt: this.parseDate(raw.expiresAt),
      acceptedAt: this.parseDate(raw.acceptedAt),
      cancelledAt: this.parseDate(raw.cancelledAt),
      createdAt: this.parseDate(raw.createdAt),
    };
  }

  private toPreflight(raw: InvitationPreflightResponseRaw): InvitationPreflight {
    const fullName = `${raw.firstName} ${raw.lastName}`.trim();
    return {
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName: fullName || raw.email,
      tenantName: raw.tenantName,
    };
  }
}
