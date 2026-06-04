import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent, SidebarComponent } from '../components';

/**
 * Authenticated app shell.
 *
 * Composition:
 *   - `app-sidebar`   → vertical nav (collapsible desktop, drawer mobile)
 *   - content column  → `app-navbar` sticky on top + routed content below
 *
 * The shell stays role-agnostic; what each user sees inside the sidebar is
 * decided by `NavigationService` based on roles/permissions/feature flags.
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen bg-surface-subtle text-content">
      <app-sidebar />

      <div class="flex min-w-0 flex-1 flex-col">
        <app-navbar />
        <!-- No inner container: each routed page declares its own gutters via
             <app-page-container>. This keeps data-heavy / full-bleed pages
             flexible (tables, kanban boards). -->
        <main class="flex-1 overflow-y-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class MainLayoutComponent {}
