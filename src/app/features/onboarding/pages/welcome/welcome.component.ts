import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services';
import { OnboardingService } from '@layout/services';
import { OnboardingStore } from '../../store';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

/**
 * Welcome step. No backend side effects — its job is to prime the user
 * for the data-entry step that follows.
 *
 * <h3>What's personalized</h3>
 * The greeting reads {@code AuthService.user()?.firstName} (or falls
 * back to the {@code fullName} parsed at register time). The tenant
 * name in the layout's header is already painted by
 * {@code TenantService}, so we don't repeat it here.
 *
 * <h3>Why no `OnboardingService.markCompleted` here</h3>
 * The {@code welcome} step doesn't gather any input, so we mark it
 * completed only when the user clicks "Empezar". That keeps the
 * stepper UI honest: a user who lands on {@code /onboarding/welcome}
 * and refreshes the page should see the step still as "current", not
 * "completed".
 */
@Component({
  selector: 'app-onboarding-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">
        ¡Bienvenido{{ greetingSuffix() }}!
      </h1>
      <p class="mt-2 text-sm text-content-muted">
        Te guiaremos por la configuración inicial en pocos pasos.
      </p>
    </header>

    <div class="space-y-4 text-sm text-content-muted">
      <p>
        Esta cuenta funcionará como el espacio central de
        <strong class="text-content">{{ tenantName() }}</strong>. En el
        siguiente paso configuraremos el branding (logo, color principal y
        nombre que verán los usuarios) y luego activaremos tu institución.
      </p>
      <p>El proceso toma menos de 3 minutos.</p>
    </div>

    <div class="card-footer mt-8 -mx-5 -mb-5 px-5">
      <button type="button" class="btn btn-primary ml-auto" (click)="next()">
        Empezar
      </button>
    </div>
  `
})
export class OnboardingWelcomeComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly store = inject(OnboardingStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** First name when available, otherwise empty (yields "¡Bienvenido!" without the comma). */
  readonly greetingSuffix = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    const first = user.firstName?.trim();
    if (first) return `, ${first}`;
    /* `fullName` is the only field guaranteed by the auth response; its
     * first whitespace-separated chunk is a reasonable proxy when the
     * user opened the app from cold storage and we haven't fetched the
     * full /auth/me yet. */
    const fromFullName = user.fullName?.trim().split(/\s+/u)[0];
    return fromFullName ? `, ${fromFullName}` : '';
  });

  readonly tenantName = computed(() => this.store.tenant()?.name ?? 'tu institución');

  ngOnInit(): void {
    this.onboarding.setSteps(ONBOARDING_STEPS, 'welcome');
  }

  next(): void {
    this.onboarding.markCompleted('welcome');
    void this.router.navigate(['/onboarding/school']);
  }
}
