import { Injectable, computed, inject } from '@angular/core';
import { TenantLogo } from '@core/models';
import { TenantService } from '@core/services/tenant.service';
import { ThemeService } from '@core/services/theme.service';

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
 *   markDark → mark → dark → light
 *   dark     → light
 */
@Injectable({ providedIn: 'root' })
export class TenantAssetsService {
  private readonly tenant = inject(TenantService);
  private readonly theme = inject(ThemeService);

  private readonly logo = computed<TenantLogo | null>(
    () => this.tenant.tenant()?.branding?.logo ?? null
  );

  readonly fullLogoUrl = computed<string | null>(() => {
    const l = this.logo();
    if (!l) return null;
    return this.theme.isDark() ? (l.dark ?? l.light) : l.light;
  });

  readonly markUrl = computed<string | null>(() => {
    const l = this.logo();
    if (!l) return null;
    if (this.theme.isDark()) {
      return l.markDark ?? l.mark ?? l.dark ?? l.light;
    }
    return l.mark ?? l.light;
  });

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
}
