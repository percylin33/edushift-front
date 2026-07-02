import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AddGuardianModalComponent } from './add-guardian-modal.component';
import { StudentsStore } from '../store/students.store';
import { Guardian } from '../models';
import { DocumentType, RelationshipType } from '@core/enums';

describe('AddGuardianModalComponent', () => {
  let fixture: ComponentFixture<AddGuardianModalComponent>;
  let component: AddGuardianModalComponent;
  let fakeStore: {
    savingGuardian: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    addGuardian: jasmine.Spy;
  };

  function configureModule(): void {
    fakeStore = {
      savingGuardian: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      addGuardian: jasmine.createSpy('addGuardian').and.returnValue(Promise.resolve(null)),
    };
    TestBed.configureTestingModule({
      imports: [AddGuardianModalComponent],
      providers: [{ provide: StudentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(AddGuardianModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('studentPublicUuid', 's-1');
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('inicia con form inválido (sin required)', () => {
    configureModule();
    expect((component as any).form.invalid).toBeTrue();
    expect((component as any).canSubmit()).toBeFalse();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    (component as any).close();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('onSubmit con form inválido no llama store', async () => {
    configureModule();
    await (component as any).onSubmit();
    expect(fakeStore.addGuardian).not.toHaveBeenCalled();
  });

  it('onSubmit válido llama store con payload', async () => {
    configureModule();
    (component as any).form.patchValue({
      documentType: DocumentType.Dni,
      documentNumber: '12345678',
      firstName: 'Maria',
      lastName: 'Gomez',
      email: 'm@test.com',
      phone: '555',
      occupation: 'Doc',
      relationship: RelationshipType.Mother,
      isPrimaryContact: true,
      canPickupStudent: true,
    });
    await (component as any).onSubmit();
    expect(fakeStore.addGuardian).toHaveBeenCalledWith(
      's-1',
      jasmine.objectContaining({
        documentNumber: '12345678',
        firstName: 'Maria',
        isPrimaryContact: true,
      }),
    );
  });

  it('onSubmit cierra al recibir guardian', async () => {
    configureModule();
    const guardian: Guardian = { linkPublicUuid: 'l-1' } as any;
    fakeStore.addGuardian.and.returnValue(Promise.resolve(guardian));
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    (component as any).form.patchValue({
      documentType: DocumentType.Dni,
      documentNumber: '12345678',
      firstName: 'Maria',
      lastName: 'Gomez',
      relationship: RelationshipType.Mother,
    });
    await (component as any).onSubmit();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('showError retorna mensajes específicos por validador', () => {
    configureModule();
    const ctrl = (component as any).form.get('documentNumber')!;
    ctrl.setValue('a');
    ctrl.markAsTouched();
    expect((component as any).showError('documentNumber')).toContain('al menos');

    const emailCtrl = (component as any).form.get('email')!;
    emailCtrl.setValue('no-email');
    emailCtrl.markAsTouched();
    expect((component as any).showError('email')).toContain('email');

    const lastCtrl = (component as any).form.get('lastName')!;
    lastCtrl.markAsTouched();
    expect((component as any).showError('lastName')).toBe('Campo requerido.');

    expect((component as any).showError('nonexistent')).toBeNull();
  });

  it('showError retorna null si control no tocado', () => {
    configureModule();
    expect((component as any).showError('firstName')).toBeNull();
  });

  it('applyServerErrors mapea GUARDIAN_ALREADY_LINKED a documentNumber', () => {
    configureModule();
    const err = new HttpErrorResponse({
      error: { errors: [{ code: 'GUARDIAN_ALREADY_LINKED', message: 'ya vinculado' }] },
    });
    (component as any).applyServerErrors(err);
    expect((component as any)['fieldErrors']()['documentNumber']).toContain('ya está vinculado');
  });

  it('applyServerErrors ignora errores no HttpErrorResponse', () => {
    configureModule();
    expect(() => (component as any).applyServerErrors(new Error('x'))).not.toThrow();
  });

  it('optionalString retorna undefined para vacío', () => {
    configureModule();
    expect((component as any).optionalString('')).toBeUndefined();
    expect((component as any).optionalString(null)).toBeUndefined();
    expect((component as any).optionalString('  ')).toBeUndefined();
    expect((component as any).optionalString('a')).toBe('a');
  });
});
