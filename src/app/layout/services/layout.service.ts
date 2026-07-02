import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '@core/services';
import { STORAGE_KEYS } from '@core/constants';

/**
 * Owns layout chrome state:
 *   - `sidebarCollapsed` → desktop, persisted so the user's preference sticks.
 *   - `sidebarOpen`      → mobile drawer, ephemeral (always closed on reload).
 *
 * Keep this service free of any UI logic; components only read signals and
 * call the small set of mutators below.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly storage = inject(StorageService);

  private readonly _sidebarCollapsed = signal<boolean>(
    this.storage.get<boolean>(STORAGE_KEYS.LAYOUT_SIDEBAR_COLLAPSED) ?? false,
  );
  private readonly _sidebarOpen = signal<boolean>(false);

  readonly sidebarCollapsed = this._sidebarCollapsed.asReadonly();
  readonly sidebarOpen = this._sidebarOpen.asReadonly();

  toggleSidebarCollapsed(): void {
    this._sidebarCollapsed.update((v) => !v);
    this.storage.set(STORAGE_KEYS.LAYOUT_SIDEBAR_COLLAPSED, this._sidebarCollapsed());
  }

  setSidebarCollapsed(value: boolean): void {
    this._sidebarCollapsed.set(value);
    this.storage.set(STORAGE_KEYS.LAYOUT_SIDEBAR_COLLAPSED, value);
  }

  openSidebar(): void {
    this._sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this._sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this._sidebarOpen.update((v) => !v);
  }
}
