import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, TenantLogoComponent } from '@shared/components';
import { APP } from '@core/constants';
import { TenantService } from '@core/services';
import { LayoutService, NavigationService } from '../../services';
import { SidebarItemComponent } from './sidebar-item.component';

/**
 * App sidebar. Single component handles both modes:
 *   - Desktop:   inline column, collapsible 256px ↔ 72px (persisted).
 *   - Mobile:    fixed off-canvas drawer with backdrop, transient.
 *
 * Visibility of items is delegated to `NavigationService`; if a user can't see
 * anything (no permissions, all features disabled) the nav simply renders empty.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SidebarItemComponent, TenantLogoComponent],
  template: `
    @if (mobileOpen()) {
      <button
        type="button"
        class="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
        aria-label="Cerrar menú"
        (click)="closeMobile()"
      ></button>
    }

    <aside
      class="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface
             transition-[transform,width] duration-200 ease-out
             md:static md:translate-x-0 md:shadow-none"
      [class.translate-x-0]="mobileOpen()"
      [class.-translate-x-full]="!mobileOpen()"
      [style.width.px]="width()"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div class="flex h-16 items-center gap-3 border-b border-border-subtle px-4">
        <a
          [routerLink]="dashboardLink"
          class="flex items-center gap-2.5 text-content hover:opacity-90 focus:outline-none"
          [attr.aria-label]="appName"
        >
          <app-tenant-logo variant="mark" size="md" />
          @if (!collapsed()) {
            <span class="flex flex-col leading-tight">
              <span class="truncate text-sm font-semibold tracking-tight">{{ tenantName() }}</span>
              <span class="truncate text-2xs uppercase tracking-wider text-content-subtle">
                {{ appName }}
              </span>
            </span>
          }
        </a>

        <button
          type="button"
          class="ml-auto rounded-md p-1.5 text-content-muted hover:bg-surface-muted hover:text-content md:hidden"
          aria-label="Cerrar menú"
          (click)="closeMobile()"
        >
          <app-icon name="x" [size]="18" />
        </button>
      </div>

      <nav class="flex-1 space-y-6 overflow-y-auto scrollbar-thin px-3 py-4">
        @for (group of groups(); track group.id) {
          <div>
            @if (group.label && !collapsed()) {
              <p class="mb-2 px-3 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                {{ group.label }}
              </p>
            }
            <ul class="space-y-1">
              @for (item of group.items; track item.id) {
                <li>
                  <app-sidebar-item
                    [item]="item"
                    [collapsed]="collapsed()"
                    (navigated)="closeMobile()"
                  />
                </li>
              }
            </ul>
          </div>
        } @empty {
          @if (!collapsed()) {
            <p class="px-3 text-xs text-content-subtle">Sin accesos disponibles.</p>
          }
        }
      </nav>

      <div class="hidden border-t border-border-subtle p-2 md:block">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-content-muted
                 transition-colors hover:bg-surface-muted hover:text-content"
          [class.justify-center]="collapsed()"
          [attr.aria-label]="collapsed() ? 'Expandir menú' : 'Colapsar menú'"
          (click)="toggleCollapsed()"
        >
          <app-icon
            [name]="collapsed() ? 'panel-left-open' : 'panel-left-close'"
            [size]="18"
          />
          @if (!collapsed()) {
            <span>Colapsar</span>
          }
        </button>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  private readonly layout = inject(LayoutService);
  private readonly navigation = inject(NavigationService);
  private readonly tenant = inject(TenantService);

  readonly groups = this.navigation.groups;
  readonly collapsed = this.layout.sidebarCollapsed;
  readonly mobileOpen = this.layout.sidebarOpen;
  readonly width = computed(() => (this.collapsed() ? 72 : 256));

  readonly tenantName = computed(() => this.tenant.tenant()?.name ?? 'Workspace');

  readonly appName = APP.NAME;
  readonly dashboardLink = '/dashboard';

  toggleCollapsed(): void {
    this.layout.toggleSidebarCollapsed();
  }
  closeMobile(): void {
    this.layout.closeSidebar();
  }
}
