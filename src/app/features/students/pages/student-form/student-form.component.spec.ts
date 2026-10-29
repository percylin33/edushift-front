import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { StudentFormComponent } from './student-form.component';
import { StudentsStore } from '../../store';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { StudentDetail } from '../../models';
import { DocumentType, EnrollmentStatus, Gender } from '@core/enums';
import { ROUTES } from '@core/constants';
import { StudentsApiService } from '../../services';

@Component({ template: '', standalone: true })
class DummyComponent {}

describe('StudentFormComponent', () => {
  let fixture: ComponentFixture<StudentFormComponent>;
  let component: StudentFormComponent;
  let fakeStore: jasmine.SpyObj<StudentsStore>;
  let fakeAcademicApi: jasmine.SpyObj<AcademicApiService>;
  let router: Router;

  const activeYear: AcademicYearRow = {
    publicUuid: 'y-1',
    name: '2026',
    status: AcademicYearStatus.Active,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
  };
  const sections: SectionRow[] = [
    {
      publicUuid: 'sec-1',
      academicYearPublicUuid: 'y-1',
      academicYearName: '2026',
      academicYearStatus: AcademicYearStatus.Active,
      gradePublicUuid: 'g-1',
      gradeName: '1° Grado',
      gradeOrdinal: 1,
      levelPublicUuid: 'l-1',
      levelCode: 'PRIMARY',
      name: '1A',
    },
  ];

  const detail: StudentDetail = {
    publicUuid: 's-1',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    email: 'juan@test.com',
    phone: '555-0100',
    birthDate: new Date('2010-05-15'),
    gender: Gender.Male,
    enrollmentStatus: EnrollmentStatus.Enrolled,
    enrollmentDate: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  function createStoreSpies(): jasmine.SpyObj<StudentsStore> {
    return jasmine.createSpyObj<StudentsStore>(
      'StudentsStore',
      ['clearError', 'loadDetail', 'create', 'update', 'enrollStudent'],
      {
        selected: signal<StudentDetail | null>(null),
        saving: signal(false),
        loadingDetail: signal(false),
        error: signal<string | null>(null),
      },
    );
  }

  function configureModule(id: string | null = null): void {
    TestBed.resetTestingModule();
    fakeStore = createStoreSpies();
    fakeAcademicApi = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
    ]);
    TestBed.configureTestingModule({
      imports: [StudentFormComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: StudentsStore, useValue: fakeStore },
        {
          provide: StudentsApiService,
          useValue: {
            listEnrollments: () => of([]),
            updateEnrollment: () => of({ publicUuid: 'enrollment-1' }),
          },
        },
        { provide: AcademicApiService, useValue: fakeAcademicApi },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_k: string) => id } } },
        },
      ],
    });
    fixture = TestBed.createComponent(StudentFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  describe('modo create', () => {
    it('ngOnInit carga secciones del año activo', async () => {
      configureModule();
      fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
      fakeAcademicApi.listSections.and.returnValue(of(sections));
      await component.ngOnInit();

      expect(fakeStore.clearError).toHaveBeenCalled();
      expect(component['editing']()).toBeFalse();
      expect(fakeAcademicApi.listYears).toHaveBeenCalled();
      expect(component['activeYear']()?.publicUuid).toBe('y-1');
    });

    it('title/subtitle en create', () => {
      configureModule();
      expect(component['title']()).toBe('Nuevo estudiante');
      expect(component['submitLabel']()).toBe('Crear estudiante');
    });

    it('onSubmit inválido no llama create', async () => {
      configureModule();
      await component['onSubmit']();
      expect(fakeStore.create).not.toHaveBeenCalled();
    });

    it('onSubmit llama create y navega a detail', async () => {
      configureModule();
      fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
      fakeAcademicApi.listSections.and.returnValue(of(sections));
      await component.ngOnInit();

      const created: StudentDetail = { publicUuid: 's-1' } as any;
      fakeStore.create.and.returnValue(Promise.resolve(created));
      spyOn(router, 'navigate');

      component['form'].patchValue({
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
      });
      await component['onSubmit']();

      expect(fakeStore.create).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.STUDENTS.detail('s-1')]);
    });

    it('onSubmit con sección encadena enrollStudent', async () => {
      configureModule();
      fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
      fakeAcademicApi.listSections.and.returnValue(of(sections));
      await component.ngOnInit();

      const created: StudentDetail = { publicUuid: 's-1' } as any;
      fakeStore.create.and.returnValue(Promise.resolve(created));
      fakeStore.enrollStudent.and.returnValue(Promise.resolve({ publicUuid: 'enroll-1' } as any));
      spyOn(router, 'navigate');

      component['form'].patchValue({
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
        sectionPublicUuid: 'sec-1',
        enrollmentDate: '2026-03-02',
      });
      await component['onSubmit']();

      expect(fakeStore.enrollStudent).toHaveBeenCalledWith(
        's-1',
        jasmine.objectContaining({ enrolledAt: '2026-03-02' }),
      );
    });
  });

  describe('modo edit', () => {
    it('ngOnInit hidrata form desde detail cargado', async () => {
      configureModule('s-1');
      fakeStore.loadDetail.and.returnValue(Promise.resolve(detail));
      await component.ngOnInit();

      expect(fakeStore.loadDetail).toHaveBeenCalledWith('s-1');
      expect(component['editing']()).toBeTrue();
      expect(component['form'].get('firstName')?.value).toBe('Juan');
      expect(component['form'].get('documentNumber')?.value).toBe('12345678');
    });

    it('title/subtitle en edit', () => {
      configureModule();
      component['editing'].set(true);
      expect(component['title']()).toBe('Editar estudiante');
      expect(component['submitLabel']()).toBe('Guardar cambios');
    });

    it('onSubmit llama store.update y navega', async () => {
      configureModule('s-1');
      fakeStore.loadDetail.and.returnValue(Promise.resolve(detail));
      await component.ngOnInit();

      fakeStore.update.and.returnValue(Promise.resolve(detail));
      spyOn(router, 'navigate');

      await component['onSubmit']();
      expect(fakeStore.update).toHaveBeenCalledWith('s-1', jasmine.any(Object));
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.STUDENTS.detail('s-1')]);
    });

    it('loadDetail nulo redirige al listado', async () => {
      configureModule('s-1');
      fakeStore.loadDetail.and.returnValue(Promise.resolve(null));
      spyOn(router, 'navigate');
      await component.ngOnInit();
      expect(router.navigate).toHaveBeenCalledWith([ROUTES.STUDENTS.LIST]);
    });
  });

  describe('showError', () => {
    it('retorna null para control sin errores y no tocado', () => {
      configureModule();
      expect(component['showError']('firstName')).toBeNull();
    });

    it('retorna string para required', () => {
      configureModule();
      const ctrl = component['form'].get('firstName')!;
      ctrl.markAsTouched();
      expect(component['showError']('firstName')).toBe('Campo requerido.');
    });

    it('retorna mensaje de pattern para documentNumber inválido', () => {
      configureModule();
      const ctrl = component['form'].get('documentNumber')!;
      ctrl.setValue('abcd$');
      ctrl.markAsTouched();
      expect(component['showError']('documentNumber')).toBe(
        'Solo letras, dígitos y guiones.',
      );
    });
  });

  describe('applyServerErrors', () => {
    it('mapea STUDENT_DOCUMENT_TAKEN', () => {
      configureModule();
      const err = new HttpErrorResponse({
        error: { errors: [{ code: 'STUDENT_DOCUMENT_TAKEN', message: 'ya existe' }] },
      });
      component['applyServerErrors'](err);
      expect(component['fieldErrors']()['documentNumber']).toContain('documento');
    });

    it('mapea STUDENT_EMAIL_TAKEN', () => {
      configureModule();
      const err = new HttpErrorResponse({
        error: { errors: [{ code: 'STUDENT_EMAIL_TAKEN', message: 'email en uso' }] },
      });
      component['applyServerErrors'](err);
      expect(component['fieldErrors']()['email']).toContain('email');
    });
  });

  it('toDateInput formatea correcto', () => {
    configureModule();
    // The API adapter parses calendar dates as local noon to avoid UTC day shifts.
    const date = new Date(2026, 0, 15, 12);
    expect(component['toDateInput'](date)).toBe('2026-01-15');
  });

  it('toDateInput null retorna null', () => {
    configureModule();
    expect(component['toDateInput'](undefined)).toBeNull();
  });
});
