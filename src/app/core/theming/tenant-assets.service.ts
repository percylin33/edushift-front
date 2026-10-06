import { Injectable, computed, inject } from '@angular/core';
import { TenantLogo } from '@core/models';
import { TenantService } from '@core/services/tenant.service';
import { ThemeService } from '@core/services/theme.service';
import { environment } from '@env/environment';

/** Horizontal EduShift wordmark (light UI) when the tenant has not uploaded a logo. */
export const PLATFORM_DEFAULT_LOGO_URL = '/branding/logos/horizontal.png';

/** White wordmark used on dark UI when the tenant has not uploaded a logo. */
export const PLATFORM_DEFAULT_LOGO_DARK_URL = '/branding/logos/fondo-oscuro.png';

/** Shield mark (sidebar collapsed, favicon-sized slots) without a tenant logo. */
export const PLATFORM_DEFAULT_MARK_URL = '/branding/icons/isotipo.png';

/** Generic campus background shown when the tenant has not uploaded a login hero. */
export const PLATFORM_DEFAULT_LOGIN_BG_URL = '/branding/default-login-bg.svg';

/**
 * Rewrite branding URLs that point at our own API so the browser loads them
 * same-origin via the Angular proxy ({@code /api/...} on :4200/:4201) instead
 * of hitting {@code localhost:8081} directly. That avoids
 * {@code ERR_BLOCKED_BY_RESPONSE.NotSameOrigin} from CORP on the API.
 * External URLs (Unsplash, CDN) are left untouched.
 */
export function toSameOriginAssetUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const apiOrigin = new URL(environment.apiUrl).origin;
    const parsed = new URL(trimmed, apiOrigin);
    if (parsed.origin === apiOrigin) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

/**
 * Reactive resolver for tenant-branded assets.
 *
 * Splits "logo data lives on the tenant" from "which file should I show right
 * now" — the second part depends on dark mode and on which slot is asking
 * (full vs mark), and those rules belong in one place to keep components
 * dumb.
 *
 * Variants:
 *   - `fullLogoUrl()` → horizontal logo (sidebar header, navbar mobile,
 *                       auth/onboarding branding).
 *   - `markUrl()`     → square icon (sidebar collapsed, fallback for tabs).
 *
 * Both resolve dark-mode preference automatically with safe fallbacks:
 *   markDark → mark → dark → light → platform isotipo
 *   dark     → light → platform wordmark (white on dark UI, color on light UI)
 * Login background: tenant {@code loginBgUrl} → platform default campus image.
 */
@Injectable({ providedIn: 'root' })
export class TenantAssetsService {
  private readonly tenant = inject(TenantService);
  private readonly theme = inject(ThemeService);

  private readonly logo = computed<TenantLogo | null>(
    () => this.tenant.tenant()?.branding?.logo ?? null,
  );

  readonly fullLogoUrl = computed<string>(() => {
    const l = this.logo();
    const raw = this.theme.isDark() ? (l?.dark ?? l?.light) : l?.light;
    return (
      toSameOriginAssetUrl(raw) ??
      (this.theme.isDark() ? PLATFORM_DEFAULT_LOGO_DARK_URL : PLATFORM_DEFAULT_LOGO_URL)
    );
  });

  readonly markUrl = computed<string>(() => {
    const l = this.logo();
    const raw = this.theme.isDark()
      ? (l?.markDark ?? l?.mark ?? l?.dark ?? l?.light)
      : (l?.mark ?? l?.light);
    return toSameOriginAssetUrl(raw) ?? PLATFORM_DEFAULT_MARK_URL;
  });

  /** True when the tenant uploaded its own logo (not the platform default). */
  readonly hasCustomLogo = computed<boolean>(
    () =>
      !!toSameOriginAssetUrl(
        this.theme.isDark()
          ? (this.logo()?.dark ?? this.logo()?.light)
          : this.logo()?.light,
      ),
  );

  readonly alt = computed<string>(() => {
    const l = this.logo();
    if (l?.alt) return l.alt;
    return this.tenant.tenant()?.name ?? 'Logo';
  });

  /** Single uppercase letter used by the brand-chip fallback. */
  readonly initial = computed<string>(() => {
    const name = this.tenant.tenant()?.name?.trim() ?? '';
    return (name.charAt(0) || 'E').toUpperCase();
  });

  /** Full-bleed login / auth background (tenant upload, else platform default). */
  readonly loginBgUrl = computed<string>(
    () =>
      toSameOriginAssetUrl(this.tenant.tenant()?.branding?.loginBgUrl) ??
      PLATFORM_DEFAULT_LOGIN_BG_URL,
  );

  /** True when the tenant uploaded its own login background. */
  readonly hasCustomLoginBg = computed<boolean>(
    () => !!toSameOriginAssetUrl(this.tenant.tenant()?.branding?.loginBgUrl),
  );

  /** Primary brand color (hex), used to tint the login overlay. */
  readonly primaryColor = computed<string | null>(
    () => this.tenant.tenant()?.branding?.primaryColor?.trim() || null,
  );

  /** Custom login headline; empty means the shell should use its default. */
  readonly loginTitle = computed<string | null>(
    () => this.tenant.tenant()?.branding?.loginTitle?.trim() || null,
  );

  /** Custom login supporting copy; empty means the shell default. */
  readonly loginDescription = computed<string | null>(
    () => this.tenant.tenant()?.branding?.loginDescription?.trim() || null,
  );
}
