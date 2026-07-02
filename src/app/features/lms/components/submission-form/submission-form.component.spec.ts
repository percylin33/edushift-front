import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubmissionFormComponent } from './submission-form.component';
import { SubmissionStatus } from '../../models';

describe('SubmissionFormComponent', () => {
  let component: SubmissionFormComponent;
  let fixture: ComponentFixture<SubmissionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmissionFormComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SubmissionFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('assignmentUuid', 'a-1');
    fixture.componentRef.setInput('existingSubmission', null);
    fixture.componentRef.setInput('allowResubmissions', false);
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('emite submitCreate al enviar sin submission existente', () => {
    spyOn(component.submitCreate, 'emit');
    component.form.patchValue({ textContent: 'Mi respuesta' });
    component.onSubmit();
    expect(component.submitCreate.emit).toHaveBeenCalled();
  });

  it('emite submitUpdate al enviar con submission existente', () => {
    spyOn(component.submitUpdate, 'emit');
    fixture.componentRef.setInput('existingSubmission', {
      publicUuid: 'sub-1',
      status: SubmissionStatus.Returned,
    } as any);
    fixture.detectChanges();
    component.form.patchValue({ textContent: 'Re-entrega' });
    component.onSubmit();
    expect(component.submitUpdate.emit).toHaveBeenCalled();
  });

  it('no emite si form inválido', () => {
    spyOn(component.submitCreate, 'emit');
    component.form.get('textContent')!.setErrors({ maxlength: true });
    component.onSubmit();
    expect(component.submitCreate.emit).not.toHaveBeenCalled();
  });

  it('no emite si no hay texto ni archivo', () => {
    spyOn(component.submitCreate, 'emit');
    component.onSubmit();
    expect(component.submitCreate.emit).not.toHaveBeenCalled();
  });

  it('muestra error si fileError está seteado', () => {
    (component as any).fileError.set('Archivo no permitido');
    component.onSubmit();
    expect(component.errorBanner()).toBe('Archivo no permitido');
  });

  it('formatSize formatea bytes', () => {
    expect(component.formatSize(500)).toBe('500 B');
    expect(component.formatSize(2048)).toBe('2.0 KB');
    expect(component.formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
