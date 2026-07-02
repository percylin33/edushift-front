import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { StudentDetailComponent } from './student-detail.component';
import { StudentsStore } from '../../store';
import { StudentDetail } from '../../models';
import { DocumentType, EnrollmentStatus, Gender } from '@core/enums';
import { ROUTES } from '@core/constants';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('StudentDetailComponent', () => {
  let fixture: ComponentFixture<StudentDetailComponent>;
  let component: StudentDetailComponent;
  let fakeStore: {
    selected: ReturnType<typeof signal<StudentDetail | null>>;
    loadingDetail: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    loadDetail: jasmine.Spy;
    delete: jasmine.Spy;
  };

  const student: StudentDetail = {
    publicUuid: 's-1',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    email: 'juan@test.com',
    phone: '555-0100',
    address: 'Calle 123',
    birthDate: new Date('2010-05-15'),
    gender: Gender.Male,
    enrollmentStatus: EnrollmentStatus.Enrolled,
    enrollmentDate: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-06-01'),
  } as any;

  function configureModule(id: string | null = 's-1'): void {
    TestBed.resetTestingModule();
    const selectedSignal = signal<StudentDetail | null>(null);
    fakeStore = {
      selected: selectedSignal,
      loadingDetail: signal(false),
      saving: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      loadDetail: jasmine.createSpy('loadDetail'),
      delete: jasmine.createSpy('delete'),
    };
    TestBed.configureTestingModule({
      imports: [StudentDetailComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: StudentsStore, useValue: fakeStore },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_key: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(StudentDetailComponent);
    component = fixture.componentInstance;
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga detalle del id del route', () => {
    configureModule('s-1');
    fixture.detectChanges();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadDetail).toHaveBeenCalledWith('s-1');
  });

  it('ngOnInit sin id no llama loadDetail', () => {
    configureModule(null);
    fixture.detectChanges();
    expect(fakeStore.loadDetail).not.toHaveBeenCalled();
  });

  it('expone signals del store', () => {
    configureModule();
    fixture.detectChanges();
    fakeStore.selected.set(student);
    expect((component as any).student()?.fullName).toBe('Juan Perez');
    fakeStore.loadingDetail.set(true);
    expect((component as any).loading()).toBeTrue();
    fakeStore.saving.set(true);
    expect((component as any).saving()).toBeTrue();
    fakeStore.error.set('err');
    expect((component as any).errorMessage()).toBe('err');
  });

  it('editLink retorna ruta correcta', () => {
    configureModule();
    expect((component as any).editLink('s-1')).toBe('/students/s-1/edit');
  });

  it('documentLabel formatea tipo + número', () => {
    configureModule();
    expect((component as any).documentLabel(student)).toBe('DNI · 12345678');
  });

  it('formatGender mapea correctamente', () => {
    configureModule();
    expect((component as any).formatGender(Gender.Male)).toBe('Masculino');
    expect((component as any).formatGender(Gender.Female)).toBe('Femenino');
    expect((component as any).formatGender(Gender.Other)).toBe('Otro');
    expect((component as any).formatGender(Gender.NotSpecified)).toBe('Sin especificar');
    expect((component as any).formatGender(undefined)).toBe('—');
  });

  it('ageText calcula edad', () => {
    configureModule();
    const birth = new Date('2010-05-15');
    expect((component as any).ageText(birth)).toMatch(/^\d+ años$/);
  });

  it('ageText retorna — si sin fecha', () => {
    configureModule();
    expect((component as any).ageText(undefined)).toBe('—');
  });

  it('onDelete confirma y navega al listado si ok', async () => {
    configureModule();
    fakeStore.selected.set(student);
    fakeStore.delete.and.returnValue(Promise.resolve(true));
    spyOn(window, 'confirm').and.returnValue(true);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    await (component as any).onDelete(student);
    expect(fakeStore.delete).toHaveBeenCalledWith('s-1');
    expect(router.navigate).toHaveBeenCalledWith([ROUTES.STUDENTS.LIST]);
  });

  it('onDelete no borra si confirm false', async () => {
    configureModule();
    fakeStore.selected.set(student);
    spyOn(window, 'confirm').and.returnValue(false);
    await (component as any).onDelete(student);
    expect(fakeStore.delete).not.toHaveBeenCalled();
  });

  it('listRoute es /students', () => {
    configureModule();
    expect((component as any).listRoute).toBe('/students');
  });
});
