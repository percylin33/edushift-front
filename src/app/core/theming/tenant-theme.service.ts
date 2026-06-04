import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '@core/constants';
import { Tenant, TenantBranding, resolveRadius } from '@core/models';
import { buildPalette, getDocumentRoot } from './color.utils';
import { ALL_TENANT_VARS, PALETTE_SHADES, THEME_TOKENS } from './theme-tokens';

const FAVICON_ELEMENT_ID = 'app-favicon';
const DEFAULT_FAVICON_HREF = 'favicon.ico';

/**
 * Applies the tenant's white-label branding to `<html>`.
 *
 * Responsibilities:
 *   1. Set `data-tenant="<slug>"` (and `data-tenant-id`) so static CSS in
 *      `_tokens.scss` can match `[data-tenant='...']` if a tenant requires
 *      handcrafted overrides.
 *   2. Write the primary palette via `buildPalette(branding.primaryColor)`.
 *   3. Write the accent palette via `buildPalette(branding.accentColor)`.
 *   4. Write `--font-sans` if the tenant provides a custom font stack.
 *   5. Write `--radius-base` if the tenant picks a radius preset.
 *   6. Swap the `<link rel="icon">` href, falling back to a generated SVG
 *      built from the primary color when no favicon URL is provided.
 *
 * Symmetric `reset()` removes everything so switching tenants in the same
 * session always starts from a clean slate.
 *
 * Single source of truth for tokens: `theme-tokens.ts` (`ALL_TENANT_VARS`).
 */
@Injectable({ providedIn: 'root' })
export class TenantThemeService {
  apply(tenant: Tenant | null): void {
    const root = getDocumentRoot();
    if (!root) return;

    if (!tenant) {
      this.reset();
      return;
    }

    root.dataset['tenant'] = tenant.slug;
    root.dataset['tenantId'] = tenant.id;

    const branding = tenant.branding ?? {};
    this.applyPalette(root, 'primary', branding.primaryColor);
    this.applyPalette(root, 'accent', branding.accentColor);
    this.applyFont(root, branding.fontFamily);
    this.applyRadius(root, branding.radius);
    this.applyFavicon(branding, tenant.name);
  }

  reset(): void {
    const root = getDocumentRoot();
    if (!root) return;
    delete root.dataset['tenant'];
    delete root.dataset['tenantId'];
    for (const variable of ALL_TENANT_VARS) {
      root.style.removeProperty(variable);
    }
    this.setFaviconHref(DEFAULT_FAVICON_HREF, /* cache */ false);
  }

  private applyPalette(root: HTMLElement, name: 'primary' | 'accent', color?: string): void {
    const vars = name === 'primary' ? THEME_TOKENS.primaryPalette : THEME_TOKENS.accentPalette;
    if (!color) {
      for (const v of vars) root.style.removeProperty(v);
      return;
    }
    const palette = buildPalette(color);
    if (!palette) return;
    PALETTE_SHADES.forEach((shade) => {
      root.style.setProperty(`--color-${name}-${shade}`, palette[shade]);
    });
  }

  private applyFont(root: HTMLElement, fontFamily?: string): void {
    if (!fontFamily) {
      root.style.removeProperty(THEME_TOKENS.fontSans);
      return;
    }
    /* Prepend the tenant font to a sensible fallback chain so a broken font
     * URL never leaves the user staring at a system serif. */
    const stack = `${fontFamily}, 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    root.style.setProperty(THEME_TOKENS.fontSans, stack);
  }

  private applyRadius(root: HTMLElement, radius?: TenantBranding['radius']): void {
    const value = resolveRadius(radius);
    if (!value) {
      root.style.removeProperty(THEME_TOKENS.radius);
      return;
    }
    root.style.setProperty(THEME_TOKENS.radius, value);
  }

  private applyFavicon(branding: TenantBranding, tenantName: string): void {
    if (typeof document === 'undefined') return;

    if (branding.favicon) {
      this.setFaviconHref(branding.favicon);
      return;
    }

    /* No favicon asset — generate a small SVG so the browser tab still
     * carries tenant identity (initial + primary color). */
    if (branding.primaryColor) {
      this.setFaviconHref(this.buildSvgFavicon(tenantName, branding.primaryColor));
      return;
    }

    this.setFaviconHref(DEFAULT_FAVICON_HREF, /* cache */ false);
  }

  /**
   * Set the favicon `<link>` href and optionally cache it in `localStorage`
   * so the anti-FOUC inline script in `index.html` can apply it on the very
   * next paint, before Angular bootstraps.
   */
  private setFaviconHref(href: string, cache = true): void {
    if (typeof document === 'undefined') return;
    const link = document.getElementById(FAVICON_ELEMENT_ID) as HTMLLinkElement | null;
    if (link) link.href = href;

    try {
      if (cache) localStorage.setItem(STORAGE_KEYS.TENANT_FAVICON, href);
      else localStorage.removeItem(STORAGE_KEYS.TENANT_FAVICON);
    } catch { /* storage may be unavailable (private mode, quota) — non-fatal */ }
  }

  private buildSvgFavicon(name: string, color: string): string {
    const initial = (name.trim().charAt(0) || 'E').toUpperCase();
    const safe = color.replace(/"/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="${safe}"/>
        <text x="50%" y="56%" text-anchor="middle"
              font-family="Inter, system-ui, sans-serif"
              font-size="36" font-weight="700" fill="#ffffff"
              dominant-baseline="middle">${initial}</text>
      </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
