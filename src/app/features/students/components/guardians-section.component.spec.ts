import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GuardiansSectionComponent } from './guardians-section.component';
import { StudentsStore } from '../store/students.store';
import { Guardian } from '../models';
import { DocumentType, RelationshipType } from '@core/enums';

describe('GuardiansSectionComponent', () => {
  let fixture: ComponentFixture<GuardiansSectionComponent>;
  let component: GuardiansSectionComponent;
  let fakeStore: {
    guardians: ReturnType<typeof signal<Guardian[]>>;
    loadingGuardians: ReturnType<typeof signal<boolean>>;
    savingGuardian: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    loadGuardians: jasmine.Spy;
    unlinkGuardian: jasmine.Spy;
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
    canPickupStudent: true,
  };

  function configureModule(): void {
    fakeStore = {
      guardians: signal<Guardian[]>([]),
      loadingGuardians: signal(false),
      savingGuardian: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      loadGuardians: jasmine.createSpy('loadGuarders').and.returnValue(Promise.resolve()),
      unlinkGuardian: jasmine.createSpy('unlinkGuardian').and.returnValue(Promise.resolve(true)),
    };
    TestBed.configureTestingModule({
      imports: [GuardiansSectionComponent],
      providers: [{ provide: StudentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(GuardiansSectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('studentPublicUuid', 's-1');
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit dispara loadGuardians vía effect', async () => {
    configureModule();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(fakeStore.loadGuardians).toHaveBeenCalledWith('s-1');
  });

  it('openAddModal y closeAddModal alternan estado', () => {
    configureModule();
    (component as any).openAddModal();
    expect((component as any).addOpen()).toBeTrue();
    expect(fakeStore.clearError).toHaveBeenCalled();
    (component as any).closeAddModal();
    expect((component as any).addOpen()).toBeFalse();
  });

  it('openEditModal y closeEditModal manejan editTarget', () => {
    configureModule();
    (component as any).openEditModal(guardian);
    expect((component as any).editTarget()?.linkPublicUuid).toBe('l-1');
    (component as any).closeEditModal();
    expect((component as any).editTarget()).toBeNull();
  });

  it('retry limpia error y recarga tutores', () => {
    configureModule();
    (component as any).retry();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadGuardians).toHaveBeenCalledWith('s-1');
  });

  it('onUnlink confirmado llama al store', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(true);
    await (component as any).onUnlink(guardian);
    expect(fakeStore.unlinkGuardian).toHaveBeenCalledWith('s-1', 'g-1', 'l-1');
  });

  it('onUnlink cancelado no llama al store', async () => {
    configureModule();
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).onUnlink(guardian);
    expect(fakeStore.unlinkGuardian).not.toHaveBeenCalled();
  });

  it('orderedGuardians ordena primary primero, luego por relación', () => {
    configureModule();
    const secondary: Guardian = {
      ...guardian,
      linkPublicUuid: 'l-2',
      isPrimaryContact: false,
      relationship: RelationshipType.Father,
      firstName: 'Carlos',
      lastName: 'X',
      fullName: 'Carlos X',
    };
    const grandparent: Guardian = {
      ...guardian,
      linkPublicUuid: 'l-3',
      isPrimaryContact: false,
      relationship: RelationshipType.Grandparent,
      firstName: 'Ana',
      lastName: 'Z',
      fullName: 'Ana Z',
    };
    fakeStore.guardians.set([grandparent, secondary, guardian]);
    fixture.detectChanges();
    const ordered = (component as any).orderedGuardians();
    expect(ordered[0].linkPublicUuid).toBe('l-1');
    expect(ordered[1].linkPublicUuid).toBe('l-2');
    expect(ordered[2].linkPublicUuid).toBe('l-3');
  });
});
