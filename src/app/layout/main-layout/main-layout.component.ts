import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent, SidebarComponent, UatBannerComponent } from '../components';
import { SkipLinkComponent } from '@core/a11y/skip-link.component';

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
  imports: [RouterOutlet, SidebarComponent, NavbarComponent, UatBannerComponent, SkipLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-skip-link />

    <div class="flex min-h-screen bg-surface-subtle text-content">
      <nav aria-label="Navegación principal" class="shrink-0">
        <app-sidebar />
      </nav>

      <div class="flex min-w-0 flex-1 flex-col">
        <app-uat-banner />
        <app-navbar />
        <!-- No inner container: each routed page declares its own gutters via
             <app-page-container>. This keeps data-heavy / full-bleed pages
             flexible (tables, kanban boards). -->
        <main id="main-content" tabindex="-1" class="flex-1 overflow-y-auto focus:outline-none">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {}
