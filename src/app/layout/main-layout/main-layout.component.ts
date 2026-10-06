import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  RouteConfigLoadStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { NavbarComponent, SidebarComponent, UatBannerComponent } from '../components';
import { SkipLinkComponent } from '@core/a11y/skip-link.component';
import { PaymentAccessBannerComponent } from '@features/payments/components/payment-access-banner/payment-access-banner.component';
import { SpinnerComponent } from '@shared/components';

/**
 * Authenticated app shell.
 *
 * Composition:
 *   - `app-sidebar`   → vertical nav (collapsible desktop, drawer mobile)
 *   - content column  → `app-navbar` sticky on top + routed content below
 *
 * <h3>a11y landmarks (WCAG 2.4.1 / 1.3.1)</h3>
 * <ul>
 *   <li>{@code <app-skip-link>} jumps keyboard users to the main region
 *       on first Tab press.</li>
 *   <li>{@code <nav aria-label="Principal">} marks the sidebar so screen
 *       readers can skip it.</li>
 *   <li>{@code <main id="main-content" tabindex="-1">} is the
 *       programmatic focus target; the skip link focuses it on click.</li>
 * </ul>
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    NavbarComponent,
    UatBannerComponent,
    PaymentAccessBannerComponent,
    SkipLinkComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-skip-link />

    <div class="flex min-h-screen bg-surface-subtle text-content">
      <nav aria-label="Navegación principal" class="shrink-0">
        <app-sidebar />
      </nav>

      <div class="flex min-w-0 flex-1 flex-col">
        <app-uat-banner />
        <app-payment-access-banner />
        <app-navbar />
        <!-- No inner container: each routed page declares its own gutters via
             <app-page-container>. This keeps data-heavy / full-bleed pages
             flexible (tables, kanban boards). -->
        <main
          id="main-content"
          tabindex="-1"
          class="relative flex-1 overflow-y-auto focus:outline-none"
          [attr.aria-busy]="routeLoading()"
        >
          @if (routeLoading()) {
            <div
              class="absolute inset-0 z-10 flex items-center justify-center bg-surface-subtle/80"
              role="status"
              aria-live="polite"
            >
              <div
                class="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
              >
                <app-spinner [size]="22" label="Cargando módulo" />
                <span class="text-sm font-medium text-content">Cargando…</span>
              </div>
            </div>
          }
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** True while a lazy route chunk is downloading, before the page can render. */
  readonly routeLoading = signal(false);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof RouteConfigLoadStart) {
        this.routeLoading.set(true);
        return;
      }
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.routeLoading.set(false);
      }
    });
  }
}
