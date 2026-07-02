import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EnrollStudentModalComponent } from './enroll-student-modal.component';
import { AcademicApiService } from '@features/academic/services';
import { StudentsStore } from '../store';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { StudentDetail } from '../models';
import { DocumentType, EnrollmentStatus, Gender } from '@core/enums';
import { of } from 'rxjs';

describe('EnrollStudentModalComponent', () => {
  let fixture: ComponentFixture<EnrollStudentModalComponent>;
  let component: EnrollStudentModalComponent;
  let fakeAcademicApi: jasmine.SpyObj<AcademicApiService>;
  let fakeStore: {
    enrollStudent: jasmine.Spy;
    transferStudentSection: jasmine.Spy;
    savingEnrollment: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
  };

  const activeYear: AcademicYearRow = {
    publicUuid: 'y-1',
    name: '2026',
    status: AcademicYearStatus.Active,
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 11, 31),
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
    {
      publicUuid: 'sec-2',
      academicYearPublicUuid: 'y-1',
      academicYearName: '2026',
      academicYearStatus: AcademicYearStatus.Active,
      gradePublicUuid: 'g-2',
      gradeName: '2° Grado',
      gradeOrdinal: 2,
      levelPublicUuid: 'l-1',
      levelCode: 'PRIMARY',
      name: '2A',
    },
  ];

  const student: StudentDetail = {
    publicUuid: 's-1',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    email: 'juan@test.com',
    enrollmentStatus: EnrollmentStatus.Enrolled,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  } as any;

  function configureModule(): void {
    fakeAcademicApi = jasmine.createSpyObj<AcademicApiService>('AcademicApiService', [
      'listYears',
      'listSections',
    ]);
    const savingSignal = signal(false);
    const errorSignal = signal<string | null>(null);
    fakeStore = {
      enrollStudent: jasmine.createSpy('enrollStudent'),
      transferStudentSection: jasmine.createSpy('transferStudentSection'),
      savingEnrollment: savingSignal,
      error: errorSignal,
      clearError: jasmine.createSpy('clearError'),
    };
    TestBed.configureTestingModule({
      imports: [EnrollStudentModalComponent],
      providers: [
        { provide: AcademicApiService, useValue: fakeAcademicApi },
        { provide: StudentsStore, useValue: fakeStore },
      ],
    });
    fixture = TestBed.createComponent(EnrollStudentModalComponent);
    component = fixture.componentInstance;
  }

  it('se crea', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('modo matrícula — carga activeYear y sections en ngOnInit', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
    fakeAcademicApi.listSections.and.returnValue(of(sections));
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('activeEnrollmentPublicUuid', null);

    await component.ngOnInit();
    fixture.detectChanges();

    expect(fakeAcademicApi.listYears).toHaveBeenCalled();
    expect((component as any).activeYear()?.publicUuid).toBe('y-1');
    expect((component as any).sections()).toHaveSize(2);
    expect((component as any).isTransfer()).toBeFalse();
    expect((component as any).enrolledAt()).toBeTruthy();
  });

  it('modo matrícula — canSubmit requiere sección + fecha', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
    fakeAcademicApi.listSections.and.returnValue(of(sections));
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('activeEnrollmentPublicUuid', null);
    await component.ngOnInit();

    expect((component as any).canSubmit()).toBeFalse();
    (component as any).sectionUuid.set('sec-1');
    expect((component as any).canSubmit()).toBeTrue();
  });

  it('modo cambio — isTransfer true si activeEnrollmentPublicUuid presente', () => {
    configureModule();
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('activeEnrollmentPublicUuid', 'enroll-1');
    expect((component as any).isTransfer()).toBeTrue();
  });

  it('onSubmit llama store.enrollStudent y emite enrolled si ok', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
    fakeAcademicApi.listSections.and.returnValue(of(sections));
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('activeEnrollmentPublicUuid', null);
    await component.ngOnInit();

    fakeStore.enrollStudent.and.returnValue(Promise.resolve(true));
    (component as any).sectionUuid.set('sec-1');
    const enrolledSpy = jasmine.createSpy('enrolled');
    component.enrolled.subscribe(enrolledSpy);

    await (component as any).onSubmit();
    expect(fakeStore.enrollStudent).toHaveBeenCalledOnceWith(
      's-1',
      jasmine.objectContaining({
        sectionPublicUuid: 'sec-1',
        academicYearPublicUuid: 'y-1',
      }),
    );
    expect(enrolledSpy).toHaveBeenCalled();
  });

  it('onSubmit llama store.transferStudentSection en modo cambio', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
    fakeAcademicApi.listSections.and.returnValue(of(sections));
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('activeEnrollmentPublicUuid', 'enroll-1');
    await component.ngOnInit();

    fakeStore.transferStudentSection.and.returnValue(Promise.resolve(true));
    (component as any).sectionUuid.set('sec-2');

    await (component as any).onSubmit();
    expect(fakeStore.transferStudentSection).toHaveBeenCalled();
    expect(fakeStore.enrollStudent).not.toHaveBeenCalled();
  });

  it('onSubmit no hace nada si canSubmit false', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
    fakeAcademicApi.listSections.and.returnValue(of(sections));
    fixture.componentRef.setInput('student', student);
    await component.ngOnInit();

    await (component as any).onSubmit();
    expect(fakeStore.enrollStudent).not.toHaveBeenCalled();
  });

  it('close emite closed y limpia error', () => {
    configureModule();
    const closeSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closeSpy);
    (component as any).close();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('errorMessage expone store.error', () => {
    configureModule();
    fakeStore.error.set('algo salió mal');
    expect((component as any).errorMessage()).toBe('algo salió mal');
  });

  it('yearMinDate y yearMaxDate desde activeYear', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(of([activeYear]));
    fakeAcademicApi.listSections.and.returnValue(of([]));
    fixture.componentRef.setInput('student', student);
    await component.ngOnInit();
    expect((component as any).yearMinDate()).toBe('2026-01-01');
    expect((component as any).yearMaxDate()).toBe('2026-12-31');
  });

  it('yearMinDate / yearMaxDate vacío sin activeYear', () => {
    configureModule();
    expect((component as any).yearMinDate()).toBe('');
    expect((component as any).yearMaxDate()).toBe('');
  });

  it('onEscape no cierra si saving', () => {
    configureModule();
    fixture.componentRef.setInput('student', student);
    fakeStore.savingEnrollment.set(true);
    const closeSpy = spyOn(component as any, 'close');
    (component as any)['onEscape']();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('no hay año activo — muestra warning', async () => {
    configureModule();
    fakeAcademicApi.listYears.and.returnValue(
      of([{ ...activeYear, status: AcademicYearStatus.Closed }]),
    );
    fixture.componentRef.setInput('student', student);
    await component.ngOnInit();
    expect((component as any).activeYear()).toBeNull();
  });
});
