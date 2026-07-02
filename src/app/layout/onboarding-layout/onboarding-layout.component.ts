import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IconComponent, TenantLogoComponent } from '@shared/components';
import { TenantService } from '@core/services';
import { APP } from '@core/constants';
import { OnboardingService } from '../services';
import { ThemeToggleComponent } from '../components';

/**
 * Layout for multi-step setup flows (tenant onboarding, user welcome, etc.).
 *
 * Step state is owned by `OnboardingService`, provided at this component so
 * the lifecycle is scoped. The host route should call `setSteps()` once, and
 * each child step should call `setActive(<stepId>)` on enter.
 *
 * Below the stepper a centered card hosts the actual step content via
 * `<router-outlet>`.
 */
@Component({
  selector: 'app-onboarding-layout',
  standalone: true,
  imports: [RouterOutlet, IconComponent, ThemeToggleComponent, TenantLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OnboardingService],
  template: `
    <div class="flex min-h-screen flex-col bg-surface-subtle text-content">
      <header
        class="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur supports-backdrop:bg-surface/70 sm:px-6"
      >
        <div class="flex items-center gap-3">
          <app-tenant-logo variant="mark" size="md" />
          <div class="hidden flex-col leading-tight sm:flex">
            <span class="text-sm font-semibold tracking-tight">{{ tenantName() }}</span>
            <span class="text-2xs uppercase tracking-wider text-content-subtle">
              {{ appName }} · Onboarding
            </span>
          </div>
        </div>

        @if (hasSteps()) {
          <p class="text-sm text-content-muted">
            Paso <span class="font-medium text-content">{{ activeIndex() + 1 }}</span>
            <span class="text-content-subtle"> / {{ total() }}</span>
          </p>
        }

        <app-theme-toggle />
      </header>

      @if (hasSteps()) {
        <nav
          class="border-b border-border bg-surface px-4 py-4 sm:px-6"
          aria-label="Progreso de onboarding"
        >
          <ol class="mx-auto flex max-w-3xl items-center gap-2 sm:gap-4">
            @for (step of steps(); track step.id; let i = $index; let last = $last) {
              <li class="flex flex-1 items-center gap-2 sm:gap-4">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors"
                  [class.border-primary-600]="i === activeIndex() || step.completed"
                  [class.bg-primary-600]="i === activeIndex() || step.completed"
                  [class.text-white]="i === activeIndex() || step.completed"
                  [class.border-border]="i !== activeIndex() && !step.completed"
                  [class.text-content-subtle]="i !== activeIndex() && !step.completed"
                  [attr.aria-current]="i === activeIndex() ? 'step' : null"
                >
                  @if (step.completed && i !== activeIndex()) {
                    <app-icon name="check" [size]="14" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <div class="hidden min-w-0 flex-col sm:flex">
                  <span
                    class="truncate text-sm font-medium"
                    [class.text-content]="i === activeIndex()"
                    [class.text-content-muted]="i !== activeIndex()"
                  >
                    {{ step.label }}
                  </span>
                  @if (step.description) {
                    <span class="truncate text-xs text-content-subtle">{{ step.description }}</span>
                  }
                </div>
                @if (!last) {
                  <span
                    class="hidden h-px flex-1 sm:block"
                    [class.bg-primary-500]="step.completed"
                    [class.bg-border]="!step.completed"
                    aria-hidden="true"
                  ></span>
                }
              </li>
            }
          </ol>
        </nav>
      }

      <main class="flex flex-1 items-start justify-center px-4 py-10 sm:px-6">
        <div class="w-full max-w-2xl">
          <div class="card animate-fade-in">
            <div class="card-body">
              <router-outlet />
            </div>
          </div>
        </div>
      </main>

      <footer class="border-t border-border-subtle py-4 text-center text-xs text-content-subtle">
        © {{ year }} {{ appName }}
      </footer>
    </div>
  `,
})
export class OnboardingLayoutComponent {
  private readonly tenant = inject(TenantService);
  private readonly onboarding = inject(OnboardingService);

  readonly appName = APP.NAME;
  readonly year = new Date().getFullYear();

  readonly tenantName = computed(() => this.tenant.tenant()?.name ?? 'Workspace');

  readonly steps = this.onboarding.steps;
  readonly activeIndex = this.onboarding.activeIndex;
  readonly total = this.onboarding.total;
  readonly hasSteps = this.onboarding.hasSteps;
}
