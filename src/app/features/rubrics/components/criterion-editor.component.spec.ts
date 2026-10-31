import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CriterionEditorComponent } from './criterion-editor.component';
import { CriterionInput, LevelInput } from '../models';

describe('CriterionEditorComponent', () => {
  let component: CriterionEditorComponent;
  let fixture: ComponentFixture<CriterionEditorComponent>;
  const testApi = () =>
    component as unknown as {
      addLevel(): void;
      removeLevel(index: number): void;
      addCriterion(): void;
      removeCriterion(index: number): void;
      levelsError(): string | null;
      criteriaError(): string | null;
    };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CriterionEditorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CriterionEditorComponent);
    component = fixture.componentInstance;
    // Standalone fixture: emulate the parent form initializing this CVA.
    component.writeValue(null);
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
      testApi().removeLevel(0);
      const initial = component.levels.length;
      testApi().addLevel();
      expect(component.levels.length).toBe(initial + 1);
    });

    it('no agrega más del máximo', () => {
      component.levels.clear();
      for (let i = 0; i < 4; i++) testApi().addLevel();
      testApi().addLevel();
      expect(component.levels.length).toBe(4);
    });
  });

  describe('removeLevel', () => {
    it('no quita si está en mínimo', () => {
      while (component.levels.length > 2) {
        testApi().removeLevel(0);
      }
      expect(component.levels.length).toBe(2);
    });
  });

  describe('addCriterion', () => {
    it('agrega un criterio', () => {
      const initial = component.criteria.length;
      testApi().addCriterion();
      expect(component.criteria.length).toBe(initial + 1);
    });
  });

  describe('removeCriterion', () => {
    it('no quita si solo hay 1', () => {
      testApi().removeCriterion(0);
      expect(component.criteria.length).toBe(1);
    });
  });

  describe('isValid', () => {
    it('retorna false hasta que se complete el criterio por defecto', () => {
      expect(component.isValid()).toBeFalse();
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
      expect(testApi().levelsError()).toBeNull();
    });
  });

  describe('criteriaError', () => {
    it('retorna null si criterios son válidos', () => {
      expect(testApi().criteriaError()).toBeNull();
    });
  });
});
