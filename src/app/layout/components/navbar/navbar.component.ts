import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '@shared/components';
import { LayoutService } from '../../services';
import { BreadcrumbsComponent } from '../breadcrumbs/breadcrumbs.component';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

/**
 * Top bar that lives inside the content column (sidebar runs full-height).
 *
 * Layout (left → right):
 *   - Mobile hamburger (md:hidden) — toggles the sidebar drawer
 *   - Breadcrumbs trail (hidden < md)
 *   - Search box (visual placeholder; wire to a command palette later)
 *   - Theme toggle / Notifications bell / User menu
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    BreadcrumbsComponent,
    NotificationsBellComponent,
    ThemeToggleComponent,
    UserMenuComponent
  ],
  template: `
    <header
      class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border
             bg-surface/80 px-4 backdrop-blur supports-backdrop:bg-surface/70 sm:px-6"
    >
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-muted
               hover:bg-surface-muted hover:text-content
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30
               md:hidden"
        aria-label="Abrir menú"
        (click)="openSidebar()"
      >
        <app-icon name="menu" [size]="20" />
      </button>

      <div class="hidden min-w-0 flex-1 md:block">
        <app-breadcrumbs />
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <label class="relative hidden lg:flex">
          <span class="sr-only">Buscar</span>
          <app-icon
            name="search"
            [size]="16"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
          />
          <input
            type="search"
            placeholder="Buscar…"
            class="input h-9 w-64 pl-8 text-sm"
          />
        </label>

        <app-theme-toggle />
        <app-notifications-bell />
        <div class="mx-1 hidden h-6 w-px bg-border-subtle sm:block"></div>
        <app-user-menu />
      </div>
    </header>
  `
})
export class NavbarComponent {
  private readonly layout = inject(LayoutService);

  openSidebar(): void {
    this.layout.openSidebar();
  }
}
