import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { IconComponent } from '@shared/components';

/**
 * Settings shell with a left-side internal navigation (Sprint 17 / FE-17.4).
 *
 * <p>Why a shell at all instead of a single page with anchors: each
 * sub-section lives in its own routed component so deep-links work
 * ({@code /settings/security} survives a refresh, can be sent in a
 * support email, etc.) and so each section can lazy-load its own
 * dependencies (the tenant-branding section pulls a heavy color
 * picker only when it's actually visited).</p>
 *
 * <h3>Admin gating</h3>
 * The "Branding" sub-item is hidden for non-ADMIN users. The route
 * itself is also guarded server-side; the client-side hide is purely
 * UX (no point showing a link that 403s).
 */
@Component({
  selector: 'app-settings-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  template: `
    <div
      class="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 py-8 sm:py-10 lg:grid-cols-[14rem_1fr]"
    >
      <aside class="lg:sticky lg:top-20 lg:self-start">
        <nav
          aria-label="Configuración"
          class="rounded-lg border border-border bg-surface-raised p-2"
        >
          <ul
            class="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible"
          >
            <li>
              <a
                [routerLink]="userLink"
                routerLinkActive
                #rla="routerLinkActive"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
                [class.bg-surface-muted]="rla.isActive"
              >
                <app-icon name="user" [size]="16" />
                Mi cuenta
              </a>
            </li>
            <li>
              <a
                [routerLink]="securityLink"
                routerLinkActive
                #rlaS="routerLinkActive"
                [attr.aria-current]="rlaS.isActive ? 'page' : null"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
                [class.bg-surface-muted]="rlaS.isActive"
              >
                <app-icon name="lock" [size]="16" />
                Seguridad
              </a>
            </li>
            @if (isAdmin()) {
              <li>
                <a
                  [routerLink]="tenantLink"
                  routerLinkActive
                  #rlaT="routerLinkActive"
                  [attr.aria-current]="rlaT.isActive ? 'page' : null"
                  class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
                  [class.bg-surface-muted]="rlaT.isActive"
                >
                  <app-icon name="settings" [size]="16" />
                  Institución
                </a>
              </li>
              <li>
                <a
                  [routerLink]="permissionsLink"
                  routerLinkActive
                  #rlaP="routerLinkActive"
                  [attr.aria-current]="rlaP.isActive ? 'page' : null"
                  class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-content hover:bg-surface-muted"
                  [class.bg-surface-muted]="rlaP.isActive"
                  data-testid="sidebar-permissions"
                >
                  <app-icon name="lock" [size]="16" />
                  Permisos
                </a>
              </li>
            }
          </ul>
        </nav>
      </aside>

      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class SettingsShellComponent {
  private readonly auth = inject(AuthService);

  // Sub-route paths. Centralized in the shell so the sidebar
  // updates propagate from a single edit. The actual routes are
  // declared in `settings.routes.ts` and must agree with these.
  protected readonly userLink = ['/settings'];
  protected readonly securityLink = ['/settings', 'security'];
  protected readonly tenantLink = ['/settings', 'tenant'];
  protected readonly permissionsLink = ['/settings', 'permissions'];

  protected readonly isAdmin = computed(
    () => this.auth.hasRole(UserRole.TenantAdmin) || this.auth.hasRole(UserRole.SuperAdmin),
  );
}
