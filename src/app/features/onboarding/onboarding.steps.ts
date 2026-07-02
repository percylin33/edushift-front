import { OnboardingStep } from '@layout/models';

/**
 * Linear wizard definition. Each step's `id` must match the path segment of
 * the corresponding child route so `OnboardingLayoutComponent` can reflect
 * the active step in the visual stepper.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'welcome', label: 'Bienvenida', description: 'Empieza aquí' },
  { id: 'school', label: 'Institución', description: 'Branding del tenant' },
  { id: 'complete', label: 'Listo', description: 'Confirmación' },
];
