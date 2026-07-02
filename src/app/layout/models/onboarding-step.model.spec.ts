import { OnboardingStep } from './onboarding-step.model';

describe('OnboardingStep', () => {
  it('crea un paso con solo id y label', () => {
    const step: OnboardingStep = { id: 'welcome', label: 'Bienvenido' };
    expect(step.id).toBe('welcome');
    expect(step.label).toBe('Bienvenido');
  });

  it('permite description y completed opcionales', () => {
    const step: OnboardingStep = {
      id: 'done',
      label: 'Completado',
      description: 'Paso final',
      completed: true,
    };
    expect(step.description).toBe('Paso final');
    expect(step.completed).toBeTrue();
  });
});
