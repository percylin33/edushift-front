import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { StudentsApiService } from './students-api.service';

describe('StudentsApiService', () => {
  let service: StudentsApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockPage = {
    content: [
      {
        publicUuid: 's-1',
        documentType: 'DNI',
        documentNumber: '12345678',
        firstName: 'Juan',
        lastName: 'Perez',
        fullName: 'Juan Perez',
        email: 'juan@test.com',
        enrollmentStatus: 'ACTIVE',
        enrollmentDate: '2026-01-01T00:00:00.000Z',
      },
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

  const mockDetail = {
    success: true,
    data: {
      publicUuid: 's-1',
      documentType: 'DNI',
      documentNumber: '12345678',
      firstName: 'Juan',
      lastName: 'Perez',
      secondLastName: null,
      fullName: 'Juan Perez',
      birthDate: '2010-05-15T00:00:00.000Z',
      gender: null,
      email: 'juan@test.com',
      phone: null,
      address: null,
      enrollmentStatus: 'ACTIVE',
      enrollmentDate: '2026-01-01T00:00:00.000Z',
      userId: null,
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        StudentsApiService,
        { provide: ApiService, useValue: apiSpy },
      ],
    });
    service = TestBed.inject(StudentsApiService);
  });

  it('list hace GET /v1/students y adapta a StudentRow[]', (done) => {
    apiSpy.get.and.returnValue(of(mockPage));
    service.list({}).subscribe((page) => {
      expect(page.content).toHaveSize(1);
      expect(page.content[0].fullName).toBe('Juan Perez');
      expect(apiSpy.get).toHaveBeenCalledWith(API.STUDENTS.ROOT, jasmine.any(Object));
      done();
    });
  });

  it('get hace GET /v1/students/{uuid} y adapta a StudentDetail', (done) => {
    apiSpy.get.and.returnValue(of(mockDetail));
    service.get('s-1').subscribe((detail) => {
      expect(detail.fullName).toBe('Juan Perez');
      expect(detail.birthDate).toBeInstanceOf(Date);
      expect(apiSpy.get).toHaveBeenCalledWith(API.STUDENTS.BY_ID('s-1'));
      done();
    });
  });

  it('create hace POST /v1/students', (done) => {
    apiSpy.post.and.returnValue(of(mockDetail));
    const req = {
      firstName: 'Juan',
      lastName: 'Perez',
      documentType: 'DNI',
      documentNumber: '12345678',
    };
    service.create(req as any).subscribe((detail) => {
      expect(detail.fullName).toBe('Juan Perez');
      expect(apiSpy.post).toHaveBeenCalledWith(API.STUDENTS.ROOT, req);
      done();
    });
  });

  it('update hace PUT /v1/students/{uuid}', (done) => {
    apiSpy.put.and.returnValue(of(mockDetail));
    const patch = { firstName: 'Juan Updated' };
    service.update('s-1', patch as any).subscribe(() => {
      expect(apiSpy.put).toHaveBeenCalledWith(API.STUDENTS.BY_ID('s-1'), patch);
      done();
    });
  });

  it('delete hace DELETE /v1/students/{uuid}', (done) => {
    apiSpy.delete.and.returnValue(of(void 0));
    service.delete('s-1').subscribe(() => {
      expect(apiSpy.delete).toHaveBeenCalledWith(API.STUDENTS.BY_ID('s-1'));
      done();
    });
  });

  it('listGuardians hace GET y adapta a Guardian[]', (done) => {
    const mockGuardians = {
      success: true,
      data: [
        {
          linkPublicUuid: 'l-1',
          guardianPublicUuid: 'g-1',
          documentType: 'DNI',
          documentNumber: '87654321',
          firstName: 'Maria',
          lastName: 'Gomez',
          fullName: 'Maria Gomez',
          email: 'maria@test.com',
          phone: null,
          occupation: null,
          relationship: 'MOTHER',
          isPrimaryContact: true,
          canPickupStudent: true,
        },
      ],
    };
    apiSpy.get.and.returnValue(of(mockGuardians));
    service.listGuardians('s-1').subscribe((guardians) => {
      expect(guardians).toHaveSize(1);
      expect(guardians[0].relationship).toBe('MOTHER');
      done();
    });
  });
});
