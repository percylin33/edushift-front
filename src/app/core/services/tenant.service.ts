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

  /** Resolve the tenant slug from the configured strategy. Called once on app bootstrap.
   *
   * <p>Resolution order (highest precedence first):</p>
   * <ol>
   *   <li><b>{@code ?tenant=}</b> query param — useful in dev tunnels, QA links and
   *       deep-linked invitations. Persisted to storage so it survives subsequent
   *       navigations on the same device.</li>
   *   <li>Configured strategy ({@code subdomain} / {@code path} / {@code header}).
   *       Subdomain extraction is skipped on well-known tunnel / proxy hosts
   *       (devtunnels.ms, ngrok, cloudflared, localtunnel) because their hostname
   *       prefix is the tunnel id, not a real tenant slug.</li>
   *   <li>Cached slug from a previous session.</li>
   *   <li>{@code environment.multiTenant.defaultTenant}.</li>
   * </ol>
   */
  resolveSlug(): { slug: string; resolvedFrom: TenantContext['resolvedFrom'] } {
    if (!environment.multiTenant.enabled) {
      return { slug: environment.multiTenant.defaultTenant, resolvedFrom: 'default' };
    }

    const queryOverride = this.readSlugFromQuery();
    if (queryOverride) {
      this.storage.set(STORAGE_KEYS.CURRENT_TENANT, queryOverride);
      return { slug: queryOverride, resolvedFrom: 'path' };
    }

    switch (environment.multiTenant.strategy) {
      case 'subdomain': {
        const host = window.location.hostname;
        if (!TenantService.isTunnelHost(host)) {
          const parts = host.split('.');
          const candidate = parts.length > 2 ? parts[0] : null;
          if (candidate && candidate !== 'www') {
            return { slug: candidate, resolvedFrom: 'subdomain' };
          }
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
    if (cached && !this.isStaleTunnelCache(cached)) {
      return { slug: cached, resolvedFrom: 'default' };
    }
    if (cached) {
      /* Earlier builds (before tunnel detection) persisted the tunnel id as
       * the tenant slug. Purge it so subsequent boots cleanly fall back to
       * the configured default rather than re-using the bogus value. */
      this.storage.remove(STORAGE_KEYS.CURRENT_TENANT);
    }

    return { slug: environment.multiTenant.defaultTenant, resolvedFrom: 'default' };
  }

  /**
   * Detects cache entries that were written by older builds while the app was
   * loaded from a tunnel host. The pattern is the first DNS label of the
   * current tunnel host (e.g. {@code 3vmchk6t-4200.brs.devtunnels.ms} →
   * {@code 3vmchk6t-4200}). When that label was previously persisted as the
   * tenant slug it points at a non-existent tenant and must be discarded.
   */
  private isStaleTunnelCache(cached: string): boolean {
    const host = window.location.hostname;
    if (!TenantService.isTunnelHost(host)) return false;
    const tunnelPrefix = host.split('.')[0]?.toLowerCase();
    return !!tunnelPrefix && cached.toLowerCase() === tunnelPrefix;
  }

  private readSlugFromQuery(): string | null {
    try {
      const raw = new URLSearchParams(window.location.search).get('tenant');
      const trimmed = raw?.trim();
      return trimmed && /^[a-z0-9][a-z0-9-]{0,62}$/i.test(trimmed) ? trimmed : null;
    } catch {
      return null;
    }
  }

  /** Hosts where {@code parts[0]} is a tunnel id and never a tenant slug. */
  private static readonly TUNNEL_HOST_SUFFIXES: readonly string[] = [
    '.devtunnels.ms',
    '.ngrok.io',
    '.ngrok-free.app',
    '.ngrok.app',
    '.ngrok.dev',
    '.trycloudflare.com',
    '.loca.lt',
    '.lhr.life'
  ];

  private static isTunnelHost(host: string): boolean {
    const lower = host.toLowerCase();
    return TenantService.TUNNEL_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
  }

  /**
   * Update the active tenant context and (optionally) persist the slug.
   *
   * <p>{@code persist} defaults to {@code true} so callers performing an
   * authoritative update (login, settings page, tenant-switcher) cache the
   * choice for the next boot. The app initializer overrides this with
   * {@code persist: false} for the optimistic placeholder it sets before the
   * backend hydration: caching a placeholder is what produces the "stale
   * tunnel id" bug when the hydration fails (e.g. tenant doesn't exist).</p>
   */
  setTenant(
    tenant: Tenant | null,
    resolvedFrom: TenantContext['resolvedFrom'] = 'default',
    options: { persist?: boolean } = {}
  ): void {
    const persist = options.persist ?? true;
    this._context.set({ tenant, resolvedFrom });
    if (persist) {
      if (tenant) {
        this.storage.set(STORAGE_KEYS.CURRENT_TENANT, tenant.slug);
      } else {
        this.storage.remove(STORAGE_KEYS.CURRENT_TENANT);
      }
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
