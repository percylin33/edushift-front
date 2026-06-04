import { FeatureKey, TenantPlan, TenantStatus } from '@core/enums';
import { TenantBranding } from './tenant-branding.model';

/**
 * The tenant entity exposed to the UI. Built by adapting the backend's
 * {@code TenantSummary} (public, by-slug) and {@code TenantResponse}
 * (authenticated, /me) DTOs in {@code TenantApiService}, then held in
 * {@code TenantService} as a signal.
 *
 * <h3>Identity</h3>
 * The {@code id} field carries the backend's {@code publicUuid} — the
 * internal numeric/UUIDv7 primary key never crosses the wire. Components
 * that need a stable client-side id can use either {@code id} or
 * {@code slug} (slugs are globally unique, case-insensitive).
 *
 * <h3>What's optional</h3>
 * Public lookups (`GET /v1/tenants/by-slug/{slug}`, used by the login screen
 * <em>before</em> the user has authenticated) deliberately return a slim
 * projection — branding + identity only — so {@code plan},
 * {@code featureFlags}, {@code settings} and capacity limits are all
 * optional. After the user logs in, {@code TenantService} re-fetches via
 * {@code GET /v1/tenants/me} which fills the rest in.
 */
export interface Tenant {
  /** Backend `publicUuid`. The internal numeric id is never exposed via REST. */
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;

  /** Convenience boolean kept for the existing call sites (theme service, guards). */
  isActive: boolean;

  /** White-label customization. Undefined = use platform defaults. */
  branding?: TenantBranding;

  /**
   * Optional vanity domain (e.g. {@code intranet.colegio.pe}). Only
   * populated for paid tiers; lower-case hostname format enforced by
   * the backend.
   */
  customDomain?: string;

  /** Billing tier. Defaults to TRIAL for self-signups. */
  plan?: TenantPlan;

  /** ISO-8601 instant when the trial ends. Undefined for non-trial plans. */
  trialEndsAt?: string;

  /**
   * Free-form feature flags returned by the backend ({@code featureFlags}
   * column). Stored verbatim — the UI feature-gating layer
   * ({@code NavigationService}) reads {@link #enabledFeatures} instead, so
   * this is reserved for fine-grained flags ("ai.copilot.beta").
   */
  featureFlags?: Record<string, unknown>;

  /** Tenant-level settings (currency, locale, timezone, …) returned by the backend. */
  settings?: Record<string, unknown>;

  /** Capacity limits surfaced by the plan; null on the unbounded tiers. */
  maxStudents?: number;
  maxTeachers?: number;

  /**
   * Allowlist of feature keys for the tenant's plan. Undefined = the
   * navigation layer falls back to the env-level {@code FEATURES} flag.
   * Sprint 2 keeps the field for backward compatibility but does not
   * populate it from the backend yet (planned for Sprint 3 alongside the
   * relational role/permission model).
   */
  enabledFeatures?: FeatureKey[];
}

export interface TenantContext {
  tenant: Tenant | null;
  resolvedFrom: 'subdomain' | 'path' | 'header' | 'default' | 'unknown';
}
