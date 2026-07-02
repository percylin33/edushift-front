import { Theme } from '@core/enums';

/**
 * Tenant logo URLs. We accept up to four variants so the UI can pick the
 * right one for every context without re-rendering identical icons:
 *
 *   - `light`     → full horizontal logo on light backgrounds (required)
 *   - `dark`      → variant used when `.dark` class is on `<html>`. Falls
 *                   back to `light` if omitted.
 *   - `mark`      → square / icon-only logo for the sidebar collapsed mode,
 *                   the navbar mobile header and the favicon fallback.
 *                   Falls back to `light`.
 *   - `markDark`  → dark-mode variant of `mark`. Falls back to `mark`.
 */
export interface TenantLogo {
  light: string;
  dark?: string;
  mark?: string;
  markDark?: string;
  alt?: string;
}

/**
 * Granular shape control. Keeps the design system coherent — we expose four
 * presets rather than letting tenants pick arbitrary px so radii stay
 * proportional across components (button, card, input…).
 */
export type TenantRadius = 'sm' | 'md' | 'lg' | 'xl';

const TENANT_RADIUS_VALUES: Record<TenantRadius, string> = {
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
};

export function resolveRadius(radius: TenantRadius | undefined): string | null {
  return radius ? TENANT_RADIUS_VALUES[radius] : null;
}

/**
 * White-label branding bundle. Stored under `Tenant.branding` and applied at
 * runtime by `TenantThemeService` (colors / radius / font) and read reactively
 * by `TenantAssetsService` (logos / favicon).
 *
 * Every field is optional on purpose so partial brand kits work out of the
 * box — a tenant providing only `primaryColor` still gets a coherent UI.
 */
export interface TenantBranding {
  logo?: TenantLogo;
  favicon?: string;

  primaryColor?: string;
  accentColor?: string;

  fontFamily?: string;
  radius?: TenantRadius;

  defaultTheme?: Theme;
}
