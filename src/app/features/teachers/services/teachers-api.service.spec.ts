import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { TeachersApiService } from './teachers-api.service';

describe('TeachersApiService', () => {
  let service: TeachersApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockPage = {
    content: [
      {
        publicUuid: 't-1',
        documentType: 'DNI',
        documentNumber: '87654321',
        firstName: 'Maria',
        lastName: 'Gomez',
        secondLastName: null,
        email: 'maria@school.com',
        title: null,
        specializations: [],
        employmentStatus: 'ACTIVE',
        hasUserAccount: true,
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
      publicUuid: 't-1',
      documentType: 'DNI',
      documentNumber: '87654321',
      firstName: 'Maria',
      lastName: 'Gomez',
      secondLastName: null,
      fullName: 'Maria Gomez',
      birthDate: '1985-03-10T00:00:00.000Z',
      gender: null,
      email: 'maria@school.com',
      phone: null,
      title: null,
      specializations: [],
      hireDate: '2025-01-01T00:00:00.000Z',
      employmentStatus: 'ACTIVE',
      userPublicUuid: 'u-1',
      metadata: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    TestBed.configureTestingModule({
      providers: [TeachersApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(TeachersApiService);
  });

  it('list hace GET /v1/teachers y adapta a TeacherRow[]', (done) => {
    apiSpy.get.and.returnValue(of(mockPage));
    service.list({}).subscribe((page) => {
      expect(page.content).toHaveSize(1);
      expect(page.content[0].fullName).toBe('Maria Gomez');
      expect(apiSpy.get).toHaveBeenCalledWith(API.TEACHERS.ROOT, jasmine.any(Object));
      done();
    });
  });

  it('get hace GET /v1/teachers/{uuid} y adapta a TeacherDetail', (done) => {
    apiSpy.get.and.returnValue(of(mockDetail));
    service.get('t-1').subscribe((detail) => {
      expect(detail.fullName).toBe('Maria Gomez');
      expect(detail.hasUserAccount).toBeTrue();
      expect(apiSpy.get).toHaveBeenCalledWith(API.TEACHERS.BY_ID('t-1'));
      done();
    });
  });

  it('create hace POST /v1/teachers', (done) => {
    apiSpy.post.and.returnValue(of(mockDetail));
    const req = {
      firstName: 'Maria',
      lastName: 'Gomez',
      documentType: 'DNI',
      documentNumber: '87654321',
    };
    service.create(req as any).subscribe(() => {
      expect(apiSpy.post).toHaveBeenCalledWith(API.TEACHERS.ROOT, req);
      done();
    });
  });

  it('update hace PUT /v1/teachers/{uuid}', (done) => {
    apiSpy.put.and.returnValue(of(mockDetail));
    service.update('t-1', { firstName: 'Maria Updated' } as any).subscribe(() => {
      expect(apiSpy.put).toHaveBeenCalledWith(API.TEACHERS.BY_ID('t-1'), {
        firstName: 'Maria Updated',
      });
      done();
    });
  });

  it('linkUser hace POST /v1/teachers/{uuid}/link-user', (done) => {
    apiSpy.post.and.returnValue(of(mockDetail));
    service.linkUser('t-1', { userPublicUuid: 'u-1' } as any).subscribe(() => {
      expect(apiSpy.post).toHaveBeenCalledWith(API.TEACHERS.LINK_USER('t-1'), {
        userPublicUuid: 'u-1',
      });
      done();
    });
  });

  it('invite hace POST /v1/teachers/{uuid}/invite', (done) => {
    const mockInvite = {
      success: true,
      data: {
        invitationPublicUuid: 'inv-1',
        invitationToken: 'token-123',
        expiresAt: '2026-02-01T00:00:00.000Z',
        teacherPublicUuid: 't-1',
        email: 'maria@school.com',
      },
    };
    apiSpy.post.and.returnValue(of(mockInvite));
    service.invite('t-1').subscribe((result) => {
      expect(result.invitationToken).toBe('token-123');
      expect(result.expiresAt).toBeInstanceOf(Date);
      done();
    });
  });

  it('delete hace DELETE /v1/teachers/{uuid}', (done) => {
    apiSpy.delete.and.returnValue(of(void 0));
    service.delete('t-1').subscribe(() => {
      expect(apiSpy.delete).toHaveBeenCalledWith(API.TEACHERS.BY_ID('t-1'));
      done();
    });
  });

  it('listAssignments hace GET a assignments endpoint', (done) => {
    const mockAssignments = [
      {
        publicUuid: 'a-1',
        teacherPublicUuid: 't-1',
        teacherFullName: 'Maria Gomez',
        sectionPublicUuid: 'sec-1',
        sectionName: 'A',
        coursePublicUuid: 'c-1',
        courseCode: 'MATH-101',
        courseName: 'Algebra',
        academicPeriodPublicUuid: 'p-1',
        periodType: 'QUARTER',
        periodOrdinal: 1,
        assignedAt: '2026-01-01T00:00:00.000Z',
        unassignedAt: null,
        active: true,
      },
    ];
    apiSpy.get.and.returnValue(of(mockAssignments));
    service.listAssignments('t-1', {}).subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].courseCode).toBe('MATH-101');
      expect(rows[0].assignedAt).toBeInstanceOf(Date);
      done();
    });
  });
});
