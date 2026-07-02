import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GradeRecordFormModalComponent } from './grade-record-form-modal.component';
import { EvaluationScale } from '@features/evaluations/models';

describe('GradeRecordFormModalComponent', () => {
  let component: GradeRecordFormModalComponent;
  let fixture: ComponentFixture<GradeRecordFormModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GradeRecordFormModalComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GradeRecordFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('scale', EvaluationScale.SCORE_0_20);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('errorBanner', null);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra título "Registrar nota" en modo creación', () => {
    expect(component.title()).toBe('Registrar nota');
  });

  describe('editing', () => {
    it('retorna false por defecto', () => {
      expect(component.editing()).toBeFalse();
    });

    it('retorna true si row está presente', () => {
      fixture.componentRef.setInput('row', { studentFullName: 'Juan' } as any);
      fixture.detectChanges();
      expect(component.editing()).toBeTrue();
    });
  });

  describe('submitLabel', () => {
    it('retorna "Registrar" en modo creación', () => {
      expect(component.submitLabel()).toBe('Registrar');
    });
  });

  describe('onSubmit', () => {
    it('emite submitted con datos válidos', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      component.form.patchValue({
        studentPublicUuid: 'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa',
        score: 15,
        literal: '',
        comments: '',
      });
      component.onSubmit();
      expect(emitSpy).toHaveBeenCalled();
    });

    it('no emite si UUID es inválido', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      component.form.patchValue({
        studentPublicUuid: 'invalido',
        score: 15,
        literal: '',
        comments: '',
      });
      component.onSubmit();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('no emite si form es inválido', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      component.onSubmit();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('showError', () => {
    it('retorna null si control no tiene errores', () => {
      expect(component.showError('score')).toBeNull();
    });

    it('retorna "Requerido" si required', () => {
      const ctrl = component.form.get('studentPublicUuid');
      ctrl!.setErrors({ required: true });
      ctrl!.markAsTouched();
      expect(component.showError('studentPublicUuid')).toBe('Requerido.');
    });
  });

  describe('cancel', () => {
    it('emite closed', () => {
      const emitSpy = spyOn(component.closed, 'emit');
      component.cancel();
      expect(emitSpy).toHaveBeenCalled();
    });
  });
});
