import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '@layout/services';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

@Component({
  selector: 'app-onboarding-school',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Datos de la institución</h1>
      <p class="mt-1 text-sm text-content-muted">
        Esta información se usa para el branding del tenant.
      </p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="field sm:col-span-2">
        <label class="label" for="ob-name">Nombre de la institución</label>
        <input id="ob-name" class="input" type="text" placeholder="Colegio EduShift" />
      </div>
      <div class="field">
        <label class="label" for="ob-slug">Subdominio</label>
        <input id="ob-slug" class="input" type="text" placeholder="micolegio" />
        <p class="hint">Se usará como <code>micolegio.edushift.app</code></p>
      </div>
      <div class="field">
        <label class="label" for="ob-locale">Idioma</label>
        <select id="ob-locale" class="select">
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>

    <div class="card-footer mt-8 -mx-5 -mb-5 px-5">
      <button type="button" class="btn btn-ghost" (click)="back()">Atrás</button>
      <button type="button" class="btn btn-primary" (click)="next()">Continuar</button>
    </div>
  `
})
export class OnboardingSchoolComponent implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.onboarding.setSteps(ONBOARDING_STEPS, 'school');
    this.onboarding.markCompleted('welcome');
  }

  back(): void { this.router.navigate(['/onboarding/welcome']); }
  next(): void {
    this.onboarding.markCompleted('school');
    this.router.navigate(['/onboarding/complete']);
  }
}
