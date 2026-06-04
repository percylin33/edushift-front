import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '@layout/services';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

@Component({
  selector: 'app-onboarding-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 text-center">
      <h1 class="text-2xl font-semibold tracking-tight">Bienvenido a EduShift</h1>
      <p class="mt-2 text-sm text-content-muted">
        Te guiaremos por la configuración inicial en pocos pasos.
      </p>
    </header>

    <div class="space-y-4 text-sm text-content-muted">
      <p>
        Esta cuenta funcionará como el espacio central de tu institución.
        Configuremos el branding, los usuarios principales y el plan.
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
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.onboarding.setSteps(ONBOARDING_STEPS, 'welcome');
  }

  next(): void {
    this.onboarding.markCompleted('welcome');
    this.router.navigate(['/onboarding/school']);
  }
}
