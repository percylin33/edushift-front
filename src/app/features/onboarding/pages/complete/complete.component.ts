import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '@layout/services';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

@Component({
  selector: 'app-onboarding-complete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Listo</h1>
      <p class="mt-2 text-sm text-content-muted">
        Tu institución quedó configurada. Ya puedes ir al dashboard.
      </p>
    </div>

    <div class="card-footer mt-8 -mx-5 -mb-5 px-5">
      <button type="button" class="btn btn-primary ml-auto" (click)="finish()">
        Ir al dashboard
      </button>
    </div>
  `
})
export class OnboardingCompleteComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.onboarding.setSteps(ONBOARDING_STEPS, 'complete');
    this.onboarding.markCompleted('welcome');
    this.onboarding.markCompleted('school');
    this.onboarding.markCompleted('complete');
  }

  finish(): void {
    this.router.navigate(['/dashboard']);
  }
}
