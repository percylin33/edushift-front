import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { TenantService } from '@core/services';
import { APP } from '@core/constants';
import { AlertComponent, SpinnerComponent, TenantLogoComponent } from '@shared/components';
import { ThemeToggleComponent } from '../components';

/**
 * Public auth shell (login, forgot password, etc.).
 *
 * <h3>Loading / error boundary</h3>
 * The right panel renders the child route inside a {@code <router-outlet>}.
 * If a lazy chunk fails to load, or the route resolves to nothing, the
 * outlet would otherwise render an empty box with zero feedback. We
 * subscribe to {@code Router.events} and surface:
 * <ul>
 *   <li>{@code NavigationError} → red alert with the underlying error</li>
 *   <li>{@code RouteConfigLoadStart} → spinner</li>
 *   <li>{@code RouteConfigLoadEnd} → clear spinner</li>
 *   <li>{@code NavigationEnd} with empty outlet → warning "Pantalla no disponible"</li>
 * </ul>
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    ThemeToggleComponent,
    TenantLogoComponent,
    AlertComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen lg:grid-cols-2">
      <aside
        class="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
      >
        <div class="bg-gradient-brand absolute inset-0"></div>
        <div class="bg-grid absolute inset-0 opacity-10 mix-blend-overlay"></div>

        <div class="relative z-10 flex items-center gap-3">
          <app-tenant-logo variant="mark" size="lg" />
          <div class="flex flex-col leading-tight">
            <span class="text-lg font-semibold tracking-tight">{{ tenantName() }}</span>
            <span class="text-2xs uppercase tracking-wider text-white/70">{{ appName }}</span>
          </div>
        </div>

        <div class="relative z-10 max-w-md space-y-6">
          <h1 class="text-balance text-3xl font-semibold tracking-tight">
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

          @if (loadError(); as message) {
            <app-alert variant="error" [message]="message" />
          } @else if (showLoadingState()) {
            <div class="flex items-center justify-center py-12">
              <app-spinner [size]="28" label="Cargando…" />
            </div>
          } @else {
            <router-outlet />
          }
        </div>
      </section>
    </div>
  `,
})
export class AuthLayoutComponent {
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly appName = APP.NAME;
  readonly year = new Date().getFullYear();
  readonly tenantName = computed(() => this.tenant.tenant()?.name ?? 'Workspace');

  private readonly _routeLoading = signal(false);
  private readonly _loadError = signal<string | null>(null);
  /** Counter of lazy chunk loads since the last NavigationEnd. >0 means we're mid-load. */
  private loadCount = 0;

  readonly showLoadingState = computed(() => this._routeLoading() && !this._loadError());
  readonly loadError = this._loadError.asReadonly();

  constructor() {
    this.router.events
      .pipe(
        filter(
          (e): e is NavigationError | NavigationEnd | NavigationCancel =>
            e instanceof NavigationError ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event instanceof NavigationError) {
          this._routeLoading.set(false);
          this._loadError.set('No se pudo cargar la página. Recarga e inténtalo de nuevo.');
          return;
        }
        if (event instanceof NavigationEnd) {
          this._routeLoading.set(false);
          this._loadError.set(null);
          this.loadCount = 0;
          return;
        }
        if (event instanceof NavigationCancel) {
          this._routeLoading.set(false);
        }
      });

    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const e = event as unknown as { constructor: { name: string } };
        if (e?.constructor?.name === 'RouteConfigLoadStart') {
          this.loadCount++;
          this._routeLoading.set(true);
        } else if (e?.constructor?.name === 'RouteConfigLoadEnd') {
          this.loadCount = Math.max(0, this.loadCount - 1);
          if (this.loadCount === 0) this._routeLoading.set(false);
        }
      });
  }
}