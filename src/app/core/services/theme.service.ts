import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Theme } from '@core/enums';
import { STORAGE_KEYS } from '@core/constants';
import { StorageService } from './storage.service';

/**
 * Theme orchestrator. Two distinct sources of truth coexist:
 *
 *   - `userTheme`   → explicit user preference, persisted in `localStorage`.
 *                     Once set, the user owns the theme and tenant defaults
 *                     never override it.
 *   - `tenantTheme` → proposed default for the current tenant (pushed by
 *                     `TenantService` after the tenant resolves). In-memory
 *                     only; storing it on the user device would conflict with
 *                     multi-tenant sessions in the same browser.
 *
 * Effective `theme` precedence:  userTheme ?? tenantTheme ?? Theme.System
 *
 * Implementation details:
 *   - The `.dark` class on `<html>` is Tailwind's source of truth.
 *   - When the user picks `System` we subscribe to the OS media query so a
 *     change in OS preference triggers an immediate re-render.
 *   - Switching themes adds `.theme-switching` to `<html>` for ~220 ms which
 *     activates a CSS transition on color/background/border/fill/stroke. The
 *     very first apply (FOUC handler in `index.html` already painted) skips
 *     the transition to avoid an unnecessary animation on load.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _userTheme = signal<Theme | null>(
    this.storage.get<Theme>(STORAGE_KEYS.THEME) ?? null
  );
  private readonly _tenantTheme = signal<Theme | null>(null);

  readonly userTheme = this._userTheme.asReadonly();
  readonly tenantTheme = this._tenantTheme.asReadonly();

  readonly theme = computed<Theme>(
    () => this._userTheme() ?? this._tenantTheme() ?? Theme.System
  );

  /** `true` when dark is currently active (resolves `System` against media query). */
  readonly isDark = computed(() => this.resolveIsDark(this.theme()));

  /** `true` when the user has explicitly chosen a theme (vs falling back to defaults). */
  readonly hasUserPreference = computed(() => this._userTheme() !== null);

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((event: MediaQueryListEvent) => void) | null = null;
  private firstApply = true;

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.applyTheme(theme);
      this.bindSystemListener(theme);
    });
    this.destroyRef.onDestroy(() => this.unbindSystemListener());
  }

  /** Set an explicit user preference. Persisted across sessions and tenants. */
  setTheme(theme: Theme): void {
    this._userTheme.set(theme);
    this.storage.set(STORAGE_KEYS.THEME, theme);
  }

  /** Toggle light ↔ dark (snaps current resolved theme to the opposite). */
  toggle(): void {
    this.setTheme(this.isDark() ? Theme.Light : Theme.Dark);
  }

  /** Drop the user override so tenant default / system kicks back in. */
  clearUserPreference(): void {
    this._userTheme.set(null);
    this.storage.remove(STORAGE_KEYS.THEME);
  }

  /**
   * Called by `TenantService` when the active tenant changes. The proposed
   * theme is only used when the user has no explicit preference.
   */
  applyTenantDefault(theme: Theme | null | undefined): void {
    this._tenantTheme.set(theme ?? null);
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const isDark = this.resolveIsDark(theme);

    /* Skip the transition burst on first apply: `index.html` already painted
     * the correct theme inline (FOUC handler), so toggling is a no-op. */
    if (this.firstApply) {
      this.firstApply = false;
      html.classList.toggle('dark', isDark);
      return;
    }

    html.classList.add('theme-switching');
    html.classList.toggle('dark', isDark);
    /* Match the duration declared in `_base.scss`. */
    window.setTimeout(() => html.classList.remove('theme-switching'), 220);
  }

  private resolveIsDark(theme: Theme): boolean {
    if (theme === Theme.Dark) return true;
    if (theme === Theme.Light) return false;
    return (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    );
  }

  private bindSystemListener(theme: Theme): void {
    this.unbindSystemListener();
    if (theme !== Theme.System || typeof window === 'undefined') return;

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaListener = () => this.applyTheme(Theme.System);
    this.mediaQuery.addEventListener('change', this.mediaListener);
  }

  private unbindSystemListener(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }
    this.mediaQuery = null;
    this.mediaListener = null;
  }
}
