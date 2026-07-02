import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForkRubricModalComponent } from './fork-rubric-modal.component';
import { RubricsStore } from '../store';
import { RubricRow } from '../models';

describe('ForkRubricModalComponent', () => {
  let component: ForkRubricModalComponent;
  let fixture: ComponentFixture<ForkRubricModalComponent>;
  let storeSpy: jasmine.SpyObj<RubricsStore>;

  const mockOrigin: RubricRow = {
    publicUuid: 'r1',
    name: 'Rúbrica Original',
    description: 'Desc',
    isSystem: true,
    parentRubricPublicUuid: undefined,
    criterionCount: 3,
    criterionSummary: ['50% A'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    storeSpy = jasmine.createSpyObj('RubricsStore', ['fork', 'clearError'], {
      saving: () => false,
      error: () => null,
    });
    await TestBed.configureTestingModule({
      imports: [ForkRubricModalComponent],
      providers: [{ provide: RubricsStore, useValue: storeSpy }],
    }).compileComponents();
    fixture = TestBed.createComponent(ForkRubricModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('origin', mockOrigin);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  describe('defaultName', () => {
    it('retorna nombre con sufijo (fork)', () => {
      expect(component.defaultName()).toBe('Rúbrica Original (fork)');
    });
  });

  describe('onSubmit', () => {
    it('llama a store.fork con nombre personalizado', async () => {
      storeSpy.fork.and.resolveTo({
        publicUuid: 'r2',
        name: 'Rúbrica Original (fork)',
        description: '',
        criteria: [],
        levels: [],
        isSystem: false,
        parentRubricPublicUuid: 'r1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      component.form.patchValue({ name: 'Mi Fork' });
      const forkedSpy = spyOn(component.forked, 'emit');
      await component.onSubmit();
      expect(storeSpy.fork).toHaveBeenCalledWith('r1', { name: 'Mi Fork' });
      expect(forkedSpy).toHaveBeenCalledWith('r2');
    });

    it('llama a store.fork sin nombre (usa default)', async () => {
      storeSpy.fork.and.resolveTo({
        publicUuid: 'r2',
        name: 'Rúbrica Original (fork)',
        description: '',
        criteria: [],
        levels: [],
        isSystem: false,
        parentRubricPublicUuid: 'r1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const forkedSpy = spyOn(component.forked, 'emit');
      await component.onSubmit();
      expect(storeSpy.fork).toHaveBeenCalledWith('r1', undefined);
      expect(forkedSpy).toHaveBeenCalledWith('r2');
    });

    it('no emite si fork falla', async () => {
      storeSpy.fork.and.resolveTo(null);
      const forkedSpy = spyOn(component.forked, 'emit');
      await component.onSubmit();
      expect(forkedSpy).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('emite closed', () => {
      const closedSpy = spyOn(component.closed, 'emit');
      component.cancel();
      expect(storeSpy.clearError).toHaveBeenCalled();
      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('showError', () => {
    it('retorna null si control no tiene errores', () => {
      expect(component.showError('name')).toBeNull();
    });

    it('retorna mensaje de maxlength', () => {
      const ctrl = component.form.get('name');
      ctrl!.setErrors({ maxlength: { requiredLength: 160 } });
      ctrl!.markAsTouched();
      expect(component.showError('name')).toContain('Máximo');
    });
  });
});
