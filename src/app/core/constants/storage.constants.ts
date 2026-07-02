import { environment } from '@env/environment';

export const STORAGE_KEYS = {
  AUTH_TOKEN: environment.auth.tokenStorageKey,
  REFRESH_TOKEN: environment.auth.refreshTokenStorageKey,
  /* Absolute ISO date string at which the access token expires. Computed
   * client-side from the backend's `expiresInSec` and persisted so a tab
   * refresh can decide whether to silent-refresh before any HTTP call. */
  AUTH_EXPIRES_AT: 'edushift.auth.expiresAt',
  CURRENT_USER: 'edushift.auth.user',
  CURRENT_TENANT: 'edushift.tenant.current',
  LOCALE: 'edushift.app.locale',
  THEME: 'edushift.app.theme',
  LAYOUT_SIDEBAR_COLLAPSED: 'edushift.layout.sidebarCollapsed',
  /* Cached favicon URL written by `TenantThemeService` and read by the
   * anti-FOUC inline script in `index.html` on the next page load. */
  TENANT_FAVICON: 'edushift.tenant.favicon',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
