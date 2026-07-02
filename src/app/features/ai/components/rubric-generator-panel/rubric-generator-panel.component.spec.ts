import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubricGeneratorPanelComponent } from './rubric-generator-panel.component';
import { RubricGeneratorService } from '../../services/rubric-generator.service';
import { of, throwError } from 'rxjs';

describe('RubricGeneratorPanelComponent', () => {
  let component: RubricGeneratorPanelComponent;
  let fixture: ComponentFixture<RubricGeneratorPanelComponent>;
  let serviceSpy: jasmine.SpyObj<RubricGeneratorService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('RubricGeneratorService', ['generate']);
    serviceSpy.generate.and.returnValue(of({ title: 'Rúbrica', criteria: [] }));
    await TestBed.configureTestingModule({
      imports: [RubricGeneratorPanelComponent],
      providers: [{ provide: RubricGeneratorService, useValue: serviceSpy }],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricGeneratorPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia con estado vacío', () => {
    expect(component.draft()).toBeNull();
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
  });

  describe('statusLabel', () => {
    it('retorna "Listo" por defecto', () => {
      expect(component.statusLabel()).toBe('Listo');
    });

    it('retorna "Generando rúbrica…" mientras carga', () => {
      component.loading.set(true);
      expect(component.statusLabel()).toBe('Generando rúbrica…');
    });
  });

  describe('addCriterion', () => {
    it('agrega un criterio al form', () => {
      const initial = component.criteriaControls.length;
      component.addCriterion();
      expect(component.criteriaControls.length).toBe(initial + 1);
    });
  });

  describe('removeCriterion', () => {
    it('quita un criterio si hay más de 1', () => {
      component.addCriterion();
      component.removeCriterion(0);
      expect(component.criteriaControls.length).toBeGreaterThanOrEqual(1);
    });

    it('no quita si solo hay 1 criterio', () => {
      component.removeCriterion(0);
      expect(component.criteriaControls.length).toBe(1);
    });
  });

  describe('onGenerate', () => {
    it('genera borrador', async () => {
      component.form.patchValue({ courseName: 'Historia' });
      component.criteriaControls.at(0).setValue('Análisis');
      await component.onGenerate();
      expect(component.draft()).toBeTruthy();
    });

    it('maneja error del servicio', async () => {
      serviceSpy.generate.and.returnValue(throwError(() => ({ code: 'ERR', message: 'Falló' })));
      component.form.patchValue({ courseName: 'Historia' });
      component.criteriaControls.at(0).setValue('Análisis');
      await component.onGenerate();
      expect(component.error()).toBeTruthy();
    });
  });

  describe('levelLabels', () => {
    it('retorna labels por defecto si no hay descriptores', () => {
      const labels = component.levelLabels({
        title: 'R',
        criteria: [{ name: 'C', weight: 100, descriptors: {} }],
      });
      expect(labels).toEqual(['L1', 'L2', 'L3', 'L4']);
    });

    it('retorna keys de descriptores', () => {
      const labels = component.levelLabels({
        title: 'R',
        criteria: [{ name: 'C', weight: 100, descriptors: { AD: 'texto' } }],
      });
      expect(labels).toEqual(['AD']);
    });
  });
});
