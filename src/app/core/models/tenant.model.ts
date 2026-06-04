import { FeatureKey } from '@core/enums';
import { TenantBranding } from './tenant-branding.model';

/**
 * The tenant entity returned by the server when the slug is resolved.
 *
 * Two distinct concerns live here:
 *   - identity (`id`, `slug`, `name`, …)
 *   - white-label / entitlements (`branding`, `enabledFeatures`)
 *
 * Everything visual is namespaced under `branding` so we keep a single
 * source of truth for the theme system (`TenantThemeService` /
 * `TenantAssetsService`).
 */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  locale?: string;
  timezone?: string;
  isActive: boolean;

  /** White-label customization. Undefined = use platform defaults. */
  branding?: TenantBranding;

  /** Explicit allowlist of features for the tenant's plan. Undefined = all enabled by env. */
  enabledFeatures?: FeatureKey[];
}

export interface TenantContext {
  tenant: Tenant | null;
  resolvedFrom: 'subdomain' | 'path' | 'header' | 'default' | 'unknown';
}
