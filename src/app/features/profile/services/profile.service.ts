import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiResponse } from '@core/models';
import { environment } from '@env/environment';

import { MfaDisableRequest } from '@features/auth/models';
import { UpdateProfileRequest } from '../models';

/**
 * Self-service profile HTTP boundary (Sprint 17 / FE-17.2).
 *
 * <h3>Why a separate service</h3>
 * The endpoints here hit {@code /v1/users/me/...} — the {@code me}
 * namespace is conceptually "self" rather than the admin-facing
 * {@code /v1/users/{uuid}/...} that {@code UsersApiService} already
 * wraps. A dedicated service keeps the URL composition (especially the
 * multipart upload for the avatar) isolated and lets the Profile page
 * own its state without a feature-store indirection.
 *
 * <h3>What we do (and don't) call</h3>
 * <ul>
 *   <li>{@link uploadAvatar} hits {@code POST /v1/users/me/avatar} (BE
 *       {@code UserSelfController}). The endpoint returns the
 *       {@code FileObjectResponse} envelope; we unwrap {@code .data}
 *       so the consumer gets the public UUID + download URL.</li>
 *   <li>{@link deleteAvatar} hits {@code DELETE /v1/users/me/avatar}.</li>
 *   <li>{@link updateProfile} hits {@code PATCH /v1/users/{publicUuid}}
 *       via the public users API. The self-only endpoint
 *       {@code PATCH /v1/users/me} is not yet wired on the BE — when
 *       it lands (Sprint 17 / BE-17.4), swap the URL here. For now
 *       the call works because the patch endpoint accepts the caller's
 *       own UUID.</li>
 * </ul>
 *
 * <h3>What's NOT here</h3>
 * A {@code changePassword} for the authenticated user — that endpoint
 * does not exist on the BE (only the admin-triggered reset via the
 * forgot-password flow exists). When the BE lands it, add it here
 * and wire a modal in {@code ProfilePageComponent}.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = () => `${environment.apiUrl}/${environment.apiVersion}`;

  /**
   * Upload / replace the authenticated user's avatar. Accepts
   * {@code image/png}, {@code image/jpeg}, {@code image/webp} (the BE
   * validator enforces this and 25 MB max). The previous avatar is
   * deleted server-side (best-effort).
   */
  uploadAvatar(file: File): Observable<{ publicUuid: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http
      .post<ApiResponse<{ publicUuid: string }>>(`${this.base()}/users/me/avatar`, fd)
      .pipe(map((envelope) => envelope.data));
  }

  deleteAvatar(): Observable<void> {
    return this.http.delete<void>(`${this.base()}/users/me/avatar`);
  }

  /**
   * Update the authenticated user's own profile (firstName, lastName,
   * phone). BE-17.4 will add a dedicated {@code PATCH /v1/users/me}
   * self-endpoint; for now we use the public patch with the caller's
   * own UUID, which works because the patch is allowed when the
   * principal is editing themselves.
   */
  updateProfile(myUuid: string, patch: UpdateProfileRequest): Observable<unknown> {
    return this.http.patch<ApiResponse<unknown>>(
      `${this.base()}/users/${encodeURIComponent(myUuid)}`,
      patch,
    );
  }

  /**
   * Disable MFA on the authenticated account. The BE requires both
   * the current password and a valid TOTP / recovery code; we
   * forward whatever the caller provides.
   */
  disableMfa(payload: MfaDisableRequest): Observable<void> {
    return this.http.post<void>(`${this.base()}/auth/mfa/disable`, payload);
  }
}
