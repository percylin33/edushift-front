import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EditGuardianLinkModalComponent } from './edit-guardian-link-modal.component';
import { StudentsStore } from '../store/students.store';
import { Guardian } from '../models';
import { DocumentType, RelationshipType } from '@core/enums';

describe('EditGuardianLinkModalComponent', () => {
  let fixture: ComponentFixture<EditGuardianLinkModalComponent>;
  let component: EditGuardianLinkModalComponent;
  let fakeStore: {
    savingGuardian: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    updateGuardianLink: jasmine.Spy;
  };

  const guardian: Guardian = {
    linkPublicUuid: 'l-1',
    guardianPublicUuid: 'g-1',
    documentType: DocumentType.Dni,
    documentNumber: '87654321',
    firstName: 'Maria',
    lastName: 'Gomez',
    fullName: 'Maria Gomez',
    relationship: RelationshipType.Mother,
    isPrimaryContact: true,
    canPickupStudent: false,
  };

  function configureModule(): void {
    fakeStore = {
      savingGuardian: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      updateGuardianLink: jasmine
        .createSpy('updateGuardianLink')
        .and.returnValue(Promise.resolve(null)),
    };
    TestBed.configureTestingModule({
      imports: [EditGuardianLinkModalComponent],
      providers: [{ provide: StudentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(EditGuardianLinkModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('studentPublicUuid', 's-1');
    fixture.componentRef.setInput('guardian', guardian);
    fixture.detectChanges();
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('hidrata form desde guardian en effect', () => {
    configureModule();
    expect((component as any).form.get('relationship')?.value).toBe(RelationshipType.Mother);
    expect((component as any).form.get('isPrimaryContact')?.value).toBeTrue();
    expect((component as any).form.get('canPickupStudent')?.value).toBeFalse();
  });

  it('close emite cancelled y limpia error', () => {
    configureModule();
    const cancelledSpy = jasmine.createSpy('cancelled');
    component.closed.subscribe(cancelledSpy);
    (component as any).close();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(cancelledSpy).toHaveBeenCalled();
  });

  it('onSubmit cierra sin llamar store si no hay cambios', async () => {
    configureModule();
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    await (component as any).onSubmit();
    expect(fakeStore.updateGuardianLink).not.toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('onSubmit con cambios llama store con diff', async () => {
    configureModule();
    (component as any).form.patchValue({
      relationship: RelationshipType.Father,
      isPrimaryContact: false,
      canPickupStudent: true,
    });
    await (component as any).onSubmit();
    expect(fakeStore.updateGuardianLink).toHaveBeenCalledWith('s-1', 'g-1', {
      relationship: RelationshipType.Father,
      isPrimaryContact: false,
      canPickupStudent: true,
    });
  });

  it('onSubmit cierra al recibir guardian actualizado', async () => {
    configureModule();
    const updated: Guardian = { ...guardian, relationship: RelationshipType.Father };
    fakeStore.updateGuardianLink.and.returnValue(Promise.resolve(updated));
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    (component as any).form.patchValue({ relationship: RelationshipType.Father });
    await (component as any).onSubmit();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('onSubmit silencioso si store devuelve null', async () => {
    configureModule();
    fakeStore.updateGuardianLink.and.returnValue(Promise.resolve(null));
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    (component as any).form.patchValue({ relationship: RelationshipType.Father });
    await (component as any).onSubmit();
    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('canSubmit refleja validity y saving', () => {
    configureModule();
    expect((component as any).canSubmit()).toBeTrue();
    fakeStore.savingGuardian.set(true);
    expect((component as any).canSubmit()).toBeFalse();
  });
});
