import { Injectable, computed, signal } from '@angular/core';
import { OnboardingStep } from '../models';

/**
 * Layout-scoped state for the onboarding wizard.
 *
 * Provided at the `OnboardingLayoutComponent` level (not in `root`) so that
 * leaving the layout discards the wizard state automatically. Children of the
 * layout inject it and call `setSteps()` / `setActive()` from `ngOnInit` /
 * route guards to drive the visible stepper.
 */
@Injectable()
export class OnboardingService {
  private readonly _steps = signal<OnboardingStep[]>([]);
  private readonly _activeId = signal<string | null>(null);

  readonly steps = this._steps.asReadonly();
  readonly activeId = this._activeId.asReadonly();

  readonly activeIndex = computed(() => {
    const id = this._activeId();
    return id ? this._steps().findIndex((s) => s.id === id) : -1;
  });
  readonly total = computed(() => this._steps().length);
  readonly hasSteps = computed(() => this._steps().length > 0);

  setSteps(steps: readonly OnboardingStep[], activeId?: string): void {
    this._steps.set([...steps]);
    this._activeId.set(activeId ?? steps[0]?.id ?? null);
  }

  setActive(id: string): void {
    this._activeId.set(id);
  }

  markCompleted(id: string, completed = true): void {
    this._steps.update((list) =>
      list.map((step) => (step.id === id ? { ...step, completed } : step)),
    );
  }

  reset(): void {
    this._steps.set([]);
    this._activeId.set(null);
  }
}
