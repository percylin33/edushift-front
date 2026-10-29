import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { GradeRecordFormModalComponent } from './grade-record-form-modal.component';
import { EvaluationScale } from '@features/evaluations/models';
import { GradeRecordRow } from '../models';

const gradeRecordRow: GradeRecordRow = {
  publicUuid: 'record-1',
  studentPublicUuid: 'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa',
  studentFullName: 'Juan Pérez',
  studentLastName: 'Pérez',
  studentFirstName: 'Juan',
  score: 12,
  literal: null,
  comments: null,
  recordedAt: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
interface GradeRecordFormTestApi {
  title(): string;
  editing(): boolean;
  submitLabel(): string;
  form: FormGroup;
  onSubmit(): void;
  showError(field: string): string | null;
  cancel(): void;
}
describe('GradeRecordFormModalComponent', () => {
  let component: GradeRecordFormModalComponent;
  let fixture: ComponentFixture<GradeRecordFormModalComponent>;

  function testApi(): GradeRecordFormTestApi {
    return component as unknown as GradeRecordFormTestApi;
  }

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
    expect(testApi().title()).toBe('Registrar nota');
  });

  describe('editing', () => {
    it('retorna false por defecto', () => {
      expect(testApi().editing()).toBeFalse();
    });

    it('retorna true si row está presente', () => {
      fixture.componentRef.setInput('row', gradeRecordRow);
      fixture.detectChanges();
      expect(testApi().editing()).toBeTrue();
    });
  });

  describe('submitLabel', () => {
    it('retorna "Registrar" en modo creación', () => {
      expect(testApi().submitLabel()).toBe('Registrar');
    });
  });

  describe('onSubmit', () => {
    it('emite submitted con datos válidos', () => {
      fixture.componentRef.setInput('students', [
        { publicUuid: 'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa', fullName: 'Pérez, Ana' },
      ]);
      fixture.detectChanges();
      const emitSpy = spyOn(component.submitted, 'emit');
      testApi().form.patchValue({
        studentPublicUuid: 'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa',
        score: 15,
        literal: '',
        comments: '',
      });
      testApi().onSubmit();
      expect(emitSpy).toHaveBeenCalled();
    });

    it('no emite si UUID es inválido', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      testApi().form.patchValue({
        studentPublicUuid: 'invalido',
        score: 15,
        literal: '',
        comments: '',
      });
      testApi().onSubmit();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('no emite si form es inválido', () => {
      const emitSpy = spyOn(component.submitted, 'emit');
      testApi().onSubmit();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('student select', () => {
    it('renderiza select de estudiantes en modo creación', () => {
      fixture.componentRef.setInput('students', [
        { publicUuid: 'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa', fullName: 'Pérez, Ana' },
      ]);
      fixture.detectChanges();
      const select: HTMLSelectElement | null =
        fixture.nativeElement.querySelector('#grade-student');
      expect(select).toBeTruthy();
      expect(select!.options.length).toBe(2); // placeholder + 1 student
      expect(select!.options[1].textContent).toContain('Pérez, Ana');
    });

    it('no muestra select de estudiante en modo edición', () => {
      fixture.componentRef.setInput('row', gradeRecordRow);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#grade-student')).toBeNull();
    });
  });

  describe('showError', () => {
    it('retorna null si control no tiene errores', () => {
      expect(testApi().showError('score')).toBeNull();
    });

    it('retorna "Requerido" si required', () => {
      const ctrl = testApi().form.get('studentPublicUuid');
      ctrl!.setErrors({ required: true });
      ctrl!.markAsTouched();
      expect(testApi().showError('studentPublicUuid')).toBe('Requerido.');
    });
  });

  describe('cancel', () => {
    it('emite closed', () => {
      const emitSpy = spyOn(component.closed, 'emit');
      testApi().cancel();
      expect(emitSpy).toHaveBeenCalled();
    });
  });
});
