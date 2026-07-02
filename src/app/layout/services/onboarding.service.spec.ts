import { TestBed } from '@angular/core/testing';
import { OnboardingService } from './onboarding.service';
import { OnboardingStep } from '../models';

describe('OnboardingService', () => {
  let service: OnboardingService;

  const mockSteps: OnboardingStep[] = [
    { id: 'step-1', label: 'Paso 1' },
    { id: 'step-2', label: 'Paso 2' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnboardingService);
  });

  it('inicia sin pasos ni activo', () => {
    expect(service.steps()).toEqual([]);
    expect(service.activeId()).toBeNull();
    expect(service.hasSteps()).toBeFalse();
    expect(service.total()).toBe(0);
    expect(service.activeIndex()).toBe(-1);
  });

  it('setSteps establece los pasos y activa el primero', () => {
    service.setSteps(mockSteps);
    expect(service.steps().length).toBe(2);
    expect(service.activeId()).toBe('step-1');
    expect(service.hasSteps()).toBeTrue();
    expect(service.total()).toBe(2);
  });

  it('setSteps respeta el activeId opcional', () => {
    service.setSteps(mockSteps, 'step-2');
    expect(service.activeId()).toBe('step-2');
  });

  it('setActive cambia el paso activo', () => {
    service.setSteps(mockSteps);
    service.setActive('step-2');
    expect(service.activeId()).toBe('step-2');
    expect(service.activeIndex()).toBe(1);
  });

  it('markCompleted marca un paso como completado', () => {
    service.setSteps(mockSteps);
    service.markCompleted('step-1');
    expect(service.steps()[0].completed).toBeTrue();
  });

  it('reset limpia todo el estado', () => {
    service.setSteps(mockSteps);
    service.reset();
    expect(service.steps()).toEqual([]);
    expect(service.activeId()).toBeNull();
  });
});
