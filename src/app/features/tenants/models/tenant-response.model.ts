import { TenantPlan, TenantStatus } from '@core/enums';

/**
 * RAW backend `BrandingDto` record.
 *
 * <p>Sprint 2 keeps this <em>flat and small</em> on purpose: the backend
 * stores branding as JSONB but only validates the four fields below with
 * regexes ({@code primaryColor} as CSS hex, the URLs as {@code https?://}).
 * Anything richer (dark-mode logo, accent palette, font, radius) belongs
 * to a future "branding upload" sprint and will be added here without
 * breaking the wire contract — every field is optional/nullable so adding
 * new ones is a non-breaking change.
 *
 * Adapted into the rich {@link TenantBranding} client model by
 * {@code TenantApiService}: {@code logoUrl} feeds {@code logo.light},
 * {@code faviconUrl} maps to {@code favicon}, {@code loginBgUrl} is kept
 * verbatim for the login background slot, and {@code primaryColor} maps
 * one-to-one.
 */
export interface BrandingRaw {
  primaryColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  loginBgUrl?: string | null;
}

/**
 * RAW shape of `GET /v1/tenants/by-slug/{slug}` (public).
 *
 * <p>Public on purpose — the login screen needs branding/identity
 * <em>before</em> the user has any session. The backend deliberately
 * omits {@code plan}, {@code settings} and {@code featureFlags} from this
 * projection (see {@code TenantSummary.java}); never assume otherwise on
 * the client side.
 */
export interface TenantSummaryRaw {
  publicUuid: string;
  name: string;
  slug: string;
  status: TenantStatus;
  branding: BrandingRaw;
}

/**
 * RAW shape of `GET /v1/tenants/me` and `PATCH /v1/tenants/me`.
 *
 * <p>Returned to authenticated users only. Carries everything
 * {@link TenantSummaryRaw} carries plus the operational fields
 * (plan / capacity / feature flags / settings / audit timestamps) that
 * the public lookup hides.
 *
 * <p>Wrapped in {@code ApiResponse<TenantResponseRaw>} by the controller —
 * unwrapping is handled inside {@code TenantApiService}.
 */
export interface TenantResponseRaw {
  publicUuid: string;
  name: string;
  slug: string;
  customDomain?: string | null;
  status: TenantStatus;
  plan: TenantPlan;
  trialEndsAt?: string | null;
  branding: BrandingRaw;
  settings: Record<string, unknown>;
  featureFlags: Record<string, unknown>;
  maxStudents?: number | null;
  maxTeachers?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
