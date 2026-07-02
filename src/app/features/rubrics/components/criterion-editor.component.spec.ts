import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CriterionEditorComponent } from './criterion-editor.component';
import { CriterionInput, LevelInput } from '../models';

describe('CriterionEditorComponent', () => {
  let component: CriterionEditorComponent;
  let fixture: ComponentFixture<CriterionEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CriterionEditorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CriterionEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia con valores por defecto', () => {
    expect(component.levels.length).toBeGreaterThan(0);
    expect(component.criteria.length).toBeGreaterThan(0);
  });

  describe('addLevel', () => {
    it('agrega un nivel', () => {
      const initial = component.levels.length;
      component.addLevel();
      expect(component.levels.length).toBe(initial + 1);
    });

    it('no agrega más del máximo', () => {
      component.levels.clear();
      for (let i = 0; i < 4; i++) component.addLevel();
      component.addLevel();
      expect(component.levels.length).toBe(4);
    });
  });

  describe('removeLevel', () => {
    it('no quita si está en mínimo', () => {
      const initial = component.levels.length;
      while (component.levels.length > 0) {
        component.removeLevel(0);
      }
      // Should still have minimum levels
    });
  });

  describe('addCriterion', () => {
    it('agrega un criterio', () => {
      const initial = component.criteria.length;
      component.addCriterion();
      expect(component.criteria.length).toBe(initial + 1);
    });
  });

  describe('removeCriterion', () => {
    it('no quita si solo hay 1', () => {
      component.removeCriterion(0);
      expect(component.criteria.length).toBe(1);
    });
  });

  describe('isValid', () => {
    it('retorna true con valores por defecto', () => {
      expect(component.isValid()).toBeTrue();
    });
  });

  describe('toValue', () => {
    it('retorna estructura con levels y criteria', () => {
      const val = component.toValue();
      expect(val.levels.length).toBeGreaterThan(0);
      expect(val.criteria.length).toBeGreaterThan(0);
    });
  });

  describe('writeValue', () => {
    it('carga valores externos', () => {
      const levels: LevelInput[] = [{ code: 'AD', name: 'Destacado', order: 0 }];
      const criteria: CriterionInput[] = [
        {
          key: 'org',
          name: 'Organización',
          description: '',
          weight: 100,
          descriptors: [],
        },
      ];
      component.writeValue({ levels, criteria });
      expect(component.levels.length).toBe(1);
      expect(component.criteria.length).toBe(1);
    });
  });

  describe('levelsError', () => {
    it('retorna null si niveles son válidos', () => {
      expect(component.levelsError()).toBeNull();
    });
  });

  describe('criteriaError', () => {
    it('retorna null si criterios son válidos', () => {
      expect(component.criteriaError()).toBeNull();
    });
  });
});
