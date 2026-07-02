import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StudentsStore } from './students.store';
import { StudentsApiService } from '../services';
import { StudentDetail, StudentRow, Guardian, EnrollmentRow } from '../models';
import {
  DocumentType,
  EnrollmentStatus,
  RelationshipType,
  StudentEnrollmentStatus,
} from '@core/enums';

describe('StudentsStore', () => {
  let store: StudentsStore;
  let apiSpy: jasmine.SpyObj<StudentsApiService>;

  const mockStudent: StudentDetail = {
    publicUuid: 's-1',
    documentType: DocumentType.Dni,
    documentNumber: '12345678',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    birthDate: new Date('2010-05-15'),
    enrollmentStatus: EnrollmentStatus.Enrolled,
    enrollmentDate: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<StudentsApiService>('StudentsApiService', [
      'list',
      'get',
      'create',
      'update',
      'delete',
      'listGuardians',
      'addGuardian',
      'updateGuardianLink',
      'unlinkGuardian',
      'listEnrollments',
      'createEnrollment',
      'withdrawEnrollment',
    ]);
    TestBed.configureTestingModule({
      providers: [StudentsStore, { provide: StudentsApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(StudentsStore);
  });

  it('inicia con list vacía', () => {
    expect(store.items()).toEqual([]);
    expect(store.loading()).toBeFalse();
    expect(store.selected()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('loadList carga items y paginación', async () => {
    const page = {
      content: [
        {
          publicUuid: 's-1',
          fullName: 'Juan Perez',
          documentType: DocumentType.Dni,
          documentNumber: '12345678',
          firstName: 'Juan',
          lastName: 'Perez',
          email: undefined,
          enrollmentStatus: EnrollmentStatus.Enrolled,
          enrollmentDate: undefined,
        } as StudentRow,
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
      empty: false,
      numberOfElements: 1,
    };
    apiSpy.list.and.returnValue(of(page));

    await store.loadList();
    expect(store.items()).toHaveSize(1);
    expect(store.pagination().totalElements).toBe(1);
    expect(store.loading()).toBeFalse();
  });

  it('loadDetail carga el detalle', async () => {
    apiSpy.get.and.returnValue(of(mockStudent));
    await store.loadDetail('s-1');
    expect(store.selected()?.fullName).toBe('Juan Perez');
    expect(store.loadingDetail()).toBeFalse();
  });

  it('applyFilters actualiza filtros y recarga', async () => {
    apiSpy.list.and.returnValue(
      of({
        content: [],
        number: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        first: true,
        last: true,
        empty: true,
        numberOfElements: 0,
      }),
    );
    await store.applyFilters({ search: 'Juan' });
    expect(store.filters().search).toBe('Juan');
    expect(store.pagination().page).toBe(0);
  });

  it('loadGuardians carga la lista', async () => {
    const guardians: Guardian[] = [
      {
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
      },
    ];
    apiSpy.listGuardians.and.returnValue(of(guardians));
    await store.loadGuardians('s-1');
    expect(store.guardians()).toHaveSize(1);
  });

  it('loadEnrollments carga la lista', async () => {
    const enrollments: EnrollmentRow[] = [
      {
        publicUuid: 'e-1',
        studentPublicUuid: 's-1',
        studentFullName: 'Juan Perez',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        academicYearPublicUuid: 'y-1',
        academicYearName: '2026',
        enrolledAt: new Date('2026-01-01'),
        withdrawnAt: undefined,
        status: StudentEnrollmentStatus.Active,
        active: true,
      },
    ];
    apiSpy.listEnrollments.and.returnValue(of(enrollments));
    await store.loadEnrollments('s-1');
    expect(store.enrollments()).toHaveSize(1);
  });

  it('delete llama al api', async () => {
    apiSpy.delete.and.returnValue(of(void 0));
    await store.delete('s-1');
    expect(apiSpy.delete).toHaveBeenCalledWith('s-1');
  });
});
