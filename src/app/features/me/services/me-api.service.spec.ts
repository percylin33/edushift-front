import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MeApiService } from './me-api.service';

describe('MeApiService', () => {
  let service: MeApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MeApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MeApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads profile without a student uuid', () => {
    service.getProfile().subscribe((response) => expect(response.data.firstName).toBe('Lucía'));
    const request = http.expectOne('/api/v1/me/profile');
    expect(request.request.method).toBe('GET');
    request.flush({ data: { firstName: 'Lucía', lastName: 'Test' } });
  });

  it('lists sections and grades on the /me surface', () => {
    service.listSections().subscribe((response) => expect(response.data.length).toBe(0));
    http.expectOne('/api/v1/me/sections').flush({ data: [] });

    service.listGrades().subscribe((response) => expect(response.data.length).toBe(0));
    http.expectOne('/api/v1/me/grades').flush({ data: [] });

    service.gradesSummary('period-1').subscribe((response) => {
      expect(response.data.courseCount).toBe(0);
    });
    const summary = http.expectOne('/api/v1/me/grades/summary?period=period-1');
    expect(summary.request.method).toBe('GET');
    summary.flush({ data: { courseCount: 0, courses: [], items: [] } });
  });

  it('lists attendance, qr and payments without a student uuid', () => {
    service.listAttendance().subscribe((response) => expect(response.data.length).toBe(0));
    http.expectOne('/api/v1/me/attendance').flush({ data: [] });

    service.getQr().subscribe((response) => expect(response.data.hasCredential).toBeFalse());
    http.expectOne('/api/v1/me/qr').flush({ data: { hasCredential: false } });

    service.listPayments().subscribe((response) => expect(response.data.length).toBe(0));
    http.expectOne('/api/v1/me/payments').flush({ data: [] });
  });

  it('lists the caller schedule without a student uuid', () => {
    service.listSchedule().subscribe((response) => {
      expect(response.data.slots.length).toBe(0);
      expect(response.data.nonTeachingBlocks.length).toBe(0);
    });
    const request = http.expectOne('/api/v1/me/schedule');
    expect(request.request.method).toBe('GET');
    request.flush({ data: { slots: [], nonTeachingBlocks: [], suggestedPeriods: [] } });
  });
});
