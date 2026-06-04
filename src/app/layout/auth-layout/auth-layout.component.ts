import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TenantService } from '@core/services';
import { APP } from '@core/constants';
import { TenantLogoComponent } from '@shared/components';
import { ThemeToggleComponent } from '../components';

/**
 * Public auth shell (login, forgot password, etc.).
 *
 * Desktop: two-pane — left side hosts tenant branding + value props on the
 *          brand gradient; right side hosts the form card.
 * Mobile:  single column, form fills the viewport. The branding column is
 *          hidden to keep the surface focused.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, ThemeToggleComponent, TenantLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen lg:grid-cols-2">
      <aside
        class="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
      >
        <div class="absolute inset-0 bg-gradient-brand"></div>
        <div class="absolute inset-0 bg-grid opacity-10 mix-blend-overlay"></div>

        <div class="relative z-10 flex items-center gap-3">
          <app-tenant-logo variant="mark" size="lg" />
          <div class="flex flex-col leading-tight">
            <span class="text-lg font-semibold tracking-tight">{{ tenantName() }}</span>
            <span class="text-2xs uppercase tracking-wider text-white/70">{{ appName }}</span>
          </div>
        </div>

        <div class="relative z-10 max-w-md space-y-6">
          <h1 class="text-3xl font-semibold tracking-tight text-balance">
            Gestiona tu institución desde un solo lugar.
          </h1>
          <p class="text-white/80">
            EduShift unifica académico, pagos, comunicaciones e inteligencia artificial en una
            plataforma multi-tenant moderna.
          </p>
          <ul class="space-y-2 text-sm text-white/85">
            <li class="flex items-start gap-2">
              <span class="mt-1 h-1.5 w-1.5 rounded-full bg-white"></span>
              Multi-tenant con branding por institución.
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-1 h-1.5 w-1.5 rounded-full bg-white"></span>
              Roles y permisos granulares.
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-1 h-1.5 w-1.5 rounded-full bg-white"></span>
              Reportes e insights con IA integrada.
            </li>
          </ul>
        </div>

        <div class="relative z-10 text-xs text-white/60">
          © {{ year }} {{ appName }}. Todos los derechos reservados.
        </div>
      </aside>

      <section class="relative flex min-h-screen items-center justify-center bg-surface px-6 py-12">
        <div class="absolute right-4 top-4">
          <app-theme-toggle />
        </div>

        <div class="w-full max-w-sm">
          <header class="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
            <app-tenant-logo variant="mark" size="lg" />
            <span class="text-lg font-semibold tracking-tight">{{ tenantName() }}</span>
          </header>

          <router-outlet />
        </div>
      </section>
    </div>
  `
})
export class AuthLayoutComponent {
  private readonly tenant = inject(TenantService);

  readonly appName = APP.NAME;
  readonly year = new Date().getFullYear();
  readonly tenantName = computed(() => this.tenant.tenant()?.name ?? 'Workspace');
}
