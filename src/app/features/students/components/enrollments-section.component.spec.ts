import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EnrollmentsSectionComponent } from './enrollments-section.component';
import { StudentsStore } from '../store/students.store';
import { StudentDetail, EnrollmentRow } from '../models';
import { DocumentType, EnrollmentStatus, StudentEnrollmentStatus } from '@core/enums';
import { ROUTES } from '@core/constants';

describe('EnrollmentsSectionComponent', () => {
  let fixture: ComponentFixture<EnrollmentsSectionComponent>;
  let component: EnrollmentsSectionComponent;
  let fakeStore: {
    enrollments: ReturnType<typeof signal<EnrollmentRow[]>>;
    activeEnrollment: ReturnType<typeof signal<EnrollmentRow | null>>;
    loadingEnrollments: ReturnType<typeof signal<boolean>>;
    savingEnrollment: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    clearError: jasmine.Spy;
    loadEnrollments: jasmine.Spy;
  };

  const student: StudentDetail = {
    publicUuid: 's-1',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    enrollmentStatus: EnrollmentStatus.Enrolled,
    enrollmentDate: new Date('2026-01-01'),
  } as any;

  const activeEnrollment: EnrollmentRow = {
    publicUuid: 'e-1',
    studentPublicUuid: 's-1',
    studentFullName: 'Juan Perez',
    sectionPublicUuid: 'sec-1',
    sectionName: 'A',
    gradeName: null,
    academicYearPublicUuid: 'y-1',
    academicYearName: '2026',
    enrolledAt: new Date('2026-01-01'),
    withdrawnAt: undefined,
    status: StudentEnrollmentStatus.Active,
    active: true,
  };

  function configureModule(): void {
    fakeStore = {
      enrollments: signal<EnrollmentRow[]>([]),
      activeEnrollment: signal<EnrollmentRow | null>(null),
      loadingEnrollments: signal(false),
      savingEnrollment: signal(false),
      error: signal<string | null>(null),
      clearError: jasmine.createSpy('clearError'),
      loadEnrollments: jasmine.createSpy('loadEnrollments').and.returnValue(Promise.resolve()),
    };
    TestBed.configureTestingModule({
      imports: [EnrollmentsSectionComponent],
      providers: [provideRouter([]), { provide: StudentsStore, useValue: fakeStore }],
    });
    fixture = TestBed.createComponent(EnrollmentsSectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('student', student);
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga matrículas del alumno', async () => {
    configureModule();
    await component.ngOnInit();
    expect(fakeStore.loadEnrollments).toHaveBeenCalledWith('s-1');
  });

  it('sectionRoute construye ruta académica', () => {
    configureModule();
    expect(component['sectionRoute']('sec-1')).toBe(ROUTES.ACADEMIC.SECTIONS.detail('sec-1'));
  });

  it('statusLabel retorna etiqueta en español', () => {
    configureModule();
    expect(component['statusLabel'](StudentEnrollmentStatus.Active)).toBe('Activa');
    expect(component['statusLabel'](StudentEnrollmentStatus.Withdrawn)).toBe('Retirado');
    expect(component['statusLabel'](StudentEnrollmentStatus.Transferred)).toBe('Trasladado');
    expect(component['statusLabel'](StudentEnrollmentStatus.Graduated)).toBe('Graduado');
  });

  it('badgeClass retorna clase de badge correcta', () => {
    configureModule();
    expect(component['badgeClass'](StudentEnrollmentStatus.Active)).toContain(
      'badge-success',
    );
    expect(component['badgeClass'](StudentEnrollmentStatus.Withdrawn)).toContain(
      'badge-danger',
    );
    expect(component['badgeClass'](StudentEnrollmentStatus.Graduated)).toContain(
      'badge-primary',
    );
  });

  it('reload limpia error y recarga', async () => {
    configureModule();
    await component['reload']();
    expect(fakeStore.clearError).toHaveBeenCalled();
    expect(fakeStore.loadEnrollments).toHaveBeenCalledWith('s-1');
  });

  it('openEnroll / closeEnroll / onEnrolled alternan modal de alta', () => {
    configureModule();
    component['openEnroll']();
    expect(component['showEnroll']()).toBeTrue();
    component['closeEnroll']();
    expect(component['showEnroll']()).toBeFalse();
    component['openEnroll']();
    component['onEnrolled']();
    expect(component['showEnroll']()).toBeFalse();
  });

  it('openTransfer / closeTransfer / onTransferred alternan modal de cambio', () => {
    configureModule();
    component['openTransfer']();
    expect(component['showTransfer']()).toBeTrue();
    component['closeTransfer']();
    expect(component['showTransfer']()).toBeFalse();
    component['onTransferred']();
    expect(component['showTransfer']()).toBeFalse();
  });

  it('openWithdraw / closeWithdraw / onWithdrew alternan modal de cierre', () => {
    configureModule();
    component['openWithdraw'](activeEnrollment);
    expect(component['withdrawTarget']()?.publicUuid).toBe('e-1');
    component['closeWithdraw']();
    expect(component['withdrawTarget']()).toBeNull();
    component['openWithdraw'](activeEnrollment);
    component['onWithdrew']();
    expect(component['withdrawTarget']()).toBeNull();
  });
});
