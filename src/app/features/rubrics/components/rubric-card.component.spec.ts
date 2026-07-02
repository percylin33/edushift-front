import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubricCardComponent } from './rubric-card.component';
import { RubricRow } from '../models';

describe('RubricCardComponent', () => {
  let component: RubricCardComponent;
  let fixture: ComponentFixture<RubricCardComponent>;

  const mockRubric: RubricRow = {
    publicUuid: 'r1',
    name: 'Rúbrica Test',
    description: 'Descripción',
    isSystem: false,
    parentRubricPublicUuid: undefined,
    criterionCount: 3,
    criterionSummary: ['50% Análisis', '50% Síntesis'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RubricCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rubric', mockRubric);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('recibe input rubric', () => {
    expect(component.rubric().name).toBe('Rúbrica Test');
  });

  describe('emisiones', () => {
    it('emite view al hacer clic', () => {
      const spy = spyOn(component.view, 'emit');
      component.view.emit('r1');
      expect(spy).toHaveBeenCalledWith('r1');
    });

    it('emite edit', () => {
      const spy = spyOn(component.edit, 'emit');
      component.edit.emit('r1');
      expect(spy).toHaveBeenCalledWith('r1');
    });

    it('emite fork', () => {
      const spy = spyOn(component.fork, 'emit');
      component.fork.emit('r1');
      expect(spy).toHaveBeenCalledWith('r1');
    });

    it('emite remove', () => {
      const spy = spyOn(component.remove, 'emit');
      component.remove.emit('r1');
      expect(spy).toHaveBeenCalledWith('r1');
    });
  });
});
