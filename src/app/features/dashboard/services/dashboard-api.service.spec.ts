import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DashboardApiService } from './dashboard-api.service';
import { ApiService } from '@core/services';

describe('DashboardApiService', () => {
  let service: DashboardApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get']);
    TestBed.configureTestingModule({
      providers: [DashboardApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(DashboardApiService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('metrics', () => {
    it('obtiene métricas', (done) => {
      apiSpy.get.and.returnValue(of([{ key: 'students', label: 'Estudiantes', value: 100 }]));
      service.metrics().subscribe((res) => {
        expect(res.length).toBe(1);
        done();
      });
    });
  });

  describe('widgets', () => {
    it('obtiene widgets', (done) => {
      apiSpy.get.and.returnValue(of([{ id: 'w1', type: 'metric', title: 'Widget', payload: {} }]));
      service.widgets().subscribe((res) => {
        expect(res.length).toBe(1);
        done();
      });
    });
  });

  describe('getAttendanceOverview', () => {
    it('obtiene overview de asistencia', (done) => {
      const mockRaw = {
        data: {
          generatedAt: '2026-06-11T12:00:00Z',
          attendanceRateToday: 90,
          enrollmentsConsidered: 100,
          openSessions: 3,
          uniqueStudentsRegisteredToday: 80,
          totalAbsencesToday: 10,
          topAbsentSections: [],
          recentClosedSessions: [],
        },
      };
      apiSpy.get.and.returnValue(of(mockRaw));
      service.getAttendanceOverview().subscribe((overview) => {
        expect(overview.attendanceRateToday).toBe(90);
        expect(overview.openSessions).toBe(3);
        done();
      });
    });
  });
});
