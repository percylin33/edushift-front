import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { toAuthSession } from '@core/adapters';
import { API } from '@core/constants';
import { TenantStatus } from '@core/enums';
import {
  ApiResponse,
  AuthResponseRaw,
  AuthSession,
  Tenant,
  TenantBranding
} from '@core/models';
import { ApiService } from '@core/services';
import {
  BrandingRaw,
  RegisterTenantRequest,
  TenantResponseRaw,
  TenantSummaryRaw,
  UpdateTenantRequest
} from '../models';

/**
 * Tenants HTTP boundary. State lives in {@code TenantService} (core);
 * this service is purely the wire layer for everything tenant-related.
 *
 * <h3>Endpoint map</h3>
 * <ul>
 *   <li>{@link #findBySlug} → {@code GET /v1/tenants/by-slug/{slug}}
 *       (public — no bearer required, used by the login screen so
 *       branding paints before the user has any session).</li>
 *   <li>{@link #findCurrent} → {@code GET /v1/tenants/me} (authenticated;
 *       returns the rich projection including {@code plan},
 *       {@code featureFlags}, {@code settings}).</li>
 *   <li>{@link #updateCurrent} → {@code PATCH /v1/tenants/me} (TENANT_ADMIN
 *       only — backend enforces this with {@code @PreAuthorize}; the
 *       client surfaces a 403 by passing the error through to the
 *       interceptor pipeline).</li>
 *   <li>{@link #register} → {@code POST /v1/tenants/register} (public
 *       self-signup; returns an {@code AuthResponse} so the form can
 *       drop straight into the onboarding flow without a separate
 *       login round-trip).</li>
 * </ul>
 *
 * <h3>Why the adapters live here (not on the {@code Tenant} model)</h3>
 * Wire shapes and the UI model evolve at different paces:
 * {@code TenantBranding} on the client carries dark-mode logo
 * variants and font/radius slots that the backend does not know about
 * yet (planned for the future "branding upload" sprint). Adapting at
 * the boundary means new wire fields can be folded in here without
 * touching every consumer.
 */
@Injectable({ providedIn: 'root' })
export class TenantApiService {
  private readonly api = inject(ApiService);

  /**
   * Public lookup by slug. Used by the login screen and any pre-auth
   * surface. The summary deliberately omits {@code plan},
   * {@code settings} and {@code featureFlags} — see the backend
   * {@code TenantSummary.java} javadoc for the security rationale.
   */
  findBySlug(slug: string): Observable<Tenant> {
    return this.api
      .get<ApiResponse<TenantSummaryRaw>>(API.TENANTS.BY_SLUG(slug))
      .pipe(map((envelope) => this.toTenantFromSummary(envelope.data)));
  }

  /** Authenticated full projection. */
  findCurrent(): Observable<Tenant> {
    return this.api
      .get<ApiResponse<TenantResponseRaw>>(API.TENANTS.ME)
      .pipe(map((envelope) => this.toTenantFromResponse(envelope.data)));
  }

  /**
   * Partial-flat update (TENANT_ADMIN). The backend's
   * {@code TenantMapper.applyUpdate} treats {@code undefined} as
   * "leave alone" and merges {@code branding} field-by-field; see
   * {@link UpdateTenantRequest} for the exact contract.
   */
  updateCurrent(patch: UpdateTenantRequest): Observable<Tenant> {
    return this.api
      .patch<ApiResponse<TenantResponseRaw>, UpdateTenantRequest>(API.TENANTS.ME, patch)
      .pipe(map((envelope) => this.toTenantFromResponse(envelope.data)));
  }

  /**
   * Public self-signup. Atomically creates a {@code PENDING} tenant on
   * the {@code TRIAL} plan and an {@code ACTIVE} {@code TENANT_ADMIN}
   * user, then returns an {@code AuthResponse} so the UI can transition
   * to the onboarding flow already authenticated.
   *
   * <p>The {@code 409 TENANT_SLUG_TAKEN} response surfaces verbatim
   * through {@code errorInterceptor}; the registration form is
   * expected to translate that error code into a field-level message.
   */
  register(payload: RegisterTenantRequest): Observable<AuthSession> {
    return this.api
      .post<AuthResponseRaw, RegisterTenantRequest>(API.TENANTS.REGISTER, payload)
      .pipe(map(toAuthSession));
  }

  /**
   * Promote the current tenant from {@code PENDING} to {@code ACTIVE}
   * (TENANT_ADMIN). Called by the onboarding wizard's last step.
   *
   * <h3>Idempotency</h3>
   * Calling this on an already-{@code ACTIVE} tenant is a no-op on the
   * backend (returns 200 with the current snapshot) so the SPA can retry
   * on transient network errors without worrying about state drift.
   * Refusing other source statuses ({@code SUSPENDED} / {@code INACTIVE})
   * raises {@code 409 TENANT_NOT_ACTIVATABLE} — the UI is expected to
   * route the user to support in that branch.
   */
  activateCurrent(): Observable<Tenant> {
    return this.api
      .post<ApiResponse<TenantResponseRaw>>(API.TENANTS.ACTIVATE)
      .pipe(map((envelope) => this.toTenantFromResponse(envelope.data)));
  }

  // ---------------------------------------------------------------------------
  // Adapters (raw backend shapes → project-internal models)
  // ---------------------------------------------------------------------------

  private toTenantFromSummary(raw: TenantSummaryRaw): Tenant {
    return {
      id: raw.publicUuid,
      slug: raw.slug,
      name: raw.name,
      status: raw.status,
      isActive: raw.status === TenantStatus.Active,
      branding: this.toBranding(raw.branding)
    };
  }

  private toTenantFromResponse(raw: TenantResponseRaw): Tenant {
    return {
      id: raw.publicUuid,
      slug: raw.slug,
      name: raw.name,
      status: raw.status,
      isActive: raw.status === TenantStatus.Active,
      customDomain: raw.customDomain ?? undefined,
      plan: raw.plan,
      trialEndsAt: raw.trialEndsAt ?? undefined,
      branding: this.toBranding(raw.branding),
      settings: raw.settings,
      featureFlags: raw.featureFlags,
      maxStudents: raw.maxStudents ?? undefined,
      maxTeachers: raw.maxTeachers ?? undefined
    };
  }

  /**
   * Map the flat backend {@link BrandingRaw} into the rich client-side
   * {@link TenantBranding}.
   *
   * <p>The wire shape carries a single logo URL today; the UI model
   * supports up to four variants (light / dark / mark / markDark) so it
   * can render the navbar, sidebar collapsed mode and the favicon
   * without re-fetching. Until the backend exposes the richer shape we
   * fan {@code logoUrl} into {@code logo.light} and let the UI
   * fall-through logic handle the rest. Returns {@code undefined} when
   * the wire bundle is effectively empty so consumers can apply
   * platform defaults via a simple null-check.
   */
  private toBranding(raw: BrandingRaw | null | undefined): TenantBranding | undefined {
    if (!raw) return undefined;
    const hasAnyField =
      !!raw.primaryColor || !!raw.logoUrl || !!raw.faviconUrl || !!raw.loginBgUrl;
    if (!hasAnyField) return undefined;

    const branding: TenantBranding = {};
    if (raw.primaryColor) branding.primaryColor = raw.primaryColor;
    if (raw.faviconUrl) branding.favicon = raw.faviconUrl;
    if (raw.logoUrl) branding.logo = { light: raw.logoUrl };
    return branding;
  }
}
