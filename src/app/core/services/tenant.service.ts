import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import { STORAGE_KEYS } from '@core/constants';
import { TenantStatus } from '@core/enums';
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

  /** Resolve the tenant slug from the hostname. Called once on app bootstrap.
   *
   * <p>Resolution order (highest precedence first):</p>
   * <p>On local development hosts, only {@code <hostname>.localhost} identifies
   * a school. Query parameters, cached state, and the default tenant are ignored
   * there so the root localhost URL cannot silently open a school's login.</p>
   * <p>With the subdomain strategy, a school hostname takes precedence over
   * {@code ?tenant=} so a URL parameter cannot relabel an established school host.</p>
   * <p>Outside localhost, the existing strategy remains available for deployed
   * subdomains, tunnels, and legacy non-local environments.</p>
   */
  resolveSlug(): { slug: string | null; resolvedFrom: TenantContext['resolvedFrom'] } {
    if (!environment.multiTenant.enabled) {
      return { slug: environment.multiTenant.defaultTenant, resolvedFrom: 'default' };
    }

    const host = window.location.hostname.toLowerCase();
    if (TenantService.isLocalhostDomain(host)) {
      const alias = TenantService.localHostnameAlias(host);
      return {
        slug: alias,
        resolvedFrom: alias ? 'subdomain' : 'unknown',
      };
    }

    // On a school subdomain, the hostname is the authoritative tenant
    // selector. A query parameter may select a tenant on root/tunnel hosts,
    // but must not relabel a school URL.
    if (environment.multiTenant.strategy === 'subdomain') {
      const hostSlug = TenantService.subdomainSlug(host);
      if (hostSlug) return { slug: hostSlug, resolvedFrom: 'subdomain' };
    }

    const queryOverride = this.readSlugFromQuery();
    if (queryOverride && TenantService.isLikelyRealTenantSlug(queryOverride)) {
      this.storage.set(STORAGE_KEYS.CURRENT_TENANT, queryOverride);
      return { slug: queryOverride, resolvedFrom: 'path' };
    }

    switch (environment.multiTenant.strategy) {
      case 'subdomain': {
        break;
      }
      case 'path': {
        const segments = window.location.pathname.split('/').filter(Boolean);
        if (segments.length > 0 && TenantService.isLikelyRealTenantSlug(segments[0])) {
          return { slug: segments[0], resolvedFrom: 'path' };
        }
        break;
      }
      case 'header':
        break;
    }

    const cached = this.storage.get<string>(STORAGE_KEYS.CURRENT_TENANT);
    if (
      cached &&
      !this.isStaleTunnelCache(cached) &&
      TenantService.isLikelyRealTenantSlug(cached)
    ) {
      return { slug: cached, resolvedFrom: 'default' };
    }
    if (cached) {
      // Earlier builds (before tunnel / preview-host detection) persisted
      // bogus slugs (tunnel id, Vercel preview label). Purge them so
      // subsequent boots cleanly fall back to the configured default rather
      // than re-using the stale value and getting 404s from the BE.
      this.storage.remove(STORAGE_KEYS.CURRENT_TENANT);
    }

    return { slug: environment.multiTenant.defaultTenant, resolvedFrom: 'default' };
  }

  /**
   * Rejects strings that look like deploy-platform identifiers instead of
   * tenant slugs. A DNS label can contain at most 63
   * chars), lowercase, and never contains a Vercel preview hash pattern
   * (8-hex chars followed by the project's full name). Anything that
   * matches `^[a-z0-9-]{16,}-` is almost certainly a Vercel/Render
   * preview URL fragment, not a tenant.
   */
  private static isLikelyRealTenantSlug(slug: string): boolean {
    if (!slug) return false;
    const lower = slug.toLowerCase().trim();
    // A DNS label can contain at most 63 characters.
    if (lower.length > 63) return false;
    // Tenant slugs never contain double-dash or start/end with a dash.
    if (lower.includes('--') || lower.startsWith('-') || lower.endsWith('-')) return false;
    // The classic pattern of a Vercel auto-generated preview URL:
    //   <8-hex>-<owner>-<repo>        e.g. rad5rs5ax-percylin33s-projects
    //   <8-hex>-<owner>-<repo>-<branch>
    if (/^[a-z0-9]{8,}-[a-z0-9-]+$/.test(lower)) {
      // Heuristic: starts with a long opaque token (8+ alphanumeric) followed
      // by a dash and a multi-word name → it's a preview URL.
      const firstSegment = lower.split('-')[0];
      if (/^[a-z0-9]{6,}$/.test(firstSegment)) return false;
    }
    return /^[a-z0-9][a-z0-9-]{0,62}$/.test(lower);
  }

  /** Whether this browser is on a host that is allowed to identify a tenant. */
  hasTenantHost(): boolean {
    const host = window.location.hostname.toLowerCase();
    if (TenantService.isLocalhostDomain(host)) {
      return TenantService.localHostnameAlias(host) !== null && this.tenantSlug() !== null;
    }
    return this.tenantSlug() !== null;
  }

  private static isLocalhostDomain(host: string): boolean {
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.endsWith('.localhost')
    );
  }

  /** Returns a valid school slug from a subdomain, excluding platform hosts. */
  static subdomainSlug(hostname: string): string | null {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    if (TenantService.isTunnelHost(host)) return null;

    const candidate = host.split('.').length > 2 ? host.split('.')[0] : null;
    if (
      !candidate ||
      TenantService.PLATFORM_SUBDOMAINS.has(candidate) ||
      !TenantService.isLikelyRealTenantSlug(candidate)
    ) {
      return null;
    }
    return candidate;
  }

  /** Returns the one-label, dash-free school alias from `school.localhost`. */
  private static localHostnameAlias(host: string): string | null {
    if (!host.endsWith('.localhost')) return null;
    const alias = host.slice(0, -'.localhost'.length);
    return /^[a-z0-9][a-z0-9]{0,62}$/.test(alias) ? alias : null;
  }

  /**
   * Detects cache entries that were written by older builds while the app was
   * loaded from a tunnel / preview host. The pattern is the first DNS label
   * of the current host (e.g. {@code 3vmchk6t-4200.brs.devtunnels.ms} →
   * {@code 3vmchk6t-4200} or {@code edushift-front-rad5rs5ax-percylin33s-projects.vercel.app} →
   * {@code edushift-front-rad5rs5ax-percylin33s-projects}). When that label was
   * previously persisted as the tenant slug it points at a non-existent
   * tenant and must be discarded.
   */
  private isStaleTunnelCache(cached: string): boolean {
    const host = window.location.hostname;
    if (!TenantService.isTunnelHost(host)) {
      // Not on a tunnel/preview host, but the cached value might still be a
      // Vercel preview URL from a previous session.
      return TenantService.isLikelyRealTenantSlug(cached) === false;
    }
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

  /**
   * Hosts where {@code parts[0]} is a tunnel id (or a Vercel preview id) and
   * never a real tenant slug. Add new SaaS-hosting suffixes here as we
   * onboard tenants — anywhere the deploy platform injects its own DNS
   * label between the user and the app, the first dot-separated segment
   * is NOT a tenant slug.
   */
  private static readonly TUNNEL_HOST_SUFFIXES: readonly string[] = [
    '.devtunnels.ms',
    '.ngrok.io',
    '.ngrok-free.app',
    '.ngrok.app',
    '.ngrok.dev',
    '.trycloudflare.com',
    '.loca.lt',
    '.lhr.life',
    '.vercel.app',
    '.netlify.app',
    '.render.com',
    '.onrender.com',
  ];

  private static readonly PLATFORM_SUBDOMAINS = new Set([
    'www',
    'app',
    'api',
    'admin',
    'auth',
    'mail',
    'support',
    'static',
    'cdn',
  ]);

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
  /**
   * Ensure {@code X-Tenant-Slug} matches {@code slug} for the next request.
   *
   * <p>Phase 1 login no longer asks for an "Institución" field — the slug
   * comes from the URL. Callers still invoke this on submit so the
   * interceptor header is authoritative. When the boot hydration already
   * loaded this same tenant we keep the rich snapshot (name / branding)
   * and only pin storage + {@code resolvedFrom}; otherwise we plant a
   * lightweight placeholder until {@code /tenants/me} arrives.
   */
  setSlug(slug: string): void {
    const trimmed = slug?.trim().toLowerCase();
    if (!trimmed) return;
    // Reject anything that looks like a deploy-platform URL fragment so we
    // never persist bogus values that would survive across sessions.
    if (!TenantService.isLikelyRealTenantSlug(trimmed)) return;

    const current = this._context().tenant;
    if (current && current.slug === trimmed && current.id && current.id !== trimmed) {
      this._context.set({ tenant: current, resolvedFrom: 'header' });
      this.storage.set(STORAGE_KEYS.CURRENT_TENANT, trimmed);
      return;
    }

    const placeholder: Tenant = {
      id: '',
      slug: trimmed,
      name: trimmed,
      status: TenantStatus.Active,
      isActive: true,
    };
    this._context.set({ tenant: placeholder, resolvedFrom: 'header' });
    this.storage.set(STORAGE_KEYS.CURRENT_TENANT, trimmed);
  }

  setTenant(
    tenant: Tenant | null,
    resolvedFrom: TenantContext['resolvedFrom'] = 'default',
    options: { persist?: boolean } = {},
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
