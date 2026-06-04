import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import { STORAGE_KEYS } from '@core/constants';
import { Tenant, TenantContext } from '@core/models';
import { TenantThemeService } from '@core/theming';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';

/**
 * Resolves and exposes the current tenant. The actual tenant fetch (full
 * Tenant object, branding, etc.) belongs in the tenant feature; here we only
 * resolve the identifier (slug) from the chosen strategy.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly storage = inject(StorageService);
  private readonly tenantTheme = inject(TenantThemeService);
  private readonly themeService = inject(ThemeService);

  private readonly _context = signal<TenantContext>({ tenant: null, resolvedFrom: 'unknown' });
  readonly context = this._context.asReadonly();

  readonly tenant = computed<Tenant | null>(() => this._context().tenant);
  readonly tenantId = computed<string | null>(() => this._context().tenant?.id ?? null);
  readonly tenantSlug = computed<string | null>(() => this._context().tenant?.slug ?? null);

  /** Resolve the tenant slug from the configured strategy. Called once on app bootstrap. */
  resolveSlug(): { slug: string; resolvedFrom: TenantContext['resolvedFrom'] } {
    if (!environment.multiTenant.enabled) {
      return { slug: environment.multiTenant.defaultTenant, resolvedFrom: 'default' };
    }

    switch (environment.multiTenant.strategy) {
      case 'subdomain': {
        const host = window.location.hostname;
        const parts = host.split('.');
        const candidate = parts.length > 2 ? parts[0] : null;
        if (candidate && candidate !== 'www') {
          return { slug: candidate, resolvedFrom: 'subdomain' };
        }
        break;
      }
      case 'path': {
        const segments = window.location.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          return { slug: segments[0], resolvedFrom: 'path' };
        }
        break;
      }
      case 'header':
        break;
    }

    const cached = this.storage.get<string>(STORAGE_KEYS.CURRENT_TENANT);
    if (cached) return { slug: cached, resolvedFrom: 'default' };

    return { slug: environment.multiTenant.defaultTenant, resolvedFrom: 'default' };
  }

  setTenant(tenant: Tenant | null, resolvedFrom: TenantContext['resolvedFrom'] = 'default'): void {
    this._context.set({ tenant, resolvedFrom });
    if (tenant) {
      this.storage.set(STORAGE_KEYS.CURRENT_TENANT, tenant.slug);
    } else {
      this.storage.remove(STORAGE_KEYS.CURRENT_TENANT);
    }
    /* Branding: regenerate primary + accent palettes, font, radius, favicon. */
    this.tenantTheme.apply(tenant);
    /* Light/dark: propose tenant default (only takes effect when the user has
     * not explicitly chosen a theme). */
    this.themeService.applyTenantDefault(tenant?.branding?.defaultTheme);
  }

  clear(): void {
    this._context.set({ tenant: null, resolvedFrom: 'unknown' });
    this.storage.remove(STORAGE_KEYS.CURRENT_TENANT);
    this.tenantTheme.reset();
    this.themeService.applyTenantDefault(null);
  }
}
