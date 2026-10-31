import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { StudentDetailComponent } from './student-detail.component';
import { StudentsStore } from '../../store';
import { StudentDetail } from '../../models';
import { DocumentType, EnrollmentStatus, Gender } from '@core/enums';
import { ROUTES } from '@core/constants';
import { ConfirmDialogService } from '@shared/components';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('StudentDetailComponent', () => {
  let fixture: ComponentFixture<StudentDetailComponent>;
  let component: StudentDetailComponent;
  let fakeConfirm: jasmine.SpyObj<ConfirmDialogService>;
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
    fakeConfirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
    fakeConfirm.open.and.returnValue(Promise.resolve(false));
    TestBed.configureTestingModule({
      imports: [StudentDetailComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: StudentsStore, useValue: fakeStore },
        { provide: ConfirmDialogService, useValue: fakeConfirm },
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
    expect(component['student']()?.fullName).toBe('Juan Perez');
    fakeStore.loadingDetail.set(true);
    expect(component['loading']()).toBeTrue();
    fakeStore.saving.set(true);
    expect(component['saving']()).toBeTrue();
    fakeStore.error.set('err');
    expect(component['errorMessage']()).toBe('err');
  });

  it('editLink retorna ruta correcta', () => {
    configureModule();
    expect(component['editLink']('s-1')).toBe('/students/s-1/edit');
  });

  it('documentLabel formatea tipo + número', () => {
    configureModule();
    expect(component['documentLabel'](student)).toBe('DNI · 12345678');
  });

  it('formatGender mapea correctamente', () => {
    configureModule();
    expect(component['formatGender'](Gender.Male)).toBe('Masculino');
    expect(component['formatGender'](Gender.Female)).toBe('Femenino');
    expect(component['formatGender'](Gender.Other)).toBe('Otro');
    expect(component['formatGender'](Gender.NotSpecified)).toBe('Sin especificar');
    expect(component['formatGender'](undefined)).toBe('—');
  });

  it('ageText calcula edad', () => {
    configureModule();
    const birth = new Date('2010-05-15');
    expect(component['ageText'](birth)).toMatch(/^\d+ años$/);
  });

  it('ageText retorna — si sin fecha', () => {
    configureModule();
    expect(component['ageText'](undefined)).toBe('—');
  });

  it('onDelete confirma y navega al listado si ok', async () => {
    configureModule();
    fakeStore.selected.set(student);
    fakeStore.delete.and.returnValue(Promise.resolve(true));
    fakeConfirm.open.and.returnValue(Promise.resolve(true));
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    await component['onDelete'](student);
    expect(fakeStore.delete).toHaveBeenCalledWith('s-1');
    expect(router.navigate).toHaveBeenCalledWith([ROUTES.STUDENTS.LIST]);
  });

  it('onDelete no borra si confirm false', async () => {
    configureModule();
    fakeStore.selected.set(student);
    fakeConfirm.open.and.returnValue(Promise.resolve(false));
    await component['onDelete'](student);
    expect(fakeStore.delete).not.toHaveBeenCalled();
  });

  it('listRoute es /students', () => {
    configureModule();
    expect(component['listRoute']).toBe('/students');
  });
});
