import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FamilyApiService, FamilyChildSummary } from './family-api.service';

describe('FamilyApiService', () => {
  let service: FamilyApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FamilyApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FamilyApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests only the authenticated parent children endpoint', () => {
    const children: FamilyChildSummary[] = [
      { publicUuid: 'child-1', firstName: 'Ana', lastName: 'Torres', fullName: 'Ana Torres', enrollmentStatus: 'ENROLLED' },
    ];

    service.listChildren().subscribe((response) => expect(response.data).toEqual(children));

    const request = http.expectOne('/api/v1/family/children');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ data: children });
  });

  it('loads child activities and payments by student uuid', () => {
    service.getChildActivities('child-1').subscribe((response) => expect(response.data).toEqual([]));
    const activities = http.expectOne('/api/v1/family/children/child-1/activities');
    expect(activities.request.method).toBe('GET');
    activities.flush({ data: [] });

    service.getChildPayments('child-1').subscribe((response) => expect(response.data).toEqual([]));
    const payments = http.expectOne('/api/v1/family/children/child-1/payments');
    expect(payments.request.method).toBe('GET');
    payments.flush({ data: [] });

    service.getChildSchedule('child-1').subscribe((response) => {
      expect(response.data).toEqual({ slots: [], nonTeachingBlocks: [] });
    });
    const schedule = http.expectOne('/api/v1/family/children/child-1/schedule');
    expect(schedule.request.method).toBe('GET');
    schedule.flush({ data: { slots: [], nonTeachingBlocks: [] } });
  });

  it('posts a justification without attaching a file', () => {
    service.justifyAttendance('rec-1', 'Cita médica').subscribe();
    const request = http.expectOne('/api/v1/attendance/records/rec-1/justify');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      justificationText: 'Cita médica',
      attachmentPublicUuid: null,
    });
    request.flush({});
  });
});
